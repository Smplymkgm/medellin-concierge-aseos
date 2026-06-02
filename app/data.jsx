/* ============================================================
   Placeholder data — modeled on the Sheets structure in the handoff.
   "Hoy" = sábado 31 may 2026. Codes like HM####, COP pricing.
   Swap freely for live Sheets data; field names mirror the columns.
   ============================================================ */

const TODAY = (function() { var d = new Date(); d.setHours(0,0,0,0); return d; })();

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

/* -------- Personal (hoja 👩 Personal) --------
   nombre = display corto (UI), nombreCompleto = nombre legal del form.
   PINs/códigos placeholder — confirmar con el equipo. */
const PERSONAL = [
  { codigo:'#0001', nombre: 'Alisson',        nombreCompleto: 'Alisson Ana Karina Mena Ayarza', pin: '1234', rol: 'aseadora', tel: '+57 301 442 1180', email: 'alisson@medcon.co' },
  { codigo:'#0002', nombre: 'María Fernanda', nombreCompleto: 'María Fernanda Giraldo',          pin: '5678', rol: 'aseadora', tel: '+57 312 776 9043', email: 'mfernanda@medcon.co' },
  { codigo:'#0000', nombre: 'Admin',          nombreCompleto: 'Administración',                  pin: '2025', rol: 'admin',    tel: '+57 300 000 0000', email: 'admin@medcon.co' },
];

/* -------- Propiedades (hoja ⚙️ Propiedades) -------- */
const PROPIEDADES = [
  { id: '#0002', nombre: 'Luxury 3BR Provenza',   barrio: 'El Poblado', direccion: 'Cra 35 #8A-12, Provenza',      precio: 75000, claves: { lockbox: '4471', wifi: 'Provenza_3BR / casa2024', porteria: 'Torre B · piso 9' } },
  { id: '#0005', nombre: 'Ayamonte 306 2BR',      barrio: 'El Poblado', direccion: 'Calle 9 #43B-30, Manila',       precio: 60000, claves: { lockbox: '8820', wifi: 'Ayamonte306 / bienvenido', porteria: 'Apto 306' } },
  { id: '#0008', nombre: 'Loft Astorga 1102',     barrio: 'El Poblado', direccion: 'Cra 43A #7-50, Astorga',        precio: 55000, claves: { lockbox: '1093', wifi: 'AstorgaLoft / loft1102', porteria: 'Torre A · piso 11' } },
  { id: '#0011', nombre: 'Estudio Laureles 405',  barrio: 'Laureles',   direccion: 'Cir 4 #70-21, Laureles',        precio: 48000, claves: { lockbox: '5567', wifi: 'Laureles405 / estudio405', porteria: 'Apto 405' } },
  { id: '#0014', nombre: 'Penthouse Provenza',    barrio: 'El Poblado', direccion: 'Cra 36 #10-44, Provenza',       precio: 95000, claves: { lockbox: '7702', wifi: 'PH_Provenza / penthouse', porteria: 'PH · ascensor privado' } },
  { id: '#0017', nombre: 'Apto Envigado 802',     barrio: 'Envigado',   direccion: 'Calle 38 Sur #25-18, Envigado', precio: 50000, claves: { lockbox: '3318', wifi: 'Envigado802 / envigado', porteria: 'Torre 2 · piso 8' } },
  { id: '#0021', nombre: 'Studio Manila 201',     barrio: 'El Poblado', direccion: 'Calle 11 #43-09, Manila',       precio: 45000, claves: { lockbox: '6694', wifi: 'Manila201 / studio201', porteria: 'Apto 201' } },
  { id: '#0024', nombre: 'Casa Sabaneta Loft',    barrio: 'Sabaneta',   direccion: 'Cra 45 #68 Sur-12, Sabaneta',   precio: 52000, claves: { lockbox: '2240', wifi: 'SabanetaLoft / sabaneta', porteria: 'Casa esquinera' } },
  { id: '#0027', nombre: '2BR El Tesoro',         barrio: 'El Poblado', direccion: 'Cra 25A #1A-31, El Tesoro',     precio: 68000, claves: { lockbox: '9015', wifi: 'Tesoro2BR / tesoro2024', porteria: 'Torre Cira · piso 14' } },
  { id: '#0029', nombre: 'Loft Patio Bonito',     barrio: 'El Poblado', direccion: 'Cra 38 #9-25, Patio Bonito',    precio: 58000, claves: { lockbox: '4408', wifi: 'PatioBonito / patio925', porteria: 'Apto 502' } },
];

/* -------- Aseos (hoja 🧹 Todos los Aseos) --------
   status: 'urgent' | 'pending' | 'done' | 'unassigned'
   priority: same-day turnover (check-in y check-out el mismo día) */
let _seq = 80;
function code() { _seq += Math.floor(Math.random()*4)+1; return 'HM' + String(_seq).padStart(4,'0'); }

