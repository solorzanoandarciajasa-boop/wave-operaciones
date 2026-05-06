/* ══════════════════════════════════════════════
   WAVE – app.js  v3  (módulo central + sync)
══════════════════════════════════════════════ */
'use strict';

// ── ESTADO ─────────────────────────────────────
const state = {
  mode: 'agenda',
  entries: [],        // entradas locales
  remoteEntries: [],  // entradas recibidas de coordinadores vía Supabase
  attachedFiles: [],
  nextId: 1,
  db: null            // cliente Supabase
};

// ── CATÁLOGO DE COORDINACIONES ─────────────────
const COORDS = {
  soporte:      { label: 'COORD SOPORTE NIVEL 1',               name: 'Alejandro Gómez', emoji: '🔧', cssClass: 'coord-soporte'       },
  ampliacion:   { label: 'COORD AMPLIACIÓN (INFRAESTRUCTURA)',   name: 'José Marval',     emoji: '🏗️', cssClass: 'coord-ampliacion'    },
  construccion: { label: 'COORD CONSTRUCCIÓN',                   name: 'Francisco Silva', emoji: '🦺', cssClass: 'coord-construccion'  },
  instalaciones:{ label: 'COORD INSTALACIONES / SOPORTE PIMES', name: 'Miguel Rojas',    emoji: '📡', cssClass: 'coord-instalaciones' },
  servicios:    { label: 'COORD SERVICIOS GENERALES',            name: 'Roberto Gómez',   emoji: '⚙️', cssClass: 'coord-servicios'     }
};
const COORD_ORDER = ['soporte','ampliacion','construccion','instalaciones','servicios'];

const MODE_INFO = {
  agenda:  '📋 <strong>AGENDA</strong> — Registra los casos y actividades planificadas para el día siguiente por cada coordinación.',
  reporte: '📊 <strong>REPORTE</strong> — Registra los casos atendidos exitosamente y aquellos que quedaron pendientes con su justificación.'
};

// ── CONSTANTES ESTRATÉGICAS ────────────────────
const FRASES_VICTORIA = [
  'Toda restricción operacional identificada a tiempo es, en sí misma, una ventaja táctica.',
  'El equipo que conoce sus frentes pendientes está a mitad del camino hacia la victoria.',
  'La constancia en la ejecución es la forma más silenciosa de imponerse.'
];

// ── INIT ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  setMode('agenda');
  initParticles();
  initDragDrop();
  renderEntries();
  initSync();  // Sincronización con coordinadores
});

// ── RELOJ ──────────────────────────────────────
function initClock() {
  const DAYS   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function tick() {
    const n = new Date();
    document.getElementById('liveClock').textContent =
      `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
    document.getElementById('headerDate').textContent =
      `${DAYS[n.getDay()]}, ${n.getDate()} de ${MONTHS[n.getMonth()]} de ${n.getFullYear()}`;
  }
  tick(); setInterval(tick, 1000);
}

// ── PARTÍCULAS ─────────────────────────────────
function initParticles() {
  const c = document.getElementById('particles');
  const cols = ['#00C6FF','#0072FF','#7B2FBE','#00E676','#FFB300'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const sz = Math.random()*4+2;
    p.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;`+
      `background:${cols[Math.floor(Math.random()*cols.length)]};`+
      `animation-duration:${Math.random()*20+15}s;animation-delay:${Math.random()*20}s;`;
    c.appendChild(p);
  }
}

