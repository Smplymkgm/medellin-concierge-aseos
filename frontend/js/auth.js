// ── Session management ─────────────────────────────────────────
const SESSION_KEY = 'mc_session';

export function saveSession(data) {
  // data = { rol, nombre }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn() {
  return getSession() !== null;
}

export function getRole() {
  const s = getSession();
  return s ? s.rol : null;
}

export function getNombre() {
  const s = getSession();
  return s ? s.nombre : null;
}

// ── "Ver como" admin impersonation (in-memory only, never persisted) ──
let _impersonando = null;

export function setImpersonar(nombre) {
  _impersonando = nombre;
}

export function clearImpersonar() {
  _impersonando = null;
}

export function getImpersonar() {
  return _impersonando;
}
