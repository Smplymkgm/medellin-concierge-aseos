import { getAllAseos, asignarAseo, moverAseo, getPersonal as getPersonalApi, actualizarPersonal } from '../api.js';
import { logout }                  from '../router.js';
import icons                       from '../components/icons.js';
import { renderNavAdmin }          from '../components/bottom-nav.js';
import { MiniCalendar }            from '../components/calendar.js';
import { openModal, closeModal, setModalContent } from '../components/modal.js';
import { showToast }               from './toast.js';
import {
  renderAseoCardAdmin, isUrgent, formatCOP, formatFecha, parseDate, isToday
} from '../components/aseo-card.js';

let _aseos     = null;
let _personal  = null;
let _activeTab = 'aseos';
let _filtroAseadora = '';
let _cal       = null;
let _calSelected = null;

// ── Shell ──────────────────────────────────────────────────────

export function renderAdmin() {
  return `
  <div class="header">
    <div>
      <div class="header-title">Admin</div>
      <div class="header-sub" id="adm-sub">Medellin Concierge</div>
    </div>
    <button class="header-action" id="adm-logout" title="Cerrar sesión">
      ${icons.get('logout', 20)}
    </button>
  </div>
  <div class="content" id="adm-content"></div>
  ${renderNavAdmin('aseos')}`;
}

// ── Init ───────────────────────────────────────────────────────

export function initAdmin() {
  document.getElementById('adm-logout').addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) logout();
  });

  // Wire bottom nav
  document.getElementById('adm-nav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });
}

export function destroyAdmin() {
  _aseos = null; _personal = null; _cal = null; _calSelected = null;
}

export async function activateAdmin() {
  await loadData();
  switchTab(_activeTab);
}

async function loadData() {
  try {
    _aseos    = await getAllAseos();
    _personal = await getPersonalApi();
  } catch(e) {
    showError(e.message);
  }
}

// ── Tab switching ──────────────────────────────────────────────

function switchTab(tab) {
  _activeTab = tab;
  document.querySelectorAll('#adm-nav .nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  if      (tab === 'aseos')       renderAseos();
  else if (tab === 'calendario')  renderCalendarioAdmin();
  else if (tab === 'propiedades') renderPropiedadesTab();
  else if (tab === 'personal')    renderPersonalTab();
}

// ── Aseos ─────────────────────────────────────────────────────

function renderAseos() {
  const content = document.getElementById('adm-content');
  if (!_aseos) { content.innerHTML = `<div class="loader"><div class="spinner"></div></div>`; return; }

  const aseadoras = [...new Set((_aseos || []).map(a => a.aseadora).filter(Boolean))].sort();

  let filtered = _aseos;
  if (_filtroAseadora) filtered = filtered.filter(a => a.aseadora === _filtroAseadora);

  // Stats
  const hoy       = filtered.filter(a => isToday(a.checkout));
  const pendientes = filtered.filter(a => !a.aseadora);
  const completados = filtered.filter(a => a.estado === 'Completado');

  let html = `
    <div class="stats-row" style="margin-bottom:var(--sp-4)">
      <div class="stat-card">
        <div class="stat-label">Hoy</div>
        <div class="stat-value accent">${hoy.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Sin asignar</div>
        <div class="stat-value">${pendientes.length}</div>
      </div>
    </div>
    <div class="filter-bar">
      <button class="filter-chip${!_filtroAseadora ? ' active' : ''}" data-filter="">Todos</button>
      ${aseadoras.map(a => `
        <button class="filter-chip${_filtroAseadora === a ? ' active' : ''}" data-filter="${a}">${a}</button>
      `).join('')}
    </div>`;

  if (!filtered.length) {
    html += `<div class="empty-state">
      ${icons.get('list', 40)}
      <p class="empty-state-title">Sin aseos</p>
    </div>`;
    content.innerHTML = html;
    return;
  }

  html += filtered.map(a => renderAseoCardAdmin(a)).join('');
  content.innerHTML = html;

  // Filter chips
  content.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      _filtroAseadora = chip.dataset.filter;
      renderAseos();
    });
  });

  // Card actions
  content.querySelectorAll('[data-action="asignar"]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalAsignar(btn.dataset.codigo));
  });
  content.querySelectorAll('[data-action="mover"]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalMover(btn.dataset.codigo));
  });
}

// ── Modal Asignar ─────────────────────────────────────────────

