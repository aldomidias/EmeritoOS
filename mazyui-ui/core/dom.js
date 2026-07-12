// Onda 1.C — Helpers de DOM/string
// Implementação portada de mazyui-ui.js:327 (newId), :3587 (toast), :3594 (escapeHtml), :1947 (autoResize).

export function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

// mazyui-ui.js:3594 — copy literal
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// mazyui-ui.js:3587 — #toast element, 2400ms
export function toast(msg) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('open');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('open'), 2400);
}

// Generic modal wrapper using #modal-backdrop from the shell.
// Full skill/guide modals live in ui/modal.js; this is the primitive
// used by core utilities and panels that need a bare container.
export const modal = {
  open(html, opts = {}) {
    if (typeof document === 'undefined') return;
    const backdrop = document.getElementById('modal-backdrop');
    if (!backdrop) return;
    const body = document.getElementById('modal-body');
    if (body) body.innerHTML = html;
    backdrop.classList.add('open');
    if (opts.onClose) {
      backdrop._modalOnClose = opts.onClose;
    }
  },
  close() {
    if (typeof document === 'undefined') return;
    const backdrop = document.getElementById('modal-backdrop');
    if (!backdrop) return;
    backdrop.classList.remove('open');
    if (typeof backdrop._modalOnClose === 'function') {
      backdrop._modalOnClose();
      backdrop._modalOnClose = null;
    }
  },
};

// mazyui-ui.js:1947
export function autoResize(ta) {
  if (typeof document === 'undefined') return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(200, ta.scrollHeight) + 'px';
}

export function $(sel, root) {
  if (typeof document === 'undefined') return null;
  return (root || document).querySelector(sel);
}

export function $$(sel, root) {
  if (typeof document === 'undefined') return [];
  return Array.from((root || document).querySelectorAll(sel));
}
