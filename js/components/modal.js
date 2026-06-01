// ── Bottom-sheet modal ─────────────────────────────────────────
let _overlay = null;
let _onClose = null;

export function openModal(title, contentHTML, { onClose } = {}) {
  _onClose = onClose || null;

  if (!_overlay) {
    _overlay = document.createElement('div');
    _overlay.className = 'modal-overlay';
    _overlay.innerHTML = `
      <div class="modal-sheet" id="modal-sheet">
        <div class="modal-handle"></div>
        <p class="modal-title" id="modal-title"></p>
        <div id="modal-content"></div>
      </div>
    `;
    document.body.appendChild(_overlay);
    _overlay.addEventListener('click', e => {
      if (e.target === _overlay) closeModal();
    });
  }

  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-content').innerHTML   = contentHTML;

  // Force reflow before adding class
  _overlay.offsetHeight;
  _overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  if (!_overlay) return;
  _overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (_onClose) _onClose();
  _onClose = null;
}

export function setModalContent(html) {
  const el = document.getElementById('modal-content');
  if (el) el.innerHTML = html;
}