function abrirModalAsignar(codigo) {
  const aseo = _aseos.find(a => a.codigo === codigo);
  if (!aseo) return;

  const aseadoras = (_personal || []).map(p => p.nombre);

  openModal(`Asignar — ${aseo.propiedad}`, `
    <div class="field">
      <label class="field-label">Aseadora</label>
      <select class="field-input" id="asignar-select">
        <option value="">Sin asignar</option>
        ${aseadoras.map(a => `
          <option value="${a}" ${aseo.aseadora === a ? 'selected' : ''}>${a}</option>
        `).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-full" id="asignar-confirm">
      ${icons.get('user', 16)} Confirmar asignación
    </button>
    <button class="btn btn-ghost btn-full" style="margin-top:8px" id="asignar-cancel">Cancelar</button>
  `);

  document.getElementById('asignar-cancel').addEventListener('click', closeModal);
  document.getElementById('asignar-confirm').addEventListener('click', async () => {
    const aseadora = document.getElementById('asignar-select').value;
    const btn = document.getElementById('asignar-confirm');
    btn.disabled = true;
    try {
      await asignarAseo(codigo, aseadora);
      const idx = _aseos.findIndex(a => a.codigo === codigo);
      if (idx !== -1) _aseos[idx].aseadora = aseadora;
      closeModal();
      showToast(`Asignado a ${aseadora || 'nadie'}`, 'success');
      renderAseos();
    } catch(e) {
      showToast(e.message, 'error');
      btn.disabled = false;
    }
  });
}

// ── Modal Mover ───────────────────────────────────────────────

function abrirModalMover(codigo) {
  const aseo = _aseos.find(a => a.codigo === codigo);
  if (!aseo) return;

  // Convert dd/MM/yyyy to yyyy-MM-dd for date input
  const toInputDate = (str) => {
    const p = str.split('/');
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
  };

  openModal(`Mover checkout — ${aseo.propiedad}`, `
    <div class="field">
      <label class="field-label">Fecha actual</label>
      <p style="font-size:14px;color:var(--text-secondary);padding:8px 0">${formatFecha(aseo.checkout)} (${aseo.checkout})</p>
    </div>
    <div class="field">
      <label class="field-label">Nueva fecha de checkout</label>
      <input type="date" class="field-input" id="mover-fecha" value="${toInputDate(aseo.checkout)}">
    </div>
    <button class="btn btn-primary btn-full" id="mover-confirm">
      ${icons.get('calendar', 16)} Confirmar cambio
    </button>
    <button class="btn btn-ghost btn-full" style="margin-top:8px" id="mover-cancel">Cancelar</button>
  `);

  document.getElementById('mover-cancel').addEventListener('click', closeModal);
  document.getElementById('mover-confirm').addEventListener('click', async () => {
    const inputDate = document.getElementById('mover-fecha').value;
    if (!inputDate) { showToast('Selecciona una fecha', 'error'); return; }
    const p = inputDate.split('-');
    const nuevaFecha = `${p[2]}/${p[1]}/${p[0]}`;
    const btn = document.getElementById('mover-confirm');
    btn.disabled = true;
    try {
      await moverAseo(codigo, nuevaFecha);
      const idx = _aseos.findIndex(a => a.codigo === codigo);
      if (idx !== -1) _aseos[idx].checkout = nuevaFecha;
      closeModal();
      showToast('Fecha actualizada', 'success');
      renderAseos();
    } catch(e) {
      showToast(e.message, 'error');
      btn.disabled = false;
    }
  });
}

// ── Calendario Admin ──────────────────────────────────────────

function renderCalendarioAdmin() {
  const content = document.getElementById('adm-content');
  if (!_aseos) { content.innerHTML = `<div class="loader"><div class="spinner"></div></div>`; return; }

  content.innerHTML = `
    <div id="adm-cal-wrap" style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--sp-3) var(--sp-4);margin-bottom:var(--sp-4)"></div>
    <div id="adm-cal-list"></div>`;

  const events = _aseos.map(a => ({
    date: a.checkout, estado: a.estado, urgente: isUrgent(a)
  }));

  _cal = new MiniCalendar(
    document.getElementById('adm-cal-wrap'),
    {
      events,
      onDayClick: (dateStr) => {
        _calSelected = dateStr;
        renderCalDayListAdmin(dateStr);
      }
    }
  );

  if (_calSelected) renderCalDayListAdmin(_calSelected);
}

