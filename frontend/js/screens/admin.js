import { getAllAseos, asignarAseo, moverAseo, agregarAseo, getPersonal as getPersonalApi, actualizarPersonal, getFormRespuestas, getPropiedades } from '../api.js?v=10';
import { logout }                  from '../router.js?v=10';
import icons                       from '../components/icons2.js?v=10';
import { MiniCalendar }            from '../components/calendar.js?v=10';
import { openModal, closeModal }   from '../components/modal.js?v=10';
import { showToast }               from './toast.js?v=10';
import {
  renderAseoCardAdmin, isUrgent, formatCOP, formatFecha, parseDate, isToday
} from '../components/aseo-card.js?v=10';

let _aseos       = null;
let _personal    = null;
let _propiedades = null;
let _activeTab = 'aseos';
let _filtroAseadora   = '';
let _filtroAsignacion = 'todos'; // 'todos' | 'asignados' | 'sin_asignar'
let _filtroPeriodo    = 'mes';   // 'mes' | 'anterior' | 'todo'
let _cal       = null;
let _calSelected = null;

// ── Shell ──────────────────────────────────────────────────────

export function renderAdmin() {
  return `
  <div class="header" style="justify-content:space-between">
    <div>
      <div class="header-title">Admin</div>
      <div class="header-sub" id="adm-sub" style="font-size:11px;color:var(--text-tertiary)">Medellin Concierge</div>
    </div>
    <div style="display:flex;gap:4px">
      <button class="header-action" id="adm-refresh" title="Actualizar">
        ${icons.get('sync', 20)}
      </button>
      <button class="header-action" id="adm-logout" title="Cerrar sesión">
        ${icons.get('logout', 20)}
      </button>
    </div>
  </div>
  <div class="content" id="adm-content" style="padding-bottom:calc(var(--nav-h) + 16px)"></div>
  <nav class="bottom-nav" id="adm-nav">
    <button class="nav-item active" data-tab="aseos">
      ${icons.get('list', 20)}
      Aseos
    </button>
    <button class="nav-item" data-tab="calendario">
      ${icons.get('calendar', 20)}
      Calendario
    </button>
    <button class="nav-item" data-tab="propiedades">
      ${icons.get('home', 20)}
      Propiedades
    </button>
    <button class="nav-item" data-tab="personal">
      ${icons.get('users', 20)}
      Personal
    </button>
    <button class="nav-item" data-tab="historial">
      ${icons.get('clock', 20)}
      Historial
    </button>
  </nav>`;
}

// ── Init ───────────────────────────────────────────────────────

export function initAdmin() {
  document.getElementById('adm-logout').addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) logout();
  });

  document.getElementById('adm-refresh').addEventListener('click', async () => {
    _aseos = null; _personal = null;
    await loadData();
    switchTab(_activeTab);
  });

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
    [_aseos, _personal, _propiedades] = await Promise.all([
      getAllAseos(), getPersonalApi(), getPropiedades()
    ]);
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
  else if (tab === 'historial')   renderHistorialAdmin();
}

// ── Aseos ─────────────────────────────────────────────────────

