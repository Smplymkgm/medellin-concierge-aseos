import { getAseos, completarAseo } from '../api.js';
import { getNombre }               from '../auth.js';
import { logout }                  from '../router.js';
import icons                       from '../components/icons.js';
import { renderNavAseadora }       from '../components/bottom-nav.js';
import { MiniCalendar }            from '../components/calendar.js';
import { openModal, closeModal }   from '../components/modal.js';
import { showToast }               from './toast.js';
import {
  renderAseoCard, isToday, isUrgent, formatCOP, formatFecha, parseDate
} from '../components/aseo-card.js';

let _data      = null;   // { proximos, historial, totalGanado }
let _activeTab = 'hoy';
let _cal       = null;
let _calDateSelected = null;

// ── Shell ──────────────────────────────────────────────────────

export function renderAseadora() {
  return `
  <div class="header">
    <div>
      <div class="header-title" id="ase-title">Mis Aseos</div>
      <div class="header-sub" id="ase-sub"></div>
    </div>
    <button class="header-action" id="ase-logout" title="Cerrar sesión">
      ${icons.get('logout', 20)}
    </button>
  </div>
  <div class="tab-bar" id="ase-tabs">
    <button class="tab-btn active" data-tab="hoy">Hoy</button>
    <button class="tab-btn" data-tab="proximos">Próximos</button>
    <button class="tab-btn" data-tab="calendario">Calendario</button>
    <button class="tab-btn" data-tab="historial">Historial</button>
  </div>
  <div class="content" id="ase-content"></div>
  ${renderNavAseadora('hoy')}`;
}

// ── Init ───────────────────────────────────────────────────────

export function initAseadora() {
  document.getElementById('ase-logout').addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) logout();
  });
  document.getElementById('ase-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });
}

export function destroyAseadora() {
  _data = null; _cal = null; _calDateSelected = null;
}

// Called when screen becomes active
export async function activateAseadora() {
  const nombre = getNombre();
  document.getElementById('ase-title').textContent = `Hola, ${nombre}`;

  showLoading();
  try {
    _data = await getAseos(nombre);
    switchTab(_activeTab);
  } catch (e) {
    showError(e.message);
  }
}

// ── Tab switching ──────────────────────────────────────────────

function switchTab(tab) {
  _activeTab = tab;
  document.querySelectorAll('#ase-tabs .tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  if      (tab === 'hoy')        renderHoy();
  else if (tab === 'proximos')   renderProximos();
  else if (tab === 'calendario') renderCalendario();
  else if (tab === 'historial')  renderHistorial();
}

// ── Hoy ───────────────────────────────────────────────────────

function renderHoy() {
  if (!_data) { showLoading(); return; }
  const hoy = (_data.proximos || []).filter(a => isToday(a.checkout));

  const content = document.getElementById('ase-content');
  if (!hoy.length) {
    content.innerHTML = `<div class="empty-state">
      ${icons.get('check', 40)}
      <p class="empty-state-title">Nada para hoy</p>
      <p class="empty-state-sub">No tienes aseos programados para hoy</p>
    </div>`;
    return;
  }

  // Urgentes primero (same-day turnaround: checkin also today)
  const urgentes  = hoy.filter(a => isToday(a.checkin));
  const normales  = hoy.filter(a => !isToday(a.checkin));
  const ordenados = [...urgentes, ...normales];

  content.innerHTML = ordenados.map(a => renderAseoCard(a, { onCompletar: true })).join('');
  content.querySelectorAll('[data-action="completar"]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalCompletar(btn.dataset.codigo));
  });
}

// ── Próximos ──────────────────────────────────────────────────

function renderProximos() {
  if (!_data) { showLoading(); return; }
  const proximos = (_data.proximos || []).filter(a => !isToday(a.checkout));
  const content  = document.getElementById('ase-content');

  if (!proximos.length) {
    content.innerHTML = `<div class="empty-state">
      ${icons.get('calendar', 40)}
      <p class="empty-state-title">No hay próximos aseos</p>
      <p class="empty-state-sub">Cuando se asignen nuevos aseos aparecerán aquí</p>
    </div>`;
    return;
  }

  // Group by month
  const byMonth = {};
  for (const a of proximos) {
    const d = parseDate(a.checkout);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!byMonth[key]) byMonth[key] = { label: getMesAnio(a.checkout), items: [] };
    byMonth[key].items.push(a);
  }

  let html = '';
  for (const key of Object.keys(byMonth).sort()) {
    const g = byMonth[key];
    html += `<div class="section-header">
      <span class="section-title">${g.label}</span>
      <span class="section-count">${g.items.length}</span>
    </div>`;
    html += g.items.map(a => renderAseoCard(a, {})).join('');
  }
  content.innerHTML = html;
}

// ── Calendario ────────────────────────────────────────────────