function renderCalDayListAdmin(dateStr) {
  const list = document.getElementById('adm-cal-list');
  if (!list) return;
  const day = (_aseos || []).filter(a => a.checkout === dateStr);
  if (!day.length) {
    list.innerHTML = `<p style="text-align:center;color:var(--text-tertiary);padding:var(--sp-4);font-size:13px">Sin aseos este día</p>`;
    return;
  }
  list.innerHTML = `<div class="section-header">
    <span class="section-title">${formatFecha(dateStr)}</span>
    <span class="section-count">${day.length}</span>
  </div>` + day.map(a => renderAseoCardAdmin(a)).join('');
  list.querySelectorAll('[data-action="asignar"]').forEach(btn =>
    btn.addEventListener('click', () => abrirModalAsignar(btn.dataset.codigo)));
  list.querySelectorAll('[data-action="mover"]').forEach(btn =>
    btn.addEventListener('click', () => abrirModalMover(btn.dataset.codigo)));
}

// ── Propiedades tab (delegates to propiedades.js) ─────────────

function renderPropiedadesTab() {
  const content = document.getElementById('adm-content');
  content.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  // Dynamic import to keep bundle split
  import('./propiedades.js').then(m => m.renderPropiedades(content));
}

// ── Personal ─────────────────────────────────────────────────

function renderPersonalTab() {
  const content = document.getElementById('adm-content');
  if (!_personal) { content.innerHTML = `<div class="loader"><div class="spinner"></div></div>`; return; }

  let html = `<div class="card">`;
  for (const p of _personal) {
    html += `
    <div class="list-item" data-nombre="${p.nombre}">
      <div class="list-item-icon">${icons.get('user', 18)}</div>
      <div class="list-item-body">
        <div class="list-item-title">${p.nombre}</div>
        <div class="list-item-sub">${formatCOP(p.gananciaTotal)} ganados · ${p.email || 'Sin email'}</div>
      </div>
      <div class="list-item-end">${icons.get('chevron-right', 16)}</div>
    </div>`;
  }
  html += `</div>`;
  content.innerHTML = html;

  content.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', () => abrirModalPersonal(item.dataset.nombre));
  });
}

function abrirModalPersonal(nombre) {
  const p = _personal.find(x => x.nombre === nombre);
  if (!p) return;

  openModal(`Editar — ${p.nombre}`, `
    <div class="field">
      <label class="field-label">Email</label>
      <input class="field-input" id="per-email" type="email" value="${p.email || ''}">
    </div>
    <div class="field">
      <label class="field-label">Teléfono</label>
      <input class="field-input" id="per-tel" type="tel" value="${p.telefono || ''}">
    </div>
    <div class="field">
      <label class="field-label">Nuevo PIN (dejar vacío para no cambiar)</label>
      <input class="field-input" id="per-pin" type="text" inputmode="numeric" maxlength="4" placeholder="4 dígitos">
    </div>
    <div class="field">
      <label class="field-label">URL Carpeta Drive Videos</label>
      <input class="field-input" id="per-carpeta" type="url" value="${p.carpeta || ''}">
    </div>
    <div class="detail-section">
      <div class="detail-row">
        <span class="detail-key">Total ganado</span>
        <span class="detail-val">${formatCOP(p.gananciaTotal)}</span>
      </div>
    </div>
    <button class="btn btn-primary btn-full" id="per-save">
      ${icons.get('check', 16)} Guardar cambios
    </button>
    <button class="btn btn-ghost btn-full" style="margin-top:8px" id="per-cancel">Cancelar</button>
  `);

  document.getElementById('per-cancel').addEventListener('click', closeModal);
  document.getElementById('per-save').addEventListener('click', async () => {
    const datos = {
      email:    document.getElementById('per-email').value.trim(),
      telefono: document.getElementById('per-tel').value.trim(),
      carpeta:  document.getElementById('per-carpeta').value.trim(),
    };
    const pin = document.getElementById('per-pin').value.trim();
    if (pin) datos.pin = pin;
    const btn = document.getElementById('per-save');
    btn.disabled = true;
    try {
      await actualizarPersonal(nombre, datos);
      // Update local cache
      const idx = _personal.findIndex(x => x.nombre === nombre);
      if (idx !== -1) Object.assign(_personal[idx], datos);
      closeModal();
      showToast('Datos actualizados', 'success');
      renderPersonalTab();
    } catch(e) {
      showToast(e.message, 'error');
      btn.disabled = false;
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────

function showError(msg) {
  const content = document.getElementById('adm-content');
  if (content) content.innerHTML = `<div class="empty-state">
    ${icons.get('alert', 40)}
    <p class="empty-state-title">Error al cargar</p>
    <p class="empty-state-sub">${msg}</p>
    <button class="btn btn-secondary" onclick="location.reload()">Reintentar</button>
  </div>`;
}
