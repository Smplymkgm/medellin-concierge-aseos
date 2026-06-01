import { login }       from '../api.js';
import { saveSession } from '../auth.js';
import icons           from '../components/icons.js';

let _pin = '';
const PERSONAL = ['Ana', 'Fernanda', 'Claudia', 'Admin'];

export function renderLogin() {
  return `
  <div class="login-wrap">
    <div class="login-logo">${icons.get('broom', 28)}</div>
    <h1 class="login-title">Medellin Concierge</h1>
    <p class="login-subtitle">Gestión de Aseos</p>

    <div class="login-form">
      <div class="field">
        <label class="field-label">Nombre</label>
        <select class="field-input" id="login-nombre">
          <option value="">Selecciona tu nombre...</option>
          ${PERSONAL.map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label class="field-label">PIN</label>
        <div class="pin-display" id="pin-display">
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
          <div class="pin-dot"></div>
        </div>
      </div>

      <div class="pin-pad" id="pin-pad">
        ${[1,2,3,4,5,6,7,8,9,'',0,'del'].map(k => `
          <button class="pin-key${k === 'del' ? ' del' : ''}" data-key="${k}"
            ${k === '' ? 'disabled style="visibility:hidden"' : ''}>
            ${k === 'del' ? icons.get('x', 18) : k}
          </button>
        `).join('')}
      </div>

      <button class="btn btn-primary btn-full" id="login-btn" disabled>
        Entrar
      </button>
      <p id="login-error" style="
        display:none;text-align:center;margin-top:10px;
        font-size:13px;color:var(--accent)">
        Nombre o PIN incorrecto
      </p>
    </div>
  </div>`;
}

export function initLogin() {
  _pin = '';

  document.getElementById('pin-pad').addEventListener('click', e => {
    const btn = e.target.closest('.pin-key');
    if (!btn || btn.disabled) return;
    const key = btn.dataset.key;
    if (key === 'del') {
      _pin = _pin.slice(0, -1);
    } else if (_pin.length < 4 && key !== '') {
      _pin += key;
    }
    updatePinUI();
  });

  document.getElementById('login-nombre').addEventListener('change', updatePinUI);
  document.getElementById('login-btn').addEventListener('click', doLogin);
}

function updatePinUI() {
  document.querySelectorAll('.pin-dot').forEach((d, i) =>
    d.classList.toggle('filled', i < _pin.length));
  const nombre = document.getElementById('login-nombre').value;
  document.getElementById('login-btn').disabled = !nombre || _pin.length < 4;
  document.getElementById('login-error').style.display = 'none';
}

async function doLogin() {
  const nombre = document.getElementById('login-nombre').value;
  const btn    = document.getElementById('login-btn');
  if (!nombre || _pin.length < 4) return;

  btn.disabled    = true;
  btn.textContent = 'Verificando...';

  try {
    const data = await login(nombre, _pin);
    saveSession({ rol: data.rol, nombre: data.nombre });
    _pin = '';
    updatePinUI();
    // Navigate (window.__navigateTo set by main.js)
    if (window.__navigateTo) window.__navigateTo(data.rol === 'admin' ? 'admin' : 'aseadora');
  } catch {
    document.getElementById('login-error').style.display = 'block';
    _pin = '';
    updatePinUI();
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Entrar';
  }
}