function renderAseos() {
  const content = document.getElementById('adm-content');
  if (!_aseos) { content.innerHTML = `<div class="loader"><div class="spinner"></div></div>`; return; }

  // Solo pendientes desde hoy en adelante, ordenados por fecha asc
  const hoyDate = new Date(); hoyDate.setHours(0, 0, 0, 0);
  let pendientes = _aseos
    .filter(a => a.estado !== 'Completado' && a.estado !== 'Cancelado')
    .filter(a => { const d = parseDate(a.checkout); return d && d >= hoyDate; })
    .sort((a, b) => { const da = parseDate(a.checkout), db = parseDate(b.checkout); return da - db; });

  const aseadoras = [...new Set(pendientes.map(a => a.aseadora).filter(Boolean))].sort();

  let filtered = pendientes;
  if (_filtroAseadora) filtered = filtered.filter(a => a.aseadora === _filtroAseadora);

  // Stats
  const hoy        = filtered.filter(a => isToday(a.checkout));
  const sinAsignar = filtered.filter(a => !a.aseadora);

  // Aplicar filtro de asignación
  if (_filtroAsignacion === 'asignados')   filtered = filtered.filter(a => a.aseadora);
  if (_filtroAsignacion === 'sin_asignar') filtered = filtered.filter(a => !a.aseadora);

  let html = `
    <div style="display:flex;gap:8px;margin-bottom:var(--sp-3)">
      <button class="btn btn-primary" style="flex:1;padding:10px;font-size:13px" id="adm-agregar-aseo">
        ${icons.get('plus', 14)} Agregar aseo
      </button>
      <button class="btn btn-secondary" style="flex:1;padding:10px;font-size:13px" id="adm-ver-solicitudes">
        ${icons.get('list', 14)} Solicitudes
      </button>
    </div>
    <div class="stats-row" style="margin-bottom:var(--sp-3)">
      <div class="stat-card">
        <div class="stat-label">Hoy</div>
        <div class="stat-value accent">${hoy.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Sin asignar</div>
        <div class="stat-value">${sinAsignar.length}</div>
      </div>
    </div>
    <div class="filter-bar" style="margin-bottom:var(--sp-2)">
      <button class="filter-chip asig-chip${_filtroAsignacion === 'todos'       ? ' active' : ''}" data-asig="todos">Todos</button>
      <button class="filter-chip asig-chip${_filtroAsignacion === 'asignados'   ? ' active' : ''}" data-asig="asignados">Asignados</button>
      <button class="filter-chip asig-chip${_filtroAsignacion === 'sin_asignar' ? ' active' : ''}" data-asig="sin_asignar">Sin asignar</button>
    </div>
    ${aseadoras.length ? `
    <div class="filter-bar">
      <button class="filter-chip ase-chip${!_filtroAseadora ? ' active' : ''}" data-filter="">Todas</button>
      ${aseadoras.map(a => `
        <button class="filter-chip ase-chip${_filtroAseadora === a ? ' active' : ''}" data-filter="${a}">${a}</button>
      `).join('')}
    </div>` : ''}
  `;

  if (!filtered.length) {
    html += `<div class="empty-state">
      ${icons.get('list', 40)}
      <p class="empty-state-title">Sin aseos pendientes</p>
    </div>`;
  } else {
    html += filtered.map(a => renderAseoCardAdmin(a)).join('');
  }

  content.innerHTML = html;

  // Botones superiores
  content.querySelector('#adm-agregar-aseo').addEventListener('click', abrirModalAgregarAseo);
  content.querySelector('#adm-ver-solicitudes').addEventListener('click', abrirSolicitudesOverlay);

  // Chips asignación
  content.querySelectorAll('.asig-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      _filtroAsignacion = chip.dataset.asig;
      _filtroAseadora = '';
      renderAseos();
    });
  });

  // Chips aseadora
  content.querySelectorAll('.ase-chip').forEach(chip => {
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

// ── Modal Agregar Aseo ────────────────────────────────────────

function abrirModalAgregarAseo() {
  const aseadoras = (_personal || []).filter(p => p.nombre !== 'Admin').map(p => p.nombre);

  // Build property list from _propiedades (preferred) or fall back to _aseos
  const propMap = new Map();
  (_propiedades || []).forEach(p => propMap.set(p.id, { id: p.id, nombre: p.nombre, precio: p.precioAseo || 0 }));
  (_aseos || []).forEach(a => { if (a.idProp && !propMap.has(a.idProp)) propMap.set(a.idProp, { id: a.idProp, nombre: a.propiedad, precio: 0 }); });
  const props = [...propMap.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  openModal('Agregar aseo', `
    <div class="field">
      <label class="field-label">Propiedad</label>
      <select class="field-input" id="ag-propiedad">
        <option value="">Selecciona...</option>
        ${props.map(p => `<option value="${p.id}|${p.nombre}|${p.precio}">${p.nombre}</option>`).join('')}
        <option value="otro||0">Otra (escribir abajo)</option>
      </select>
    </div>
    <div class="field" id="ag-prop-custom-wrap" style="display:none">
      <label class="field-label">Nombre propiedad</label>
      <input class="field-input" id="ag-prop-custom" placeholder="Nombre del lugar">
    </div>
    <div class="field">
      <label class="field-label">Fecha del aseo</label>
      <input type="date" class="field-input" id="ag-fecha" value="${new Date().toISOString().slice(0,10)}">
    </div>
    <div class="field">
      <label class="field-label">Precio (COP)</label>
      <input type="number" class="field-input" id="ag-precio" placeholder="Ej: 90000" min="0" step="1000">
    </div>
    <div class="field">
      <label class="field-label">Aseadora</label>
      <select class="field-input" id="ag-aseadora">
        <option value="">Sin asignar</option>
        ${aseadoras.map(a => `<option value="${a}">${a}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label class="field-label">Notas</label>
      <textarea class="field-input" id="ag-notas" rows="2" placeholder="Instrucciones especiales..."></textarea>
    </div>
    <button class="btn btn-primary btn-full" id="ag-confirm">
      ${icons.get('plus', 16)} Crear aseo
    </button>
    <button class="btn btn-ghost btn-full" style="margin-top:8px" id="ag-cancel">Cancelar</button>
  `);

  document.getElementById('ag-propiedad').addEventListener('change', e => {
    const parts   = e.target.value.split('|');
    const isOtro  = parts[0] === 'otro';
    document.getElementById('ag-prop-custom-wrap').style.display = isOtro ? '' : 'none';
    const precio  = Number(parts[2]) || 0;
    if (!isOtro && precio) document.getElementById('ag-precio').value = precio;
    else if (!isOtro)      document.getElementById('ag-precio').value = '';
  });

  document.getElementById('ag-cancel').addEventListener('click', closeModal);
  document.getElementById('ag-confirm').addEventListener('click', async () => {
    const propVal  = document.getElementById('ag-propiedad').value;
    const [idProp, propNombre] = propVal.split('|');
    const propFinal = idProp === 'otro'
      ? document.getElementById('ag-prop-custom').value.trim()
      : propNombre;
    const fechaInput = document.getElementById('ag-fecha').value;
    const precio     = Number(document.getElementById('ag-precio').value) || 0;
    const aseadora   = document.getElementById('ag-aseadora').value;
    const notas      = document.getElementById('ag-notas').value.trim();

    if (!propFinal) { showToast('Selecciona una propiedad', 'error'); return; }
    if (!fechaInput) { showToast('Selecciona una fecha', 'error'); return; }
    if (!precio)     { showToast('Ingresa el precio', 'error'); return; }

    const p = fechaInput.split('-');
    const checkout = p[2] + '/' + p[1] + '/' + p[0]; // dd/MM/yyyy

    const btn = document.getElementById('ag-confirm');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    try {
      const result = await agregarAseo({
        propiedad: propFinal,
        idProp: idProp !== 'otro' ? idProp : '',
        checkout,
        aseadora,
        precio,
        notas,
      });
      closeModal();
      showToast('Aseo creado: ' + result.codigo, 'success');
      _aseos = null;
      const { getAllAseos: reload } = await import('../api.js?v=9');
      _aseos = await reload();
      renderAseos();
    } catch(e) {
      showToast(e.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Crear aseo';
    }
  });
}

// ── Popup Form Google ─────────────────────────────────────────

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSed_Xbzuc1G-1DTkuWFEG19mXkJHPed26ThiHZnSWJPKgEgxA/viewform?embedded=true';

function abrirFormPopup() {
  // Crear overlay
  const overlay = document.createElement('div');
  overlay.id = 'form-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;flex-direction:column;';

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-surface);border-bottom:1px solid var(--border-light)">
      <span style="font-weight:600;font-size:15px">Formulario de aseo</span>
      <button id="form-close" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--text-secondary)">
        ${icons.get('x', 20)}
      </button>
    </div>
    <iframe src="${FORM_URL}" style="flex:1;border:none;width:100%;background:#fff" allowfullscreen></iframe>
  `;

  document.body.appendChild(overlay);
  document.getElementById('form-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Solicitudes (respuestas del Google Form) ──────────────────

async function abrirSolicitudesOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'sol-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg-base);z-index:1000;display:flex;flex-direction:column;overflow:hidden;';

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-surface);border-bottom:1px solid var(--border-light);flex-shrink:0">
      <span style="font-weight:700;font-size:16px">Solicitudes del formulario</span>
      <button id="sol-close" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--text-secondary)">
        ${icons.get('x', 22)}
      </button>
    </div>
    <div id="sol-body" style="flex:1;overflow-y:auto;padding:16px">
      <div class="loader"><div class="spinner"></div></div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById('sol-close').addEventListener('click', () => overlay.remove());

  try {
    const { headers, rows } = await getFormRespuestas();
    const body = document.getElementById('sol-body');
    if (!rows.length) {
      body.innerHTML = `<div class="empty-state">
        ${icons.get('list', 40)}
        <p class="empty-state-title">Sin solicitudes aún</p>
        <p class="empty-state-sub">Las respuestas del formulario aparecerán aquí</p>
      </div>`;
      return;
    }

    // Detectar índices de columnas clave
    const iAseadora = headers.findIndex(h => /aseadora/i.test(h));
    const iFecha    = headers.findIndex(h => /fecha/i.test(h));
    const iCodigo   = headers.findIndex(h => /código|codigo|propiedad|dirección|direccion/i.test(h));

    body.innerHTML = rows.map((row, idx) => {
      const num      = rows.length - idx;
      const aseadora = iAseadora >= 0 ? (row[iAseadora] || '—').trim() : '—';
      const fecha    = iFecha    >= 0 ? (row[iFecha]    || '—').trim() : (row[0] || '—');
      const codigo   = iCodigo   >= 0 ? (row[iCodigo]   || '—').trim() : '—';
      const detailId = `sol-detail-${idx}`;

      // Filas de detalle (omitir columnas clave ya mostradas en el header)
      const keyIdxs = new Set([0, iAseadora, iFecha, iCodigo]);
      const detalles = headers.map((h, j) => {
        if (keyIdxs.has(j)) return '';
        const val = (row[j] || '').trim();
        if (!val) return '';
        return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;padding:6px 0;border-bottom:1px solid var(--border-light)">
          <div style="font-size:11px;color:var(--text-tertiary);line-height:1.3">${h.trim()}</div>
          <div style="font-size:13px;color:var(--text-primary);line-height:1.3">${val}</div>
        </div>`;
      }).join('');

      return `<div style="margin-bottom:8px;border-radius:12px;overflow:hidden;border:1px solid var(--border-light)">
        <!-- Botón desplegable -->
        <button onclick="(function(btn){
          var d=document.getElementById('${detailId}');
          var open=d.style.display==='block';
          d.style.display=open?'none':'block';
          btn.querySelector('.sol-chevron').style.transform=open?'rotate(0deg)':'rotate(180deg)';
        })(this)" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--bg-surface);border:none;cursor:pointer;text-align:left;gap:8px">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">
            <span style="font-size:11px;font-weight:700;color:var(--accent);flex-shrink:0">#${num}</span>
            <span style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${aseadora}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
            <span style="font-size:12px;font-weight:700;color:var(--bg-surface);background:var(--accent);padding:2px 8px;border-radius:6px;letter-spacing:.3px">${codigo}</span>
            <span style="font-size:11px;color:var(--text-tertiary)">${fecha}</span>
            <span class="sol-chevron" style="color:var(--text-tertiary);transition:transform .2s">${icons.get('chevron-down', 16)}</span>
          </div>
        </button>
        <!-- Detalle colapsable -->
        <div id="${detailId}" style="display:none;padding:10px 14px 14px;background:var(--bg-base)">
          ${detalles || '<p style="font-size:13px;color:var(--text-tertiary)">Sin detalles adicionales</p>'}
        </div>
      </div>`;
    }).join('');

  } catch(e) {
    document.getElementById('sol-body').innerHTML = `<div class="empty-state">
      ${icons.get('alert', 40)}
      <p class="empty-state-title">Error al cargar</p>
      <p class="empty-state-sub">${e.message}</p>
    </div>`;
  }
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
    setTimeout(() => list.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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
  setTimeout(() => list.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

// ── Historial Admin ───────────────────────────────────────────

function renderHistorialAdmin() {
  const content = document.getElementById('adm-content');
  if (!_aseos) { content.innerHTML = `<div class="loader"><div class="spinner"></div></div>`; return; }

  // Calcular rangos de mes
  const now = new Date();
  const inicioEsteMes   = new Date(now.getFullYear(), now.getMonth(), 1);
  const inicioMesAnt    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const finMesAnt       = new Date(now.getFullYear(), now.getMonth(), 0);

  // Todos los completados ordenados del más reciente al más viejo
  let completados = _aseos
    .filter(a => a.estado === 'Completado')
    .sort((a, b) => { const da = parseDate(a.checkout), db = parseDate(b.checkout); return db - da; });

  // Filtro por periodo
  if (_filtroPeriodo === 'mes') {
    completados = completados.filter(a => {
      const d = parseDate(a.checkout); return d && d >= inicioEsteMes;
    });
  } else if (_filtroPeriodo === 'anterior') {
    completados = completados.filter(a => {
      const d = parseDate(a.checkout); return d && d >= inicioMesAnt && d <= finMesAnt;
    });
  }

  const aseadoras = [...new Set(completados.map(a => a.aseadora).filter(Boolean))].sort();
  let filtered = completados;
  if (_filtroAseadora) filtered = filtered.filter(a => a.aseadora === _filtroAseadora);

  const totalIngresos = filtered.reduce((s, a) => s + (Number(a.precio) || 0), 0);

  const PERIODOS = [
    { key: 'mes',      label: 'Este mes' },
    { key: 'anterior', label: 'Mes pasado' },
    { key: 'todo',     label: 'Todo' },
  ];

  let html = `
    <div class="filter-bar" style="margin-bottom:var(--sp-3)">
      ${PERIODOS.map(p => `
        <button class="filter-chip periodo-chip${_filtroPeriodo === p.key ? ' active' : ''}" data-periodo="${p.key}">${p.label}</button>
      `).join('')}
    </div>
    <div class="stats-row" style="margin-bottom:var(--sp-4)">
      <div class="stat-card">
        <div class="stat-label">Completados</div>
        <div class="stat-value accent">${filtered.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total ingresos</div>
        <div class="stat-value" style="font-size:16px">${formatCOP(totalIngresos)}</div>
      </div>
    </div>
    <div class="filter-bar">
      <button class="filter-chip aseadora-chip${!_filtroAseadora ? ' active' : ''}" data-filter="">Todas</button>
      ${aseadoras.map(a => `
        <button class="filter-chip aseadora-chip${_filtroAseadora === a ? ' active' : ''}" data-filter="${a}">${a}</button>
      `).join('')}
    </div>`;

  if (!filtered.length) {
    html += `<div class="empty-state">
      ${icons.get('clock', 40)}
      <p class="empty-state-title">Sin historial</p>
    </div>`;
    content.innerHTML = html;
    // attach periodo chips even on empty
    content.querySelectorAll('.periodo-chip').forEach(chip => {
      chip.addEventListener('click', () => { _filtroPeriodo = chip.dataset.periodo; _filtroAseadora = ''; renderHistorialAdmin(); });
    });
    return;
  }

  html += filtered.map(a => renderAseoCardAdmin(a)).join('');
  content.innerHTML = html;

  content.querySelectorAll('.periodo-chip').forEach(chip => {
    chip.addEventListener('click', () => { _filtroPeriodo = chip.dataset.periodo; _filtroAseadora = ''; renderHistorialAdmin(); });
  });
  content.querySelectorAll('.aseadora-chip').forEach(chip => {
    chip.addEventListener('click', () => { _filtroAseadora = chip.dataset.filter; renderHistorialAdmin(); });
  });

  content.querySelectorAll('[data-action="asignar"]').forEach(btn =>
    btn.addEventListener('click', () => abrirModalAsignar(btn.dataset.codigo)));
  content.querySelectorAll('[data-action="mover"]').forEach(btn =>
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
