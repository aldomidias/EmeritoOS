// Onda 2.B — Anexos de imagem no chat (upload + preview)
// Fonte: mazyui-ui.js:2370-2524.
// Constantes: CHAT_ATTACH_MAX_BYTES, CHAT_ATTACH_ACCEPT.
// Funções: renderAttachmentsHTML, refreshAttachmentsUI, clearAttachments,
// removeAttachment, readFileAsDataURL, uploadAttachment, addAttachments,
// wireChatAttachments (→ setupAttachments).

import { state } from '../core/state.js';
import { newId, escapeHtml, toast } from '../core/dom.js';

const CHAT_ATTACH_MAX_BYTES = 20 * 1024 * 1024;
const CHAT_ATTACH_ACCEPT = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i;

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderAttachmentsHTML() {
  return state.chat.attachments.map(a => {
    const cls = ['chat-attach-thumb'];
    if (a.status === 'uploading') cls.push('uploading');
    if (a.status === 'error') cls.push('error');
    const bg = a.dataUrl ? `style="background-image:url('${a.dataUrl}')"` : '';
    const title = a.status === 'error'
      ? (a.error || 'falhou')
      : (a.name || a.path || 'imagem');
    return `
      <div class="${cls.join(' ')}" ${bg} title="${escapeHtml(title)}" data-att-id="${a.id}">
        <button class="x" data-att-remove="${a.id}" aria-label="Remover anexo">×</button>
      </div>`;
  }).join('');
}

function refreshAttachmentsUI() {
  const wrap = document.getElementById('chat-attachments');
  if (!wrap) return;
  wrap.innerHTML = renderAttachmentsHTML();
  wrap.querySelectorAll('[data-att-remove]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      removeAttachment(btn.dataset.attRemove);
    };
  });
}

export function clearAttachments() {
  state.chat.attachments = [];
  refreshAttachmentsUI();
}

function removeAttachment(id) {
  state.chat.attachments = state.chat.attachments.filter(a => a.id !== id);
  refreshAttachmentsUI();
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('leitura falhou'));
    r.readAsDataURL(file);
  });
}

async function uploadAttachment(att, file) {
  try {
    const dataUrl = await readFileAsDataURL(file);
    att.dataUrl = dataUrl;
    refreshAttachmentsUI();
    const r = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, dataUrl }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || ('HTTP ' + r.status));
    att.status = 'done';
    att.path = data.path;
  } catch (e) {
    att.status = 'error';
    att.error = e.message || 'falhou';
    toast('Upload falhou: ' + att.error);
  }
  refreshAttachmentsUI();
}

function addAttachments(files) {
  const list = Array.from(files || []).filter(f => f && CHAT_ATTACH_ACCEPT.test(f.type));
  if (!list.length) return;
  for (const file of list) {
    if (file.size > CHAT_ATTACH_MAX_BYTES) {
      toast(`"${file.name}" excede 20MB.`);
      continue;
    }
    const att = {
      id: newId('att'),
      name: file.name,
      size: file.size,
      mime: file.type,
      dataUrl: null,
      path: null,
      status: 'uploading',
    };
    state.chat.attachments.push(att);
    uploadAttachment(att, file);
  }
  refreshAttachmentsUI();
}

// ---------------------------------------------------------------------------
// Public: setupAttachments — wire dropzone + paste + file input
// ---------------------------------------------------------------------------

export function setupAttachments(container, ctx) {
  const wrap = container.querySelector('#chat-input-wrap');
  const btn = container.querySelector('#chat-attach-btn');
  const fileInput = container.querySelector('#chat-file-input');
  const input = container.querySelector('#chat-input');
  if (!wrap || !btn || !fileInput || !input) return;

  // Initial render
  refreshAttachmentsUI();

  btn.onclick = () => fileInput.click();
  fileInput.onchange = () => {
    addAttachments(fileInput.files);
    fileInput.value = '';
  };

  // Paste image from clipboard
  input.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const files = [];
    for (const it of items) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f && CHAT_ATTACH_ACCEPT.test(f.type)) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      addAttachments(files);
    }
  });

  // Drag-drop
  let dragDepth = 0;
  wrap.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    dragDepth++;
    wrap.classList.add('drop-target');
  });
  wrap.addEventListener('dragover', (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  wrap.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) wrap.classList.remove('drop-target');
  });
  wrap.addEventListener('drop', (e) => {
    if (!e.dataTransfer) return;
    e.preventDefault();
    dragDepth = 0;
    wrap.classList.remove('drop-target');
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      addAttachments(e.dataTransfer.files);
    }
  });
}
