// ── API layer — all fetch() calls to GAS backend ──────────────
// Set GAS_URL to your deployed web app URL
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbwcMH9Ovbh0kS1QE_8kIqhnBd3fjHqYDvRwONARydXoYj67U9Kr5wT7Nukndbpo0tNG/exec';

async function post(action, params = {}) {
  const body = JSON.stringify({ action, ...params });
  // GAS redirects POST → GET for CORS; follow redirects
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body,
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error del servidor');
  return json.data;
}

// AUTH
export const login = (nombre, pin) => post('login', { nombre, pin });

// ASEADORA
export const getAseos        = (nombre) => post('getAseos', { nombre });
export const completarAseo   = (codigo, nombre, notas, videoLink) =>
  post('completarAseo', { codigo, nombre, notas: notas || '', videoLink: videoLink || '' });
export const iniciarAseo     = (codigo, nombre) => post('iniciarAseo', { codigo, nombre });
export const getUploadUrl    = (codigo, propiedad, filename) =>
  post('getUploadUrl', { codigo, propiedad, filename });
export const registrarVideo  = (data) => post('registrarVideo', data);

// ADMIN
export const getAllAseos         = (filtroAseadora, fechaInicio, fechaFin) =>
  post('getAllAseos', { filtroAseadora: filtroAseadora || '', fechaInicio: fechaInicio || '', fechaFin: fechaFin || '' });
export const asignarAseo         = (codigo, aseadora) => post('asignarAseo', { codigo, aseadora });
export const moverAseo           = (codigo, nuevaFecha) => post('moverAseo', { codigo, nuevaFecha });
export const agregarAseo         = (datos) => post('agregarAseo', datos);
export const getFormRespuestas   = ()      => post('getFormRespuestas', {});

// PROPIEDADES
export const getPropiedades      = () => post('getPropiedades');
export const agregarPropiedad    = (datos) => post('agregarPropiedad', { datos });
export const actualizarPropiedad = (id, datos) => post('actualizarPropiedad', { id, datos });

// PERSONAL
export const getPersonal         = () => post('getPersonal');
export const actualizarPersonal  = (nombre, datos) => post('actualizarPersonal', { nombre, datos });
