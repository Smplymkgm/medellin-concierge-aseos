// ── App entry point ────────────────────────────────────────────
import { getSession }           from './auth.js?v=12';
import { renderLogin, initLogin } from './screens/login.js?v=12';
import { renderAseadora, initAseadora, activateAseadora } from './screens/aseadora.js?v=12';
import { renderAdmin, initAdmin, activateAdmin }          from './screens/admin.js?v=12';

// Build the app shell
const app = document.getElementById('app');
app.innerHTML = `
  <div id="screen-login"    class="screen"></div>
  <div id="screen-aseadora" class="screen"></div>
  <div id="screen-admin"    class="screen"></div>
`;

document.getElementById('screen-login').innerHTML    = renderLogin();
document.getElementById('screen-aseadora').innerHTML = renderAseadora();
document.getElementById('screen-admin').innerHTML    = renderAdmin();

// Init all screens (attach base listeners)
initLogin();
initAseadora();
initAdmin();

// Route based on session
const session = getSession();
if (!session) {
  showScreen('login');
} else if (session.rol === 'admin') {
  showScreen('admin');
  activateAdmin();
} else {
  showScreen('aseadora');
  activateAseadora();
}

// ── Global helpers exposed for screens ──────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${name}`);
  if (el) el.classList.add('active');
}

export function navigateTo(name) {
  showScreen(name);
  if (name === 'aseadora') activateAseadora();
  if (name === 'admin')    activateAdmin();
}

// Make navigateTo available globally (used by login.js and router.js)
window.__navigateTo = navigateTo;