// ── DRAG & DROP ────────────────────────────────
function initDragDrop() {
  const z = document.getElementById('dropZone');
  z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('drag-over'); });
  z.addEventListener('dragleave', () => z.classList.remove('drag-over'));
  z.addEventListener('drop', e => { e.preventDefault(); z.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
}

// ── MODO ───────────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  document.getElementById('modeInfo').innerHTML = MODE_INFO[mode];
  document.getElementById('btnAgenda').classList.toggle('active', mode === 'agenda');
  document.getElementById('btnReporte').classList.toggle('active', mode === 'reporte');
  document.getElementById('agendaFields').classList.toggle('hidden', mode !== 'agenda');
  document.getElementById('reporteFields').classList.toggle('hidden', mode !== 'reporte');
  clearInputs();
  refreshDynamicFields();
}
function refreshDynamicFields() {
  document.getElementById('dynamicFields').classList.toggle('hidden',
    !document.getElementById('coordSelect').value);
}
document.getElementById('coordSelect').addEventListener('change', refreshDynamicFields);

// ── MANEJO DE ARCHIVOS ─────────────────────────
function handleFiles(fileList) {
  const ok = ['image/jpeg','image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  Array.from(fileList).forEach(file => {
    if (!ok.includes(file.type) && !file.name.match(/\.(xls|xlsx)$/i)) {
      showToast(`⛔ Formato no permitido: ${file.name}`, 'error'); return;
    }
    if (state.attachedFiles.find(f => f.file.name===file.name && f.file.size===file.size)) return;
    const isImage = file.type.startsWith('image/');
    state.attachedFiles.push({ file, url: URL.createObjectURL(file), isImage });
  });
  renderFilePreview();
}

function renderFilePreview() {
  const c = document.getElementById('filePreview');
  c.innerHTML = '';
  state.attachedFiles.forEach((item, idx) => {
    if (item.isImage) {
      const w = document.createElement('div');
      w.className = 'thumb-wrap';
      w.innerHTML = `<img src="${item.url}" class="thumb-img" alt="${item.file.name}"
        onclick="openLightbox('${item.url}')" />
        <button class="thumb-remove" onclick="removeFile(${idx})">✕</button>
        <div class="thumb-name">${trunc(item.file.name, 14)}</div>`;
      c.appendChild(w);
    } else {
      const ch = document.createElement('div');
      ch.className = 'file-chip';
      ch.innerHTML = `📊 ${trunc(item.file.name,20)} <span class="chip-remove" onclick="removeFile(${idx})">✕</span>`;
      c.appendChild(ch);
    }
  });
}

function removeFile(idx) {
  URL.revokeObjectURL(state.attachedFiles[idx].url);
  state.attachedFiles.splice(idx,1);
  renderFilePreview();
}

// ── LIGHTBOX ───────────────────────────────────
function openLightbox(url) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightbox').classList.remove('hidden');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightboxImg').src = '';
}

// ── AGREGAR ENTRADA ────────────────────────────
function addEntry() {
  const coordKey = document.getElementById('coordSelect').value;
  if (!coordKey) { showToast('⚠️ Selecciona una coordinación primero', 'error'); return; }

  if (state.mode === 'agenda') {
    const casos = document.getElementById('agendaCasos').value.trim();
    if (!casos) { showToast('⚠️ Ingresa los casos a atender', 'error'); return; }
    state.entries.push({ id: state.nextId++, mode:'agenda', coord:coordKey, casos, files:[...state.attachedFiles] });
  } else {
    const exito     = document.getElementById('reporteExito').value.trim();
    const pendiente = document.getElementById('reportePendiente').value.trim();
    if (!exito && !pendiente) { showToast('⚠️ Ingresa al menos un campo del reporte', 'error'); return; }
    state.entries.push({ id: state.nextId++, mode:'reporte', coord:coordKey, exito, pendiente, files:[...state.attachedFiles] });
  }
  clearInputs();
  renderEntries();
  showToast('✅ Entrada agregada correctamente', 'success');
}

