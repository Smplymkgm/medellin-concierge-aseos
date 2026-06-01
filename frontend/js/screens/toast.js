// Shared toast utility
let _timer = null;

export function showToast(msg, type = '') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  // Force reflow
  toast.offsetHeight;
  toast.classList.add('show');
  clearTimeout(_timer);
  _timer = setTimeout(() => toast.classList.remove('show'), 2800);
}
