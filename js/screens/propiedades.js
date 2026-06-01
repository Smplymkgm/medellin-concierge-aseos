import { getPropiedades, agregarPropiedad, actualizarPropiedad } from '../api.js';
import icons                       from '../components/icons2.js';
import { openModal, closeModal }   from '../components/modal.js';
import { showToast }               from './toast.js';
import { formatCOP }               from '../components/aseo-card.js';

let _props = null;

export async function renderPropiedades(container) {
  container.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  try {
    _props = await getPropiedades();
    drawList(container);
  } catch(e) {
    container.innerHTML = `<div class="empty-state">
      ${icons.get('alert', 40)}
      <p class="empty-state-title">Error</p>
      <p class="empty-state-sub">${e.message}</p>
    </div>`;
  }
}

function drawList(container) {
  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-4)">
      <span class="section-title">Propiedades (${_props.length})</span>
      <button class="btn btn-primary" style="padding:8px 14px;font-size:13px" id="prop-add-btn">
        ${icons.get('plus', 14)} Agregar
      </button>
    </div>
    <div class="card">`;

  for (const p of _props) {
    html += `
    <div class="list-item" data-id="${p.id}">
      <div class="list-item-icon">${icons.get('home', 18)}</div>
      <div class="list-item-body">
        <div class="list-item-title">${p.nombre}</div>
        <div class="list-item-sub">${p.id} · ${formatCOP(p.precioAseo)}</div>
      </div>
      <div class="list-item-end">${icons.get('chevron-right', 16)}</div>
    </div>`;
  }
  html += `</div>`;
  container.innerHTML = html;

  container.querySelector('#prop-add-btn').addEventListener('click', () => abrirModalAgregar(container));

  container.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', () => {
      const prop = _props.find(p => p.id === item.dataset.id);
      if (prop) abrirModalDetalle(prop, container);
    });
  });
}

function abrirModalDetalle(prop, container) {
  openModal(prop.nombre, `
    <div class="detail-section">
      <div class="detail-row">
        <span class="detail-key">ID</span>
        <span class="detail-val">${prop.id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Precio aseo</span>
        <span class="detail-val">${formatCOP(prop.precioAseo)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Empleada auto</span>
        <span class="detail-val">${prop.empleadaAuto || '—'}</span>
      </div>
    </div>

    <div class="field">
      <label class="field-label">Acceso / Claves</label>
      <textarea class="field-input" id="det-acceso" rows="3">${prop.acceso || ''}</textarea>
    </div>
    <div class="field">
      <label class="field-label">Precio aseo (COP)</label>
      <input class="field-input" id="det-precio" type="number" value="${prop.precioAseo}">
    </div>
    <div class="field">
      <label class="field-label">iCal URL</label>
      <input class="field-input" id="det-ical" type="url" value="${prop.icalUrl}">
    </div>
    <div class="field">
      <label class="field-label">Empleada automática</label>
      <input class="field-input" id="det-emp" type="text" value="${prop.empleadaAuto || ''}">
    </div>
    ${prop.folderId ? `
    <div class="field">
      <label class="field-label">Carpeta Drive Videos</label>
      <a href="https://drive.google.com/drive/folders/${prop.folderId}" target="_blank"
         style="font-size:13px;color:var(--accent)">
        ${icons.get('video', 14)} Ver carpeta
      </a>
    </div>` : ''}
    <button class="btn btn-primary btn-full" id="det-save">
      ${icons.get('check', 16)} Guardar cambios
    </button>
    <button class="btn btn-ghost btn-full" style="margin-top:8px" id="det-cancel">Cancelar</button>
  `);

  document.getElementById('det-cancel').addEventListener('click', closeModal);
  document.getElementById('det-save').addEventListener('click', async () => {
    const datos = {
      acceso:       document.getElementById('det-acceso').value.trim(),
      precioAseo:   parseInt(document.getElementById('det-precio').value) || 0,
      icalUrl:      document.getElementById('det-ical').value.trim(),
      empleadaAuto: document.getElementById('det-emp').value.trim(),
    };
    const btn = document.getElementById('det-save');
    btn.disabled = true;
    try {
      await actualizarPropiedad(prop.id, datos);
      Object.assign(prop, datos);
      closeModal();
      showToast('Propiedad actualizada', 'success');
    } catch(e) {
      showToast(e.message, 'error');
      btn.disabled = false;
    }
  });
}

function abrirModalAgregar(container) {
  openModal('Nueva propiedad', `
    <div class="field">
      <label class="field-label">Nombre</label>
      <input class="field-input" id="nw-nombre" type="text" placeholder="Ej: Luxury 2BR Provenza">
    </div>
    <div class="field">
      <label class="field-label">Acceso / Claves / Dirección</label>
      <textarea class="field-input" id="nw-acceso" rows="3" placeholder="Clave edificio: 1234 | Dirección: ..."></textarea>
    </div>
    <div class="field">
      <label class="field-label">iCal URL (Airbnb)</label>
      <input class="field-input" id="nw-ical" type="url" placeholder="https://www.airbnb.com/calendar/ical/...">
    </div>
    <div class="field">
      <label class="field-label">Precio aseo (COP)</label>
      <input class="field-input" id="nw-precio" type="number" value="80000">
    </div>
    <div class="field">
      <label class="field-label">Empleada automática (opcional)</label>
      <input class="field-input" id="nw-emp" type="text">
    </div>
    <p class="field-hint" style="margin-bottom:var(--sp-3)">Se creará automáticamente una carpeta en Google Drive.</p>
    <button class="btn btn-primary btn-full" id="nw-save">
      ${icons.get('plus', 16)} Agregar propiedad
    </button>
    <button class="btn btn-ghost btn-full" style="margin-top:8px" id="nw-cancel">Cancelar</button>
  `);

  document.getElementById('nw-cancel').addEventListener('click', closeModal);
  document.getElementById('nw-save').addEventListener('click', async () => {
    const nombre = document.getElementById('nw-nombre').value.trim();
    const icalUrl = document.getElementById('nw-ical').value.trim();
    if (!nombre || !icalUrl) { showToast('Nombre e iCal URL son obligatorios', 'error'); return; }

    const datos = {
      nombre,
      acceso:       document.getElementById('nw-acceso').value.trim(),
      icalUrl,
      precioAseo:   parseInt(document.getElementById('nw-precio').value) || 0,
      empleadaAuto: document.getElementById('nw-emp').value.trim(),
    };
    const btn = document.getElementById('nw-save');
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Creando...`;

    try {
      const result = await agregarPropiedad(datos);
      _props.push({ ...datos, id: result.id, folderId: '' });
      closeModal();
      showToast(`Propiedad ${result.id} agregada`, 'success');
      drawList(container);
    } catch(e) {
      showToast(e.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `${icons.get('plus', 16)} Agregar propiedad`;
    }
  });
}
