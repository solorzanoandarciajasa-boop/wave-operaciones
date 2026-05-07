/* ══════════════════════════════════════════════
   WAVE – coord-app.js  (módulo coordinador)
══════════════════════════════════════════════ */
'use strict';

// ── CATÁLOGO ───────────────────────────────────
const COORDS = {
  soporte:      { label:'COORD SOPORTE NIVEL 1',               name:'Alejandro Gómez',  emoji:'🔧', cssClass:'coord-soporte'      },
  ampliacion:   { label:'COORD AMPLIACIÓN (INFRAESTRUCTURA)',   name:'José Marval',      emoji:'🏗️', cssClass:'coord-ampliacion'   },
  construccion: { label:'COORD CONSTRUCCIÓN',                   name:'Francisco Silva',  emoji:'🦺', cssClass:'coord-construccion' },
  instalaciones:{ label:'COORD INSTALACIONES / SOPORTE PIMES', name:'Miguel Rojas',     emoji:'📡', cssClass:'coord-instalaciones'},
  servicios:    { label:'COORD SERVICIOS GENERALES',            name:'Roberto Gómez',    emoji:'⚙️', cssClass:'coord-servicios'    },
  gps:          { label:'COORD GPS',                            name:'Carlos Méndez',    emoji:'📍', cssClass:'coord-gps'          }
};

// ── ESTADO ─────────────────────────────────────
let db        = null;
let coordKey  = '';
let cMode     = 'agenda';
let cFiles    = [];   // { file, url, isImage }

// Datos persistentes por modo (no se pierden al cambiar de tab)
const cData = {
  agenda:  { casos: '' },
  reporte: { exito: '', pendiente: '' }
};

// ── INIT ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  resolveCoord();
  cSetMode('agenda');
  setDate();
  await initSupabase();
});

// ── LEER PARÁMETRO DE URL ──────────────────────
function resolveCoord() {
  const params = new URLSearchParams(window.location.search);
  coordKey = (params.get('coord') || '').toLowerCase().trim();

  if (!coordKey || !COORDS[coordKey]) {
    showCoordSelector();
    return;
  }
  applyCoord(coordKey);
}

function applyCoord(key) {
  const c = COORDS[key];
  document.getElementById('coordEmoji').textContent     = c.emoji;
  document.getElementById('coordLabelText').textContent = c.label;
  document.getElementById('coordPerson').textContent    = c.name;
  document.title = `WAVE · ${c.label}`;
}

function showCoordSelector() {
  const banner = document.getElementById('coordBanner');
  banner.innerHTML = `
    <div style="width:100%">
      <p style="font-size:0.85rem;color:var(--txt2);margin-bottom:10px">Selecciona tu coordinación:</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${Object.entries(COORDS).map(([k,c])=>`
          <button onclick="selectCoord('${k}')" style="
            padding:12px 16px;background:var(--card2);border:1px solid var(--border);
            border-radius:8px;color:var(--txt);font-family:var(--font);font-size:0.9rem;
            font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:10px">
            ${c.emoji} <span>${c.label} — ${c.name}</span>
          </button>`).join('')}
      </div>
    </div>`;
}

function selectCoord(key) {
  coordKey = key;
  applyCoord(key);
  const url = new URL(window.location.href);
  url.searchParams.set('coord', key);
  window.history.replaceState({}, '', url.toString());
  loadHistorial();
}

// ── FECHA ──────────────────────────────────────
function setDate() {
  const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const n = new Date();
  document.getElementById('datePill').textContent =
    `${DAYS[n.getDay()]} ${n.getDate()} ${MONTHS[n.getMonth()]}`;
}

// ── SUPABASE ───────────────────────────────────
async function initSupabase() {
  try {
    const { createClient } = supabase;
    db = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { error } = await db.from('envios').select('id').limit(1);
    if (error) throw error;
    setStatus('✅ Conectado', 'ok');
    loadHistorial();
    subscribeRealtime();
  } catch (e) {
    setStatus('⚠️ Sin conexión', 'err');
    console.warn('Supabase:', e.message);
  }
}

function subscribeRealtime() {
  if (!db || !coordKey) return;
  db.channel('coord-channel')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'envios',
      filter: `coord_key=eq.${coordKey}`
    }, () => loadHistorial())
    .subscribe();
}

// ── MODO (TABS PERSISTENTES) ───────────────────
function cSetMode(mode) {
  // Guardar datos actuales antes de cambiar de tab
  saveCurrent();

  cMode = mode;
  document.getElementById('cBtnAgenda').classList.toggle('active',  mode === 'agenda');
  document.getElementById('cBtnReporte').classList.toggle('active', mode === 'reporte');
  document.getElementById('cAgendaFields').classList.toggle('hidden',  mode !== 'agenda');
  document.getElementById('cReporteFields').classList.toggle('hidden', mode !== 'reporte');

  // Restaurar datos del tab al que se cambia
  restoreTab(mode);
  updateSendStatus();
}

