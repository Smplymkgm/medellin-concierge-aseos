// ── Router — thin wrapper around window.__navigateTo ───────────
import { clearSession } from './auth.js';

export function navigate(screen) {
  if (window.__navigateTo) window.__navigateTo(screen);
}

export function logout() {
  clearSession();
  navigate('login');
}