function renderCalendario() {
  if (!_data) { showLoading(); return; }
  const content = document.getElementById('ase-content');
  content.innerHTML = `
    <div id="ase-cal-wrap" style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--sp-3) var(--sp-4);margin-bottom:var(--sp-4)"></div>
    <div id="ase-cal-list"></div>`;

  const allAseos = [...(_data.proximos || []), ...(_data.historial || [])];
  const events   = allAseos.map(a => ({
    date: a.checkout, estado: a.estado, urgente: isUrgent(a)
  }));

  _cal = new MiniCalendar(
    document.getElementById('ase-cal-wrap'),
    {
      events,
      onDayClick: (dateStr) => renderCalDayList(dateStr, allAseos),
    }
  );

  if (_calDateSelected) renderCalDayList(_calDateSelected, allAseos);
}

function renderCalDayList(dateStr, allAseos) {
  _calDateSelected = dateStr;
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

  const totalGanado = _data.totalGanado || 0;
  const completados = historial.filter(a => a.estado === 'Completado').length;

  let html = `
    <div class="stats-row" style="margin-bottom:var(--sp-4)">
      <div class="stat-card">
        <div class="stat-label">Total ganado</div>
        <div class="stat-value accent">${formatCOP(totalGanado)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completados</div>
        <div class="stat-value">${completados}</div>
      </div>
    </div>`;

  if (!historial.length) {
    html += `<div class="empty-state">
      ${icons.get('clock', 40)}
      <p class="empty-state-title">Sin historial todavía</p>
    </div>`;
    content.innerHTML = html;
    return;
  }

  // Group by month
  const byMonth = {};
  for (const a of historial) {
    const d = parseDate(a.checkout);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
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
            <span>${icons.get('calendar', 13)} ${formatFecha(a.checkout)}</span>
            ${a.precio ? `<span class="precio">${formatCOP(a.precio)}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  content.innerHTML = html;
}

// ── Modal completar aseo ───────────────────────────────────────

function abrirModalCompletar(codigo) {
  const allAseos = [...(_data.proximos || []), ...(_data.historial || [])];
  const aseo = allAseos.find(a => a.codigo === codigo);
  if (!aseo) return;

  openModal(`Completar aseo — ${aseo.propiedad}`, `
    <div class="detail-section">
      <div class="detail-row">
        <span class="detail-key">Propiedad</span>
        <span class="detail-val">${aseo.propiedad}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Checkout</span>
        <span class="detail-val">${formatFecha(aseo.checkout)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Precio</span>
        <span class="detail-val">${formatCOP(aseo.precio)}</span>
      </div>
    </div>

    ${aseo.accesos && aseo.accesos.length ? `
      <div class="detail-section">
        <div class="detail-section-title">Accesos</div>
        ${aseo.accesos.map(a => `
          <div class="acceso-item">${icons.get('key', 14)} ${a}</div>
        `).join('')}
      </div>
    ` : ''}

    <div class="field">
      <label class="field-label">Notas del aseo (opcional)</label>
      <textarea class="field-input" id="modal-notas" rows="3" placeholder="Algo que reportar..."></textarea>
    </div>

    <div class="field">
      <label class="field-label">Video (opcional)</label>
      <input type="url" class="field-input" id="modal-video-link" placeholder="Link del video Drive...">
      <p class="field-hint">O sube un video:</p>
      <input type="file" id="modal-video-file" accept="video/*" style="margin-top:4px;width:100%">
    </div>

    <button class="btn btn-primary btn-full" id="modal-confirm-btn">
      ${icons.get('check', 16)} Marcar como completado
    </button>
    <button class="btn btn-ghost btn-full" style="margin-top:8px" id="modal-cancel-btn">
      Cancelar
    </button>
  `);

  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-confirm-btn').addEventListener('click', () => doCompletar(aseo));
}

async function doCompletar(aseo) {
  const btn       = document.getElementById('modal-confirm-btn');
  const notasEl   = document.getElementById('modal-notas');
  const videoLinkEl = document.getElementById('modal-video-link');
  const notas     = notasEl ? notasEl.value.trim() : '';
  const videoLink = videoLinkEl ? videoLinkEl.value.trim() : '';

  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Guardando...`;

  try {
    await completarAseo(aseo.codigo, getNombre(), notas, videoLink);
    closeModal();
    showToast('Aseo completado', 'success');
    // Refresh data
    _data = await getAseos(getNombre());
    switchTab(_activeTab);
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = `${icons.get('check', 16)} Intentar de nuevo`;
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
    ${icons.get('alert', 40)}
    <p class="empty-state-title">Error</p>
    <p class="empty-state-sub">${msg}</p>
    <button class="btn btn-secondary" onclick="location.reload()">Reintentar</button>
  </div>`;
}

function getMesAnio(fechaStr) {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const p = fechaStr.split('/');
  if (p.length !== 3) return '';
  return MESES[parseInt(p[1]) - 1] + ' ' + p[2];
}