// Guarda los valores actuales del tab activo en memoria
function saveCurrent() {
  if (cMode === 'agenda') {
    cData.agenda.casos = document.getElementById('cCasos').value;
  } else {
    cData.reporte.exito    = document.getElementById('cExito').value;
    cData.reporte.pendiente= document.getElementById('cPendiente').value;
  }
}

// Restaura los valores del tab al que se navega
function restoreTab(mode) {
  if (mode === 'agenda') {
    document.getElementById('cCasos').value = cData.agenda.casos;
  } else {
    document.getElementById('cExito').value    = cData.reporte.exito;
    document.getElementById('cPendiente').value= cData.reporte.pendiente;
  }
}

// Actualiza indicadores de progreso en los tabs
function updateSendStatus() {
  const hasAgenda  = !!cData.agenda.casos.trim();
  const hasReporte = !!(cData.reporte.exito.trim() || cData.reporte.pendiente.trim());

  const btnA = document.getElementById('cBtnAgenda');
  const btnR = document.getElementById('cBtnReporte');

  // Mostrar tick si tiene contenido
  btnA.innerHTML = `📋 Agenda ${hasAgenda  ? '<span class="tab-check">✓</span>' : ''}`;
  btnR.innerHTML = `📊 Reporte ${hasReporte ? '<span class="tab-check">✓</span>' : ''}`;

  // Hint del botón enviar
  const hint = document.getElementById('cSendHint');
  if (hint) {
    const parts = [];
    if (hasAgenda)  parts.push('📋 Agenda');
    if (hasReporte) parts.push('📊 Reporte');
    hint.textContent = parts.length
      ? `Se enviará: ${parts.join(' + ')}`
      : 'Completa al menos un campo';
    hint.style.color = parts.length ? 'var(--success)' : 'var(--txt2)';
  }
}

// ── ARCHIVOS ───────────────────────────────────
function cHandleFiles(fileList) {
  const ok = ['image/jpeg','image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  Array.from(fileList).forEach(file => {
    if (!ok.includes(file.type) && !file.name.match(/\.(xls|xlsx)$/i)) {
      cToast('⛔ Formato no permitido: ' + file.name, 'err'); return;
    }
    if (cFiles.find(f => f.file.name===file.name && f.file.size===file.size)) return;
    const isImage = file.type.startsWith('image/');
    cFiles.push({ file, url: URL.createObjectURL(file), isImage });
  });
  cRenderFiles();
}

function cRenderFiles() {
  const c = document.getElementById('cFilePreview');
  c.innerHTML = '';
  cFiles.forEach((item, idx) => {
    if (item.isImage) {
      const w = document.createElement('div');
      w.className = 'c-thumb-wrap';
      w.innerHTML = `
        <img src="${item.url}" class="c-thumb-img" onclick="cOpenLb('${item.url}')"/>
        <button class="c-thumb-rm" onclick="cRemoveFile(${idx})">✕</button>
        <div class="c-thumb-name">${cTrunc(item.file.name,12)}</div>`;
      c.appendChild(w);
    } else {
      const ch = document.createElement('div');
      ch.className = 'c-file-chip';
      ch.innerHTML = `📊 ${cTrunc(item.file.name,26)} <span class="c-chip-rm" onclick="cRemoveFile(${idx})">✕</span>`;
      c.appendChild(ch);
    }
  });
}

function cRemoveFile(idx) {
  URL.revokeObjectURL(cFiles[idx].url);
  cFiles.splice(idx, 1);
  cRenderFiles();
}

// ── LIGHTBOX ───────────────────────────────────
function cOpenLb(url) {
  document.getElementById('cLbImg').src = url;
  document.getElementById('cLightbox').classList.remove('hidden');
}
function cCloseLb() {
  document.getElementById('cLightbox').classList.add('hidden');
  document.getElementById('cLbImg').src = '';
}

