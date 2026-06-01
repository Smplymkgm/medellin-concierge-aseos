import { getAseos, completarAseo } from '../api.js?v=3';
import { getNombre }               from '../auth.js?v=3';
import { logout }                  from '../router.js?v=3';
import icons                       from '../components/icons2.js?v=3';
import { MiniCalendar }            from '../components/calendar.js?v=3';
import { openModal, closeModal }   from '../components/modal.js?v=3';
import { showToast }               from './toast.js?v=3';
import {
  renderAseoCard, isToday, isUrgent, formatCOP, formatFecha, parseDate
} from '../components/aseo-card.js?v=3';

let _data      = null;
let _activeTab = 'hoy';
let _cal       = null;
let _calDateSelected = null;
let _loading   = false;

// ── Shell ──────────────────────────────────────────────────────

export function renderAseadora() {
  return `
  <div class="header" style="justify-content:space-between">
    <div>
      <div class="header-title" id="ase-title">Mis Aseos</div>
      <div class="header-sub" id="ase-sub" style="font-size:11px;color:var(--text-tertiary)"></div>
    </div>
    <div style="display:flex;gap:4px">
      <button class="header-action" id="ase-refresh" title="Actualizar">
        ${icons.get('sync', 20)}
      </button>
      <button class="header-action" id="ase-logout" title="Cerrar sesión">
        ${icons.get('logout', 20)}
      </button>
    </div>
  </div>
  <div class="content" id="ase-content" style="padding-bottom:calc(var(--nav-h) + 16px)"></div>
  <nav class="bottom-nav" id="ase-nav">
    <button class="nav-item active" data-tab="hoy">
      ${icons.get('broom', 20)}
      Hoy
    </button>
    <button class="nav-item" data-tab="calendario">
      ${icons.get('calendar', 20)}
      Calendario
    </button>
    <button class="nav-item" data-tab="historial">
      ${icons.get('clock', 20)}
      Historial
    </button>
  </nav>`;
}

// ── Init ───────────────────────────────────────────────────────

export function initAseadora() {
  document.getElementById('ase-logout').addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) logout();
  });

  document.getElementById('ase-refresh').addEventListener('click', () => {
    _data = null;
    loadData();
  });

  document.getElementById('ase-nav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });
}

export function destroyAseadora() {
  _data = null; _cal = null; _calDateSelected = null; _loading = false;
}

export async function activateAseadora() {
  const nombre = getNombre();
  document.getElementById('ase-title').textContent = 'Hola, ' + nombre;
  await loadData();
}

async function loadData() {
  if (_loading) return;
  _loading = true;
  const nombre = getNombre();
  showLoading();
  try {
    _data = await getAseos(nombre);
    const sub = document.getElementById('ase-sub');
    if (sub) sub.textContent = 'Actualizado ahora';
    switchTab(_activeTab);
  } catch (e) {
    showError(e.message);
  } finally {
    _loading = false;
  }
}

// ── Tab switching ──────────────────────────────────────────────

function switchTab(tab) {
  _activeTab = tab;
  document.querySelectorAll('#ase-nav .nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  if      (tab === 'hoy')        renderHoy();
  else if (tab === 'calendario') renderCalendario();
  else if (tab === 'historial')  renderHistorial();
}

// ── Hoy (today + próximos) ────────────────────────────────────

function renderHoy() {
  if (!_data) { showLoading(); return; }
  const content = document.getElementById('ase-content');
  const proximos = _data.proximos || [];
  const hoy      = proximos.filter(a => isToday(a.checkout));
  const proxFut  = proximos.filter(a => !isToday(a.checkout));

  let html = '';

  // ── Hoy ──
  if (!hoy.length) {
    html += `<div class="empty-state" style="padding:var(--sp-6) var(--sp-4)">
      ${icons.get('check', 36)}
      <p class="empty-state-title">Sin aseos hoy</p>
      <p class="empty-state-sub">No tienes aseos programados para hoy</p>
    </div>`;
  } else {
    const urgentes = hoy.filter(a => isToday(a.checkin));
    const normales = hoy.filter(a => !isToday(a.checkin));
    const ordenados = [...urgentes, ...normales];
    html += `<div class="section-header"><span class="section-title">Hoy</span><span class="section-count">${hoy.length}</span></div>`;
    html += ordenados.map(a => renderAseoCard(a, { onCompletar: true })).join('');
  }

  // ── Próximos ──
  if (proxFut.length) {
    html += `<div class="section-header" style="margin-top:var(--sp-6)"><span class="section-title">Próximos</span><span class="section-count">${proxFut.length}</span></div>`;
    html += proxFut.map(a => renderAseoCard(a, {})).join('');
  }

  content.innerHTML = html;
  content.querySelectorAll('[data-action="completar"]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalCompletar(btn.dataset.codigo));
  });
}