function clearInputs() {
  ['agendaCasos','reporteExito','reportePendiente'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  state.attachedFiles = [];
  renderFilePreview();
  document.getElementById('fileInput').value = '';
}

// ── RENDERIZAR TARJETAS ────────────────────────
function renderEntries() {
  const c = document.getElementById('entryList');
  if (!state.entries.length) {
    c.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📄</div>
      <p>Aún no se han agregado entradas.<br/>Selecciona una coordinación e ingresa la información.</p>
    </div>`; return;
  }
  c.innerHTML = state.entries.map(e => buildCard(e)).join('');
}

function buildCard(entry) {
  const coord = COORDS[entry.coord];
  const modeBadge = entry.mode === 'agenda'
    ? `<span class="entry-mode-badge badge-agenda">📋 AGENDA</span>`
    : `<span class="entry-mode-badge badge-reporte">📊 REPORTE</span>`;
  const preview = entry.mode === 'agenda' ? entry.casos : (entry.exito || entry.pendiente);
  const imgs  = entry.files.filter(f => f.isImage);
  const excls = entry.files.filter(f => !f.isImage);
  const thumbs = imgs.length
    ? `<div class="entry-thumbs">${imgs.map(f=>`<img src="${f.url}" class="entry-thumb" alt="${f.file.name}" onclick="openLightbox('${f.url}')" title="${f.file.name}" />`).join('')}</div>` : '';
  const excelNote = excls.length
    ? `<div class="entry-files">📊 ${excls.map(f=>f.file.name).join(', ')}</div>` : '';

  // Edit form fields
  let editFields = '';
  if (entry.mode === 'agenda') {
    editFields = `<label class="edit-label">📌 Casos a atender:</label>
      <textarea class="edit-textarea" id="edit-casos-${entry.id}">${escHtml(entry.casos)}</textarea>`;
  } else {
    editFields = `<label class="edit-label">✅ Casos atendidos exitosamente:</label>
      <textarea class="edit-textarea" id="edit-exito-${entry.id}">${escHtml(entry.exito||'')}</textarea>
      <label class="edit-label">⚠️ Casos no atendidos y motivo:</label>
      <textarea class="edit-textarea" id="edit-pendiente-${entry.id}">${escHtml(entry.pendiente||'')}</textarea>`;
  }

  return `<div class="entry-card" id="entry-${entry.id}">
    <div class="entry-header">
      <span class="entry-coord ${coord.cssClass}">${coord.emoji} ${coord.label}</span>
      ${modeBadge}
      <div class="entry-btns">
        <button class="entry-edit" onclick="toggleEdit(${entry.id})" title="Editar">✏️</button>
        <button class="entry-delete" onclick="deleteEntry(${entry.id})" title="Eliminar">🗑</button>
      </div>
    </div>
    <div class="entry-view" id="view-${entry.id}">
      <div class="entry-preview">${escHtml(preview)}</div>
      ${thumbs}${excelNote}
    </div>
    <div class="entry-edit-form hidden" id="editform-${entry.id}">
      ${editFields}
      <div class="edit-actions">
        <button class="btn-save-edit" onclick="saveEdit(${entry.id})">💾 Guardar cambios</button>
        <button class="btn-cancel-edit" onclick="toggleEdit(${entry.id})">✕ Cancelar</button>
      </div>
    </div>
  </div>`;
}

function toggleEdit(id) {
  document.getElementById(`view-${id}`).classList.toggle('hidden');
  document.getElementById(`editform-${id}`).classList.toggle('hidden');
}

function saveEdit(id) {
  const entry = state.entries.find(e => e.id === id);
  if (!entry) return;
  if (entry.mode === 'agenda') {
    const v = document.getElementById(`edit-casos-${id}`).value.trim();
    if (!v) { showToast('⚠️ El campo no puede estar vacío', 'error'); return; }
    entry.casos = v;
  } else {
    const ex = document.getElementById(`edit-exito-${id}`).value.trim();
    const pe = document.getElementById(`edit-pendiente-${id}`).value.trim();
    if (!ex && !pe) { showToast('⚠️ Al menos un campo debe tener contenido', 'error'); return; }
    entry.exito = ex; entry.pendiente = pe;
  }
  renderEntries();
  showToast('💾 Cambios guardados', 'success');
}

function deleteEntry(id) {
  state.entries = state.entries.filter(e => e.id !== id);
  renderEntries();
  showToast('🗑️ Entrada eliminada', 'error');
}

function clearAll() {
  if (!state.entries.length) return;
  if (!confirm('¿Deseas eliminar todas las entradas?')) return;
  state.entries = [];
  renderEntries();
  showToast('🗑️ Todo limpiado', 'error');
}

// ── GENERAR DOCUMENTO ──────────────────────────
function generateReport() {
  if (!state.entries.length) { showToast('⚠️ Agrega al menos una entrada antes de generar', 'error'); return; }

  const hasAgenda  = state.entries.some(e => e.mode === 'agenda');
  const hasReporte = state.entries.some(e => e.mode === 'reporte');
  const now        = new Date();
  const tomorrow   = new Date(now); tomorrow.setDate(tomorrow.getDate()+1);
  const DAYS   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const todayStr    = `${DAYS[now.getDay()]} ${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`;
  const tomorrowStr = `${DAYS[tomorrow.getDay()]} ${tomorrow.getDate()} de ${MONTHS[tomorrow.getMonth()]} de ${tomorrow.getFullYear()}`;

  let output = '';
  if (hasAgenda)             output += buildAgendaDoc(tomorrowStr);
  if (hasAgenda && hasReporte) output += '\n\n' + '═'.repeat(50) + '\n\n';
  if (hasReporte)            output += buildReporteDoc(todayStr, now);

  // Galería de imágenes de TODAS las entradas
  const allImages = state.entries.flatMap(e => e.files.filter(f => f.isImage));
  const gallery   = document.getElementById('modalGallery');
  if (allImages.length) {
    gallery.classList.remove('hidden');
    gallery.innerHTML = `<span class="modal-gallery-label">🖼️ Evidencias adjuntas:</span>` +
      allImages.map(f => `<img src="${f.url}" class="modal-gallery-img" alt="${f.file.name}"
        title="${f.file.name}" onclick="openLightbox('${f.url}')" />`).join('');
  } else {
    gallery.classList.add('hidden');
    gallery.innerHTML = '';
  }

  const isAgendaOnly = hasAgenda && !hasReporte;
  const isMixed      = hasAgenda && hasReporte;
  let title = '📄 Documento Generado';
  if (isAgendaOnly)  title = '📋 Agenda — ' + tomorrowStr;
  if (!hasAgenda)    title = '📊 Reporte — ' + todayStr;
  if (isMixed)       title = '📋📊 Agenda + Reporte — ' + todayStr;

  document.getElementById('modalTitle').textContent = title;
  document.getElementById('outputBody').value = output;
  document.getElementById('outputModal').classList.remove('hidden');

  window._reportTitle = isMixed ? 'Agenda_Reporte' : (isAgendaOnly ? 'Agenda' : 'Reporte');
}

// ── AGENDA ─────────────────────────────────────
function buildAgendaDoc(dateStr) {
  const lines = [];
  const entries = state.entries.filter(e => e.mode === 'agenda');
  const totalCoords = new Set(entries.map(e => e.coord)).size;
  const totalCasos  = entries.reduce((a, e) => a + parseLines(e.casos).length, 0);

  lines.push(`📋 *AGENDA OPERACIONAL*`);
  lines.push(`📅 ${dateStr}`);
  lines.push(`⏰ Generado: ${fmtTime(new Date())}`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push('');
  lines.push(`✨ *RESUMEN ESTRATÉGICO*`);
  lines.push(buildSummaryAgenda(totalCoords, totalCasos));
  lines.push('');
  lines.push(`${'─'.repeat(40)}`);
  lines.push('');

  COORD_ORDER.forEach(key => {
    const cEntries = entries.filter(e => e.coord === key);
    if (!cEntries.length) return;
    const coord = COORDS[key];
    lines.push(`${coord.emoji} *${coord.label}*`);
    lines.push(`👤 Coordinador: ${coord.name}`);
    lines.push('');
    lines.push(`📌 *FRENTES OPERACIONALES A EJECUTAR:*`);
    cEntries.forEach(entry => {
      parseLines(entry.casos).forEach(item => lines.push(`  • ${item}`));
      if (entry.files.filter(f=>!f.isImage).length)
        lines.push(`  📎 Ref. documental: ${entry.files.filter(f=>!f.isImage).map(f=>f.file.name).join(', ')}`);
      if (entry.files.filter(f=>f.isImage).length)
        lines.push(`  🖼️ Evidencias fotográficas adjuntas: ${entry.files.filter(f=>f.isImage).length} imagen(es)`);
    });
    lines.push('');
  });

  lines.push(`${'─'.repeat(40)}`);
  lines.push(`_${FRASES_VICTORIA[Math.floor(Math.random()*FRASES_VICTORIA.length)]}_`);
  lines.push(`_Reporte generado automáticamente_`);
  return lines.join('\n');
}

// ── REPORTE ────────────────────────────────────
function buildReporteDoc(dateStr, now) {
  const lines   = [];
  const entries = state.entries.filter(e => e.mode === 'reporte');
  const totalCoords = new Set(entries.map(e => e.coord)).size;
  let totalExito = 0, totalPend = 0;
  entries.forEach(e => {
    if (e.exito)     totalExito += parseLines(e.exito).length;
    if (e.pendiente) totalPend  += parseLines(e.pendiente).length;
  });

  lines.push(`📊 *REPORTE OPERACIONAL DIARIO*`);
  lines.push(`📅 ${dateStr}`);
  lines.push(`⏰ Generado: ${fmtTime(now)}`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push('');
  lines.push(`✨ *RESUMEN ESTRATÉGICO*`);
  lines.push(buildSummaryReporte(totalCoords, totalExito, totalPend));
  lines.push('');
  lines.push(`${'─'.repeat(40)}`);
  lines.push('');

  COORD_ORDER.forEach(key => {
    const cEntries = entries.filter(e => e.coord === key);
    if (!cEntries.length) return;
    const coord = COORDS[key];
    lines.push(`${coord.emoji} *${coord.label}*`);
    lines.push(`👤 Coordinador: ${coord.name}`);
    lines.push('');
    cEntries.forEach(entry => {
      if (entry.exito) {
        lines.push(`✅ *OBJETIVOS MATERIALIZADOS:*`);
        parseLines(entry.exito).forEach(i => lines.push(`  ✔ ${i}`));
        lines.push('');
      }
      if (entry.pendiente) {
        lines.push(`🔄 *FRENTES EN PROCESO DE CONSOLIDACIÓN:*`);
        parseLines(entry.pendiente).forEach(i => lines.push(`  ◎ ${i}`));
        lines.push('');
      }
      const fotos  = entry.files.filter(f => f.isImage);
      const excels = entry.files.filter(f => !f.isImage);
      if (fotos.length)  lines.push(`  🖼️ Evidencias fotográficas: ${fotos.length} imagen(es) adjunta(s)`);
      if (excels.length) lines.push(`  📊 Archivos de soporte: ${excels.map(f=>f.file.name).join(', ')}`);
      if (fotos.length || excels.length) lines.push('');
    });
  });

  const total = totalExito + totalPend;
  const pct   = total > 0 ? Math.round((totalExito / total) * 100) : 100;
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`📈 *INDICADORES DE CIERRE*`);
  lines.push(`  • Coordinaciones en operación: ${totalCoords}`);
  lines.push(`  • Objetivos materializados: ${totalExito}`);
  lines.push(`  • Frentes en consolidación: ${totalPend}`);
  lines.push(`  • Índice de efectividad: ${pct}%`);
  lines.push('');
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`_${FRASES_VICTORIA[Math.floor(Math.random()*FRASES_VICTORIA.length)]}_`);
  lines.push(`_Reporte generado automáticamente_`);
  return lines.join('\n');
}

// ── RESÚMENES ESTRATÉGICOS ─────────────────────
function buildSummaryAgenda(totalCoords, totalCasos) {
  return `Se ha estructurado la agenda operacional del día de mañana con ${totalCasos} frente(s) de actuación distribuidos en ${totalCoords} coordinación(es). Cada objetivo ha sido identificado con precisión táctica para garantizar la continuidad del servicio y el fortalecimiento de la posición operacional del equipo ante los clientes. El conocimiento anticipado del terreno constituye la primera ventaja estratégica.`;
}

function buildSummaryReporte(totalCoords, totalExito, totalPend) {
  const total = totalExito + totalPend;
  const pct   = total > 0 ? Math.round((totalExito / total) * 100) : 100;
  if (totalPend === 0) {
    return `La jornada cierra con una efectividad del ${pct}%, materializando la totalidad de los objetivos planificados en ${totalCoords} coordinación(es). El equipo operacional consolida su posición de excelencia mediante una ejecución disciplinada y sostenida, ratificando el compromiso con la calidad del servicio prestado.`;
  }
  if (pct >= 70) {
    return `La jornada registra una efectividad del ${pct}% sobre ${total} gestión(es) en ${totalCoords} coordinación(es). Los ${totalExito} objetivo(s) materializados reflejan la solidez táctica del equipo. Los ${totalPend} frente(s) en consolidación han sido registrados con precisión, constituyendo el mapa estratégico que orientará la ejecución del día siguiente con mayor contundencia.`;
  }
  return `La jornada operacional en ${totalCoords} coordinación(es) registra ${totalExito} objetivo(s) alcanzado(s) y ${totalPend} frente(s) en proceso de consolidación. La identificación oportuna de cada restricción representa, en sí misma, una victoria táctica: quien conoce con claridad sus obstáculos ya ha ganado la mitad de la siguiente batalla. El equipo mantiene la posición y planifica los movimientos del día siguiente con información precisa.`;
}

// ── MODAL ──────────────────────────────────────
function closeModal() { document.getElementById('outputModal').classList.add('hidden'); }

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(document.getElementById('outputBody').value);
    showToast('✅ Copiado al portapapeles — ¡listo para WhatsApp!', 'success');
  } catch { showToast('⛔ No se pudo copiar automáticamente', 'error'); }
}

function downloadTxt() {
  const txt  = document.getElementById('outputBody').value;
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const n    = new Date();
  const stamp = `${n.getFullYear()}${pad(n.getMonth()+1)}${pad(n.getDate())}`;
  a.href = url; a.download = `${window._reportTitle||'Reporte'}_${stamp}.txt`;
  a.click(); URL.revokeObjectURL(url);
  showToast('⬇️ Archivo descargado', 'success');
}

// ── HELPERS ────────────────────────────────────
function parseLines(text) { return text.split('\n').map(l=>l.trim()).filter(l=>l); }
function fmtTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function pad(n) { return String(n).padStart(2,'0'); }
function trunc(s, max) { return s.length > max ? s.slice(0,max-1)+'…' : s; }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── TOAST ──────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast hidden'; }, 3200);
}

// ══════════════════════════════════════════════
// MÓDULO DE SINCRONIZACIÓN – Supabase Realtime
// ══════════════════════════════════════════════
async function initSync() {
  const syncPanel = document.getElementById('syncList');
  if (!syncPanel) return;

  try {
    const { createClient } = supabase;
    state.db = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { error } = await state.db.from('envios').select('id').limit(1);
    if (error) throw error;

    setSyncStatus('✅ Sincronizado', 'sync-ok');
    await loadRemoteEntries();
    subscribeRemote();
  } catch {
    setSyncStatus('⚠️ Sin conexión – modo local', 'sync-warn');
  }
}

function setSyncStatus(msg, cls) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = `sync-status ${cls}`;
}

async function loadRemoteEntries() {
  if (!state.db) return;
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await state.db
    .from('envios')
    .select('*')
    .eq('fecha', today)
    .order('enviado_en', { ascending: false });

  if (!error && data) {
    state.remoteEntries = data;
    renderSyncPanel(data);
  }
}

function subscribeRemote() {
  if (!state.db) return;
  state.db.channel('central-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'envios' }, () => {
      loadRemoteEntries();
      showToast('🔄 Nuevo envío recibido de coordinadores', 'success');
    })
    .subscribe();
}

function renderSyncPanel(data) {
  const list = document.getElementById('syncList');
  if (!list) return;

  if (!data || !data.length) {
    list.innerHTML = `<p class="sync-empty">Sin envíos de coordinadores hoy.<br/>Los módulos móviles aparecerán aquí en tiempo real.</p>`;
    return;
  }

  // Agrupar por coordinación
  const grouped = {};
  data.forEach(row => {
    if (!grouped[row.coord_key]) grouped[row.coord_key] = [];
    grouped[row.coord_key].push(row);
  });

  list.innerHTML = Object.entries(grouped).map(([key, rows]) => {
    const coord   = COORDS[key] || { label: key, name: '', emoji: '📌', cssClass: '' };
    const agendas = rows.filter(r => r.modo === 'agenda');
    const reportes= rows.filter(r => r.modo === 'reporte');
    const lastAt  = new Date(rows[0].enviado_en).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'});

    // Thumbnails de imágenes
    const allImages = rows.flatMap(r => (r.archivos||[]).filter(a=>a.esImagen && a.preview));
    const thumbHtml = allImages.slice(0,4).map(a =>
      `<img src="${a.preview}" class="sync-thumb" onclick="openLightbox('${a.preview}')" title="${a.nombre}"/>`
    ).join('');

    return `<div class="sync-card">
      <div class="sync-card-header">
        <span class="sync-coord ${coord.cssClass}">${coord.emoji} ${coord.label}</span>
        <span class="sync-time">🕐 ${lastAt}</span>
      </div>
      <div class="sync-badges">
        ${agendas.length  ? `<span class="sync-badge badge-agenda">📋 ${agendas.length} agenda(s)</span>` : ''}
        ${reportes.length ? `<span class="sync-badge badge-reporte">📊 ${reportes.length} reporte(s)</span>` : ''}
      </div>
      ${thumbHtml ? `<div class="sync-thumbs">${thumbHtml}</div>` : ''}
    </div>`;
  }).join('');
}

// Incluye las entradas remotas al generar el documento final
function mergeRemoteToEntries() {
  const merged = [];
  state.remoteEntries.forEach(row => {
    merged.push({
      id:        `r-${row.id}`,
      mode:      row.modo,
      coord:     row.coord_key,
      casos:     row.casos || '',
      exito:     row.exito || '',
      pendiente: row.pendiente || '',
      files:     (row.archivos || []).map(a => ({
        file: { name: a.nombre, type: a.tipo, size: a.tamaño },
        url:  a.preview || '',
        isImage: a.esImagen
      }))
    });
  });
  return merged;
}

// Override del generateReport para incluir remotos
const _originalGenerate = generateReport;
window.generateReport = function() {
  const remote = mergeRemoteToEntries();
  // Combinar con locales (evitar duplicados por coord+mode del mismo día)
  const localKeys = new Set(state.entries.map(e => `${e.coord}-${e.mode}`));
  remote.forEach(r => { if (!localKeys.has(`${r.coord}-${r.mode}`)) state.entries.push(r); });
  _originalGenerate();
  // Limpiar los remotos que se añadieron para no duplicar la próxima vez
  state.entries = state.entries.filter(e => !String(e.id).startsWith('r-'));
};
