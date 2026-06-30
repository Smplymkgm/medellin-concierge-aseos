/* ============================================================
   Placeholder data — modeled on the Sheets structure in the handoff.
   "Hoy" = sábado 31 may 2026. Codes like HM####, COP pricing.
   Swap freely for live Sheets data; field names mirror the columns.
   ============================================================ */

const TODAY = (function() { var t = new Date(); t.setHours(0,0,0,0); return t; })();

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DOW = ['dom','lun','mar','mié','jue','vie','sáb'];
const DOW_FULL = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

function d(y, m, day) { return new Date(y, m - 1, day); }
function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function fmtDate(dt) { return DOW_FULL[dt.getDay()].replace(/^\w/, c=>c.toUpperCase()) + ' ' + dt.getDate() + ' ' + MONTHS_SHORT[dt.getMonth()]; }
function fmtShort(dt) { return dt.getDate() + ' ' + MONTHS_SHORT[dt.getMonth()]; }
function fmtCOP(n) { return '$' + n.toLocaleString('es-CO'); }
function nights(ci, co) { return Math.round((co - ci) / 86400000); }

/* -------- Personal (hoja Personal) --------
   Sólo se deja Admin como FALLBACK por si la API no responde durante el
   login. La lista real (Ana, Fernanda, Claudia, Admin) viene del
   spreadsheet vía getPersonal en cada arranque. */
const PERSONAL = [
  { codigo: '#0000', nombre: 'Admin', pin: '2025', rol: 'admin', tel: '', email: '' },
];

/* -------- Propiedades (hoja Propiedades) --------
   Vacío. Se carga dinámicamente desde la API. */
const PROPIEDADES = [];

/* -------- Aseos (hoja Todos los Aseos) --------
   Vacío. Se carga dinámicamente desde la API. */
const ASEOS = [];

/* lookups + helpers */
/* LIVE_PROPS is the mutable source of truth (cloned from PROPIEDADES).
   propById reads it so aseo cards reflect edits. App keeps a state mirror. */
let LIVE_PROPS = PROPIEDADES.map(p => ({ ...p, claves: { ...p.claves } }));
function getProps() { return LIVE_PROPS; }
function setLiveProps(arr) { LIVE_PROPS = arr; }
function propById(id) { return LIVE_PROPS.find(p => p.id === id); }
function nextPropId() {
  const nums = LIVE_PROPS.map(p => parseInt(String(p.id).replace(/\D/g, '')) || 0);
  return '#' + String(Math.max(0, ...nums) + 1).padStart(4, '0');
}