// ── ENVIAR (AMBOS MODOS EN UN SOLO BOTÓN) ──────
async function cEnviar() {
  if (!coordKey) { cToast('⚠️ Selecciona tu coordinación primero', 'err'); return; }
  if (!db)       { cToast('⚠️ Sin conexión a la base de datos', 'err'); return; }

  // Guardar tab actual antes de leer
  saveCurrent();

  const casos    = cData.agenda.casos.trim();
  const exito    = cData.reporte.exito.trim();
  const pend     = cData.reporte.pendiente.trim();
  const hasAgenda  = !!casos;
  const hasReporte = !!(exito || pend);

  if (!hasAgenda && !hasReporte) {
    cToast('⚠️ Completa al menos un campo de Agenda o Reporte antes de enviar', 'err');
    return;
  }

  // Preparar miniaturas base64
  const archivos = await Promise.all(cFiles.map(async item => ({
    nombre:   item.file.name,
    tipo:     item.file.type,
    esImagen: item.isImage,
    tamaño:   item.file.size,
    preview:  item.isImage ? await toBase64Thumb(item.file) : null
  })));

  const coord = COORDS[coordKey];
  const fecha = new Date().toISOString().split('T')[0];

  // Construir registros a insertar
  const payloads = [];
  if (hasAgenda) {
    payloads.push({
      coord_key: coordKey, coord_label: coord.label, coord_name: coord.name,
      modo: 'agenda', fecha, casos, exito: null, pendiente: null, archivos
    });
  }
  if (hasReporte) {
    payloads.push({
      coord_key: coordKey, coord_label: coord.label, coord_name: coord.name,
      modo: 'reporte', fecha, casos: null, exito, pendiente: pend, archivos
    });
  }

  // Deshabilitar botón
  const btn = document.getElementById('cBtnSend');
  btn.disabled = true;
  document.getElementById('cBtnIcon').textContent = '⏳';
  document.getElementById('cBtnText').textContent = 'Enviando...';

  try {
    for (const payload of payloads) {
      const { error } = await db.from('envios').insert(payload);
      if (error) throw error;
    }

    const label = payloads.length > 1
      ? '✅ Agenda y Reporte enviados al módulo central'
      : `✅ ${payloads[0].modo === 'agenda' ? 'Agenda' : 'Reporte'} enviado al módulo central`;

    cToast(label, 'ok');
    clearForm();
    loadHistorial();
  } catch (e) {
    cToast('⛔ Error al enviar: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    document.getElementById('cBtnIcon').textContent = '📤';
    document.getElementById('cBtnText').textContent = 'Enviar al módulo central';
    updateSendStatus();
  }
}

// ── CONVERTIR IMAGEN A BASE64 THUMBNAIL ────────
function toBase64Thumb(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        const ratio = Math.min(MAX/img.width, MAX/img.height);
        canvas.width  = img.width  * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── LIMPIAR FORMULARIO ─────────────────────────
function clearForm() {
  // Limpiar estado en memoria
  cData.agenda.casos      = '';
  cData.reporte.exito     = '';
  cData.reporte.pendiente = '';
  // Limpiar textareas
  ['cCasos','cExito','cPendiente'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  cFiles = [];
  cRenderFiles();
  document.getElementById('cFileInput').value = '';
  updateSendStatus();
}

// ── HISTORIAL ──────────────────────────────────
async function loadHistorial() {
  if (!db || !coordKey) return;
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await db
    .from('envios')
    .select('*')
    .eq('coord_key', coordKey)
    .eq('fecha', today)
    .order('enviado_en', { ascending: false });

  const c = document.getElementById('historialList');
  if (error || !data || !data.length) {
    c.innerHTML = '<p class="c-empty">Sin envíos registrados hoy.</p>';
    return;
  }

  c.innerHTML = data.map(row => {
    const time    = new Date(row.enviado_en).toLocaleTimeString('es-VE', { hour:'2-digit', minute:'2-digit' });
    const preview = row.modo === 'agenda' ? row.casos : (row.exito || row.pendiente);
    const archivos = (row.archivos || []);
    const fileNote = archivos.length ? `<div class="h-files">📎 ${archivos.length} archivo(s): ${archivos.map(a=>a.nombre).join(', ')}</div>` : '';
    const thumbs = archivos.filter(a=>a.esImagen && a.preview)
      .map(a=>`<img src="${a.preview}" style="width:48px;height:36px;object-fit:cover;border-radius:5px;border:1px solid var(--border);cursor:pointer" onclick="cOpenLb('${a.preview}')" />`)
      .join('');

    return `<div class="h-card">
      <div class="h-card-header">
        <span class="h-badge h-badge-${row.modo}">${row.modo === 'agenda' ? '📋 AGENDA' : '📊 REPORTE'}</span>
        <span class="h-time">🕐 ${time}</span>
      </div>
      <div class="h-preview">${cEscHtml(preview || '')}</div>
      ${thumbs ? `<div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">${thumbs}</div>` : ''}
      ${fileNote}
    </div>`;
  }).join('');
}

// ── HELPERS ────────────────────────────────────
function setStatus(msg, type) {
  const el = document.getElementById('connStatus');
  el.textContent = msg;
  el.className = `c-status ${type}`;
}
function cTrunc(s, max) { return s.length > max ? s.slice(0,max-1)+'…' : s; }
function cEscHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let _cToastTimer = null;
function cToast(msg, type='') {
  const t = document.getElementById('cToast');
  t.textContent = msg; t.className = `c-toast ${type}`;
  clearTimeout(_cToastTimer);
  _cToastTimer = setTimeout(() => { t.className = 'c-toast hidden'; }, 3500);
}