const ASEOS = [
  // --- HOY (31 may) ---
  { codigo:'HM0087', prop:'#0014', checkin:d(2026,5,31), checkout:d(2026,5,31), status:'urgent',     asignada:'Alisson',      priority:true,  notas:'Check-in mismo día a las 3PM. Dejar todo listo antes de 1PM.' },
  { codigo:'HM0091', prop:'#0002', checkin:d(2026,5,27), checkout:d(2026,5,31), status:'urgent',     asignada:'Alisson',      priority:false, notas:'Huéspedes dejaron cocina con loza. Revisar terraza.' },
  { codigo:'HM0094', prop:'#0008', checkin:d(2026,5,28), checkout:d(2026,5,31), status:'urgent',     asignada:'María Fernanda', priority:false, notas:'' },
  { codigo:'HM0096', prop:'#0021', checkin:d(2026,5,24), checkout:d(2026,5,31), status:'unassigned', asignada:null,       priority:false, notas:'Sin asignar — confirmar disponibilidad.' },
  // --- PRÓXIMOS ---
  { codigo:'HM0102', prop:'#0005', checkin:d(2026,5,30), checkout:d(2026,6,1),  status:'pending',    asignada:'Alisson',      priority:false, notas:'' },
  { codigo:'HM0108', prop:'#0011', checkin:d(2026,5,29), checkout:d(2026,6,2),  status:'pending',    asignada:'Alisson',      priority:false, notas:'Revisar aire acondicionado, huésped reportó ruido.' },
  { codigo:'HM0111', prop:'#0027', checkin:d(2026,6,2),  checkout:d(2026,6,2),  status:'pending',    asignada:'María Fernanda', priority:true,  notas:'Turnover mismo día.' },
  { codigo:'HM0115', prop:'#0017', checkin:d(2026,5,28), checkout:d(2026,6,3),  status:'pending',    asignada:'María Fernanda',  priority:false, notas:'' },
  { codigo:'HM0119', prop:'#0029', checkin:d(2026,6,1),  checkout:d(2026,6,4),  status:'unassigned', asignada:null,       priority:false, notas:'' },
  { codigo:'HM0123', prop:'#0024', checkin:d(2026,6,3),  checkout:d(2026,6,5),  status:'pending',    asignada:'Alisson',      priority:false, notas:'' },
  { codigo:'HM0127', prop:'#0014', checkin:d(2026,6,4),  checkout:d(2026,6,6),  status:'pending',    asignada:'María Fernanda', priority:false, notas:'' },
  // --- HISTORIAL (completados) ---
  { codigo:'HM0061', prop:'#0002', checkin:d(2026,5,20), checkout:d(2026,5,29), status:'done', asignada:'Alisson',      priority:false, notas:'Completado sin novedad.', completadoEl:d(2026,5,29), tipo:'Full',    video:'2026-05-29_Alisson_HM0061.mp4', entrada:'09:10', salida:'11:40', revision:{habitaciones:'ok',cocina:'ok',sala:'ok',banos:'ok',balcon:'ok',util:'na'}, funcionamiento:{interruptores:'ok',puertas:'ok',aires:'ok',ventanas:'ok',mesas:'ok',sofas:'ok',camas:'ok',tvs:'ok',lavadora:'ok'} },
  { codigo:'HM0058', prop:'#0011', checkin:d(2026,5,22), checkout:d(2026,5,28), status:'done', asignada:'Alisson',      priority:false, notas:'', completadoEl:d(2026,5,28), tipo:'Express', video:'2026-05-28_Alisson_HM0058.mp4', entrada:'14:05', salida:'15:20', revision:{habitaciones:'ok',cocina:'ok',sala:'ok',banos:'review',balcon:'na',util:'na'}, reposicion:{jabon:true,papelBano:false,papelCocina:true,panitos:true,bolsas:true}, funcionamiento:{interruptores:'ok',puertas:'ok',aires:'review',ventanas:'ok',mesas:'ok',sofas:'ok',camas:'ok',tvs:'ok',lavadora:'na'}, reporte:'Aire del cuarto principal hace ruido al encender. Falta papel de baño en el baño social.' },
  { codigo:'HM0052', prop:'#0021', checkin:d(2026,5,21), checkout:d(2026,5,26), status:'done', asignada:'Alisson',      priority:false, notas:'Faltaba toallas, se repuso.', completadoEl:d(2026,5,26), tipo:'Full', video:'2026-05-26_Alisson_HM0052.mp4' },
  { codigo:'HM0049', prop:'#0008', checkin:d(2026,5,18), checkout:d(2026,5,24), status:'done', asignada:'Alisson',      priority:false, notas:'', completadoEl:d(2026,5,24), tipo:'Full', video:'2026-05-24_Alisson_HM0049.mp4' },
  { codigo:'HM0047', prop:'#0027', checkin:d(2026,5,15), checkout:d(2026,5,22), status:'done', asignada:'María Fernanda', priority:false, notas:'', completadoEl:d(2026,5,22), tipo:'Full', video:'2026-05-22_MariaFernanda_HM0047.mp4' },
  { codigo:'HM0043', prop:'#0014', checkin:d(2026,5,12), checkout:d(2026,5,20), status:'done', asignada:'María Fernanda',  priority:false, notas:'', completadoEl:d(2026,5,20), tipo:'Full', video:'2026-05-20_MariaFernanda_HM0043.mp4' },
];

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
    precio: a.precio != null ? a.precio : (p.precio || 0),
    noches: nights(a.checkin, a.checkout),
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

const STATUS_LABEL = { urgent:'Hoy', pending:'Pendiente', done:'Completado', unassigned:'Sin asignar' };

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
