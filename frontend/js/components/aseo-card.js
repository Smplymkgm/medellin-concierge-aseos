import icons from './icons2.js?v=5';

// Shared date helpers (same logic as GAS, client-side)
export function parseDate(str) {
  if (!str) return null;
  const p = str.split('/');
  if (p.length !== 3) return null;
  const d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isToday(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return false;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return d.getTime() === hoy.getTime();
}

export function isUrgent(aseo) {
  return isToday(aseo.checkout) && aseo.estado !== 'Completado' && aseo.estado !== 'Cancelado';
}

export function formatCOP(n) {
  return '$' + Number(n).toLocaleString('es-CO');
}

const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export function formatFecha(str) {
  const d = parseDate(str);
  if (!d) return str;
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

// Badge HTML for estado
export function badgeEstado(estado, urgente) {
  if (urgente) return `<span class="badge badge-urgent">PRIORIDAD</span>`;
  if (estado === 'Completado') return `<span class="badge badge-done">Completado</span>`;
  if (estado === 'Cancelado')  return `<span class="badge badge-neutral">Cancelado</span>`;
  return `<span class="badge badge-pending">Pendiente</span>`;
}

// Full card for aseadora (with complete button)
export function renderAseoCard(aseo, { onCompletar, showAseadora } = {}) {
  const urgent = isUrgent(aseo);
  const today  = isToday(aseo.checkout);

  return `
  <div class="aseo-card${urgent ? ' urgent' : ''}" data-codigo="${aseo.codigo}">
    <div class="aseo-card-body">
      <div class="aseo-card-header">
        <span class="aseo-card-prop">${aseo.propiedad}</span>
        ${badgeEstado(aseo.estado, urgent)}
      </div>
      <div class="aseo-card-meta">
        <span>${icons.get('calendar', 13)} Checkout: <strong>${formatFecha(aseo.checkout)}</strong></span>
        ${aseo.noches ? `<span>${icons.get('clock', 13)} ${aseo.noches} noche${aseo.noches > 1 ? 's' : ''}</span>` : ''}
        ${aseo.precio ? `<span class="precio">${icons.get('money', 13)} ${formatCOP(aseo.precio)}</span>` : ''}
        ${showAseadora && aseo.aseadora ? `<span>${icons.get('user', 13)} ${aseo.aseadora}</span>` : ''}
      </div>
      ${aseo.accesos && aseo.accesos.length ? `
        <div class="acceso-list">
          ${aseo.accesos.slice(0, 3).map(a => `
            <div class="acceso-item">${icons.get('key', 14)} ${a}</div>
          `).join('')}
          ${aseo.accesos.length > 3 ? `<div class="acceso-item" style="color:var(--text-tertiary)">+${aseo.accesos.length - 3} más...</div>` : ''}
        </div>
      ` : ''}
    </div>
    ${(today || aseo.estado === 'Pendiente') && onCompletar ? `
    <div class="aseo-card-footer">
      <span style="font-size:12px;color:var(--text-secondary)">${aseo.idProp}</span>
      ${aseo.estado !== 'Completado' && aseo.estado !== 'Cancelado' ? `
        <button class="btn btn-primary" style="padding:8px 14px;font-size:13px;" data-action="completar" data-codigo="${aseo.codigo}">
          ${icons.get('check', 14)} Completar
        </button>
      ` : ''}
    </div>
    ` : `
    <div class="aseo-card-footer">
      <span style="font-size:12px;color:var(--text-secondary)">${aseo.idProp}</span>
      <span style="font-size:12px;color:var(--text-tertiary)">${aseo.checkin} → ${aseo.checkout}</span>
    </div>
    `}
  </div>`;
}

// Compact card for admin list
export function renderAseoCardAdmin(aseo, { onAsignar, onMover } = {}) {
  const urgent = isUrgent(aseo);
  return `
  <div class="aseo-card${urgent ? ' urgent' : ''}" data-codigo="${aseo.codigo}">
    <div class="aseo-card-body">
      <div class="aseo-card-header">
        <span class="aseo-card-prop">${aseo.propiedad}</span>
        ${badgeEstado(aseo.estado, urgent)}
      </div>
      <div class="aseo-card-meta">
        <span>${icons.get('calendar', 13)} ${formatFecha(aseo.checkout)}</span>
        ${aseo.aseadora ? `<span>${icons.get('user', 13)} ${aseo.aseadora}</span>` : `<span style="color:var(--accent)">${icons.get('alert', 13)} Sin asignar</span>`}
        ${aseo.precio ? `<span>${formatCOP(aseo.precio)}</span>` : ''}
      </div>
    </div>
    <div class="aseo-card-footer" style="gap:8px">
      <span style="font-size:12px;color:var(--text-secondary)">${aseo.idProp}</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary" style="padding:6px 10px;font-size:12px;" data-action="asignar" data-codigo="${aseo.codigo}">
          ${icons.get('user', 14)} Asignar
        </button>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" data-action="mover" data-codigo="${aseo.codigo}">
          ${icons.get('calendar', 14)} Mover
        </button>
      </div>
    </div>
  </div>`;
}