// ── Calendario ────────────────────────────────────────────────

function renderCalendario() {
  if (!_data) { showLoading(); return; }
  const content = document.getElementById('ase-content');
  content.innerHTML = `
    <div id="ase-cal-wrap" style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--sp-3) var(--sp-4);margin-bottom:var(--sp-4)"></div>
    <div id="ase-cal-list"></div>`;

  const allAseos = [...(_data.proximos || []), ...(_data.historial || [])];
  const events   = allAseos.map(a => ({ date: a.checkout, estado: a.estado, urgente: isUrgent(a) }));

  _cal = new MiniCalendar(document.getElementById('ase-cal-wrap'), {
    events,
    onDayClick: (dateStr) => {
      _calDateSelected = dateStr;
      renderCalDayList(dateStr, allAseos);
    },
  });

  if (_calDateSelected) renderCalDayList(_calDateSelected, allAseos);
}

function renderCalDayList(dateStr, allAseos) {
  const list = document.getElementById('ase-cal-list');
  if (!list) return;
  const day = allAseos.filter(a => a.checkout === dateStr);
  if (!day.length) {
    list.innerHTML = `<p style="text-align:center;color:var(--text-tertiary);padding:var(--sp-4);font-size:13px">Sin aseos este día</p>`;
    return;
  }
  list.innerHTML = `<div class="section-header">
    <span class="section-title">${formatFecha(dateStr)}</span>
    <span class="section-count">${day.length}</span>
  </div>` + day.map(a => renderAseoCard(a, { onCompletar: isToday(a.checkout) })).join('');
  list.querySelectorAll('[data-action="completar"]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalCompletar(btn.dataset.codigo));
  });
}

// ── Historial ─────────────────────────────────────────────────