let LIVE_PERSONAL = PERSONAL.map(p => ({ ...p }));
function getPersonal() { return LIVE_PERSONAL; }
function setLivePersonal(arr) { LIVE_PERSONAL = arr; }
function nextPersonalId() {
  const nums = LIVE_PERSONAL.map(p => parseInt(String(p.codigo).replace(/\D/g, '')) || 0);
  return '#' + String(Math.max(0, ...nums) + 1).padStart(4, '0');
}
function aseoEnriched(a) {
  const p = propById(a.prop) || {};
  return {
    ...a,
    propNombre: p.nombre || 'Propiedad',
    barrio: p.barrio || '',
    direccion: p.direccion || '',
    claves: p.claves || {},
    // propagar el acceso estructurado al objeto enriquecido para que
    // la AseoCard lo lea desde a.accesoEstructurado
    accesoEstructurado: a.accesoEstructurado || p.accesoEstructurado || null,
    // precio = 0 puede ser intencional (el propietario paga el aseo
    // directamente, no Medcon). Lo respetamos: si está en 0 en el
    // spreadsheet, queda en 0 en la app y se muestra como "paga
    // propietario" en lugar de "$0".
    precio: a.precio != null ? a.precio : (p.precio || 0),
    // noches = de la RESERVA (check-in → check-out real), no del día del aseo
    noches: nights(a.checkin, a.checkoutReserva || a.checkout),
  };
}
function initials(name) {
  const w = (name||'').trim().split(/\s+/);
  return ((w[0]||'')[0] || '') + ((w[1]||'')[0] || (w[0]||'')[1] || '');
}
function propInitials(name) {
  const w = (name||'').replace(/[#0-9]/g,'').trim().split(/\s+/).filter(Boolean);
  return ((w[0]||'')[0]||'').toUpperCase() + ((w[1]||'')[0]||'').toUpperCase();
}

const STATUS_LABEL = { urgent:'Hoy', pending:'Pendiente', done:'Completado', unassigned:'Sin asignar', cancelled:'Cancelado' };

/* -------- Checklist del form de completado (4 secciones) -------- */
/* Áreas de aseo — valor: 'ok' | 'review' | 'na' */
const CHECK_ASEO = [
  { id:'habitaciones', label:'Habitaciones', hint:'Cambio de sábanas, fundas y cobijas en buen estado', na:false },
  { id:'cocina',       label:'Cocina / Comedor', na:false },
  { id:'sala',         label:'Sala / Sala de estar', na:false },
  { id:'banos',        label:'Baños', hint:'Cambio de toallas en buen estado', na:false },
  { id:'balcon',       label:'Balcón / Terraza', na:true },
  { id:'util',         label:'Cuarto útil', na:true },
];
const ASEO_OK = 'Aseada', ASEO_REVIEW = 'Requiere mejora';

/* Reposición de insumos — valor: true (Sí) | false (No) */
const CHECK_REPOSICION = [
  { id:'jabon',       label:'Jabón de manos y shampoo' },
  { id:'papelBano',   label:'Papel de baño' },
  { id:'papelCocina', label:'Papel de cocina' },
  { id:'panitos',     label:'Pañitos de cocina' },
  { id:'bolsas',      label:'Bolsas en contenedores' },
];

/* Funcionamiento — valor: 'ok' | 'review' | 'na' */
const CHECK_FUNCIONA = [
  { id:'interruptores', label:'Interruptores / bombillos / lámparas', na:false },
  { id:'puertas',       label:'Puertas (principal, habitaciones, duchas)', na:false },
  { id:'aires',         label:'Aires acondicionados / ventiladores', na:true },
  { id:'ventanas',      label:'Ventanas', na:false },
  { id:'mesas',         label:'Mesas / barras', na:false },
  { id:'sofas',         label:'Sofás / sillas', na:false },
  { id:'camas',         label:'Camas', na:false },
  { id:'tvs',           label:'Televisores', na:false },
  { id:'lavadora',      label:'Lavadora / secadora', na:true },
];
const FUNC_OK = 'Funciona', FUNC_REVIEW = 'Requiere atención';

/* Resumen: lista de áreas marcadas 'review' para el admin */
function flaggedAreas(aseo) {
  const out = [];
  const rev = aseo.revision || {}, fun = aseo.funcionamiento || {}, rep = aseo.reposicion || {};
  CHECK_ASEO.forEach(q => { if (rev[q.id] === 'review') out.push(q.label); });
  CHECK_FUNCIONA.forEach(q => { if (fun[q.id] === 'review') out.push(q.label); });
  CHECK_REPOSICION.forEach(q => { if (rep[q.id] === false) out.push('Falta: ' + q.label.toLowerCase()); });
  return out;
}

Object.assign(window, {
  TODAY, MONTHS, MONTHS_SHORT, DOW, DOW_FULL,
  d, sameDay, fmtDate, fmtShort, fmtCOP, nights,
  PERSONAL, PROPIEDADES, ASEOS,
  propById, getProps, setLiveProps, nextPropId, getPersonal, setLivePersonal, nextPersonalId, aseoEnriched, initials, propInitials, STATUS_LABEL,
  CHECK_ASEO, ASEO_OK, ASEO_REVIEW, CHECK_REPOSICION, CHECK_FUNCIONA, FUNC_OK, FUNC_REVIEW, flaggedAreas,
});