function renderHistorial() {
  if (!_data) { showLoading(); return; }
  const historial = _data.historial || [];
  const content   = document.getElementById('ase-content');

  // Calcular mes actual
  const ahora    = new Date();
  const claveHoy = ahora.getFullYear() + '-' + String(ahora.getMonth()+1).padStart(2,'0');
  const estesMes = historial.filter(a => {
    const d = parseDate(a.checkout);
    if (!d) return false;
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') === claveHoy;
  });
  const gananciasMes    = estesMes.filter(a => a.estado === 'Completado').reduce((s,a) => s + a.precio, 0);
  const completadosMes  = estesMes.filter(a => a.estado === 'Completado').length;
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesLabel = MESES[ahora.getMonth()] + ' ' + ahora.getFullYear();

  let html = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">${mesLabel}</div>
        <div class="stat-value accent">${formatCOP(gananciasMes)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Este mes</div>
        <div class="stat-value">${completadosMes} aseo${completadosMes !== 1 ? 's' : ''}</div>
      </div>
    </div>`;

  if (!historial.length) {
    html += `<div class="empty-state">${icons.get('clock', 36)}<p class="empty-state-title">Sin historial todavía</p></div>`;
    content.innerHTML = html;
    return;
  }

  const byMonth = {};
  for (const a of historial) {
    const d = parseDate(a.checkout);
    if (!d) continue;
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    if (!byMonth[key]) byMonth[key] = { label: getMesAnio(a.checkout), items: [], total: 0 };
    byMonth[key].items.push(a);
    if (a.estado === 'Completado') byMonth[key].total += a.precio;
  }

  for (const key of Object.keys(byMonth).sort().reverse()) {
    const g = byMonth[key];
    html += `<div class="section-header">
      <span class="section-title">${g.label}</span>
      <span class="section-count">${formatCOP(g.total)}</span>
    </div>`;
    html += g.items.map(a => `
      <div class="aseo-card" style="margin-bottom:var(--sp-2)">
        <div class="aseo-card-body" style="padding:var(--sp-3) var(--sp-4)">
          <div class="aseo-card-header">
            <span class="aseo-card-prop" style="font-size:14px">${a.propiedad}</span>
            <span class="${a.estado === 'Completado' ? 'badge badge-done' : 'badge badge-neutral'}">${a.estado}</span>
          </div>
          <div class="aseo-card-meta">
            ${icons.get('calendar', 13)} ${formatFecha(a.checkout)}
            ${a.precio ? `&nbsp;&nbsp;<span class="precio">${formatCOP(a.precio)}</span>` : ''}
          </div>
        </div>
      </div>`).join('');
  }
  content.innerHTML = html;
}

// ── Modal completar aseo ───────────────────────────────────────

function abrirModalCompletar(codigo) {
  const allAseos = [...(_data.proximos || []), ...(_data.historial || [])];
  const aseo = allAseos.find(a => a.codigo === codigo);
  if (!aseo) return;

  openModal('Completar — ' + aseo.propiedad, `
    <div class="detail-section">
      <div class="detail-row"><span class="detail-key">Checkout</span><span class="detail-val">${formatFecha(aseo.checkout)}</span></div>
      <div class="detail-row"><span class="detail-key">Precio</span><span class="detail-val precio">${formatCOP(aseo.precio)}</span></div>
    </div>

    ${aseo.accesos && aseo.accesos.length ? `
      <div class="detail-section">
        <div class="detail-section-title">Accesos</div>
        ${aseo.accesos.map(a => `<div class="acceso-item">${icons.get('key', 14)} ${a}</div>`).join('')}
      </div>` : ''}

    <div class="field">
      <label class="field-label">Notas (opcional)</label>
      <textarea class="field-input" id="modal-notas" rows="3" placeholder="Algo que reportar..."></textarea>
    </div>
    <div class="field">
      <label class="field-label">Link video (opcional)</label>
      <input type="url" class="field-input" id="modal-video-link" placeholder="https://drive.google.com/...">
    </div>
    <button class="btn btn-primary btn-full" id="modal-confirm-btn">
      ${icons.get('check', 16)} Marcar completado
    </button>
    <button class="btn btn-ghost btn-full" style="margin-top:8px" id="modal-cancel-btn">Cancelar</button>
  `);

  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-confirm-btn').addEventListener('click', () => doCompletar(aseo));
}

async function doCompletar(aseo) {
  const btn       = document.getElementById('modal-confirm-btn');
  const notas     = document.getElementById('modal-notas')?.value.trim() || '';
  const videoLink = document.getElementById('modal-video-link')?.value.trim() || '';

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto"></div>';

  try {
    await completarAseo(aseo.codigo, getNombre(), notas, videoLink);
    closeModal();
    showToast('Aseo completado', 'success');
    _data = null;
    await loadData();
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = icons.get('check', 16) + ' Intentar de nuevo';
    showToast(e.message, 'error');
  }
}

// ── Helpers ───────────────────────────────────────────────────

function showLoading() {
  const content = document.getElementById('ase-content');
  if (content) content.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
}

function showError(msg) {
  const content = document.getElementById('ase-content');
  if (content) content.innerHTML = `<div class="empty-state">
    ${icons.get('alert', 36)}
    <p class="empty-state-title">Error al cargar</p>
    <p class="empty-state-sub">${msg}</p>
    <button class="btn btn-secondary" style="margin-top:var(--sp-4)" onclick="location.reload()">Reintentar</button>
  </div>`;
}

function getMesAnio(fechaStr) {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const p = String(fechaStr).split('/');
  if (p.length !== 3) return '';
  return MESES[parseInt(p[1]) - 1] + ' ' + p[2];
}
