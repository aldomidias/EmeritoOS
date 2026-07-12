// Onda 2.B — Painel "Chat" (UI principal de conversa)
// Fonte: mazyui-ui.js:1666 (renderChat) + :1657 (CHAT_QUICK)
// + :1800 (model picker) + :1882 (history picker) + :1952 (renderChatEmpty)
// + :1964 (renderTurnHTML) + :2807 (updateChatStatus).
//
// Registra via v1 (Sabec.registerPanel) — DOM imperativo, sem lit-html.
// Stream é timing-sensitive; mantém imperativo por design.

import { Sabec } from '../core/panels-registry.js';
import { state } from '../core/state.js';
import { escapeHtml, newId, autoResize, toast } from '../core/dom.js';
import {
  MODELS,
  getModel,
  setModelId,
  modelName,
  isChatPersistEnabled,
  setChatPersist,
  saveChatHistory,
  clearChatHistory,
  loadChatSessions,
  archiveCurrentChat,
  deleteChatSession,
  openChatSession,
} from '../core/persist.js';
import { renderChatMarkdown } from '../core/markdown.js';
import { fileUrl } from '../core/api.js';
import { setupAttachments, clearAttachments } from './chat-attachments.js';
import { startChatRun, attachStreamListeners, dispatchRun } from './chat-stream.js';
import { openSkillModal } from './skills.js';

// ---------------------------------------------------------------------------
// Quick-action chips (mazyui-ui.js:1657)
// ---------------------------------------------------------------------------

const CHAT_QUICK = [
  { cmd: '/abrir',              label: '/abrir' },
  { cmd: '/carrossel',          label: '/carrossel' },
  { cmd: '/publicar-tema',      label: '/publicar-tema' },
  { cmd: '/email-profissional', label: '/email-profissional' },
  { cmd: '/relatorio-ads',      label: '/relatorio-ads' },
  { cmd: '/salvar',             label: '/salvar' },
];

// ---------------------------------------------------------------------------
// History helpers
// ---------------------------------------------------------------------------

function formatSessionDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  if (sameDay) return `hoje · ${hh}:${mm}`;
  if (isYest) return `ontem · ${hh}:${mm}`;
  const dd = d.getDate().toString().padStart(2, '0');
  const mo = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mo} · ${hh}:${mm}`;
}

function renderHistoryMenuHTML() {
  const sessions = loadChatSessions();
  if (!sessions.length) {
    return `<div class="history-empty">Nenhuma conversa arquivada ainda. Clique em "Nova conversa" pra arquivar a atual.</div>`;
  }
  return sessions.map(s => `
    <div class="history-item ${s.id === state.chat.sessionId ? 'current' : ''}" data-session-id="${escapeHtml(s.id)}">
      <button class="history-open" data-session-id="${escapeHtml(s.id)}">
        <div class="history-title">${escapeHtml(s.title || 'Conversa sem título')}</div>
        <div class="history-meta">${formatSessionDate(s.savedAt)} · ${(s.turns || []).length} turnos</div>
      </button>
      <button class="history-delete" data-session-id="${escapeHtml(s.id)}" title="Apagar essa conversa">×</button>
    </div>
  `).join('');
}

function updateHistoryCount() {
  const trigger = document.getElementById('chat-history-trigger');
  if (!trigger) return;
  const n = loadChatSessions().length;
  trigger.innerHTML = `Histórico ${n ? `<span class="history-count">${n}</span>` : ''}`;
}

function bindHistoryMenuItems(menu, close, ctx) {
  menu.querySelectorAll('.history-open').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (state.chat.running) {
        toast('Espera o turno atual terminar.');
        return;
      }
      const id = btn.dataset.sessionId;
      if (openChatSession(id)) {
        close();
        // Re-render do painel chat via setActive
        ctx.setActive('chat');
      }
    };
  });
  menu.querySelectorAll('.history-delete').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.sessionId;
      deleteChatSession(id);
      menu.innerHTML = renderHistoryMenuHTML();
      bindHistoryMenuItems(menu, close, ctx);
      updateHistoryCount();
    };
  });
}

function wireHistoryPicker(container, ctx) {
  const trigger = container.querySelector('#chat-history-trigger');
  const menu = container.querySelector('#chat-history-menu');
  if (!trigger || !menu) return;

  const close = () => {
    menu.classList.remove('open');
    trigger.classList.remove('open');
    document.removeEventListener('click', outside, true);
  };
  const outside = (e) => {
    if (!trigger.contains(e.target) && !menu.contains(e.target)) close();
  };

  trigger.onclick = (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    trigger.classList.toggle('open', isOpen);
    if (isOpen) {
      menu.innerHTML = renderHistoryMenuHTML();
      bindHistoryMenuItems(menu, close, ctx);
      document.addEventListener('click', outside, true);
    } else {
      document.removeEventListener('click', outside, true);
    }
  };

  bindHistoryMenuItems(menu, close, ctx);
}

// ---------------------------------------------------------------------------
// Model picker (mazyui-ui.js:1800)
// ---------------------------------------------------------------------------

function wireModelPicker(container) {
  const trigger = container.querySelector('#model-trigger');
  const menu = container.querySelector('#model-menu');
  if (!trigger || !menu) return;

  const close = () => {
    menu.classList.remove('open');
    trigger.classList.remove('open');
    document.removeEventListener('click', outside, true);
  };
  const outside = (e) => {
    if (!trigger.contains(e.target) && !menu.contains(e.target)) close();
  };

  trigger.onclick = (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    trigger.classList.toggle('open', isOpen);
    if (isOpen) document.addEventListener('click', outside, true);
    else document.removeEventListener('click', outside, true);
  };

  menu.querySelectorAll('button[data-model]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.model;
      setModelId(id);
      menu.querySelectorAll('button[data-model]').forEach(b => {
        const isSel = b.dataset.model === id;
        b.classList.toggle('selected', isSel);
        const nameEl = b.querySelector('.m-name');
        const hasCheck = !!b.querySelector('.m-check');
        if (isSel && !hasCheck) {
          nameEl.insertAdjacentHTML('beforeend', ' <span class="m-check">selecionado</span>');
        } else if (!isSel && hasCheck) {
          b.querySelector('.m-check').remove();
        }
      });
      const cur = container.querySelector('#model-current');
      if (cur) cur.textContent = modelName(id);
      close();
      toast(`Modelo: ${modelName(id)}`);
    };
  });
}

// ---------------------------------------------------------------------------
// Turn rendering (mazyui-ui.js:1964)
// ---------------------------------------------------------------------------

function renderTurnHTML(turn) {
  if (turn.kind === 'user') {
    const atts = Array.isArray(turn.attachments) ? turn.attachments : [];
    const attHTML = atts.length ? `
      <div class="turn-attachments">
        ${atts.map(a => {
          const url = fileUrl(a.path);
          return `<a href="${url}" target="_blank" rel="noopener" title="${escapeHtml(a.name || a.path)}" style="background-image:url('${url}')"></a>`;
        }).join('')}
      </div>` : '';
    if (turn.skill) {
      const cmd = turn.skill.cmd;
      const params = turn.text.startsWith(cmd) ? turn.text.slice(cmd.length).trim() : '';
      return `
        <div class="turn turn-user" id="turn-${turn.id}">
          <div class="turn-head">você</div>
          <div class="turn-body">
            <div class="skill-cmd">${escapeHtml(cmd)}</div>
            ${params ? `<div class="skill-params">${escapeHtml(params)}</div>` : ''}
            ${attHTML}
          </div>
        </div>`;
    }
    return `
      <div class="turn turn-user" id="turn-${turn.id}">
        <div class="turn-head">você</div>
        <div class="turn-body">
          ${turn.text ? `<div class="free-text">${escapeHtml(turn.text)}</div>` : ''}
          ${attHTML}
        </div>
      </div>`;
  }
  // assistant
  const cls = ['turn', 'turn-assistant'];
  if (turn.status === 'running') cls.push('running');
  if (turn.status === 'error') cls.push('error');
  return `
    <div class="${cls.join(' ')}" id="turn-${turn.id}">
      <div class="turn-head">sabec</div>
      <div class="turn-body">
        <div class="run-log" id="log-${turn.id}">
          ${turn.events.map(ev => ev.kind === 'text'
            ? `<div class="run-event text"><div class="ev-ico"></div><div class="ev-body">${renderChatMarkdown(ev.text)}</div></div>`
            : `<div class="run-event ${ev.kind || ''}"><div class="ev-ico">${escapeHtml(ev.ico || '·')}</div><div class="ev-body"><div class="ev-title">${escapeHtml(ev.title || '')}</div>${ev.detail ? `<div class="ev-detail">${escapeHtml(ev.detail)}</div>` : ''}</div></div>`
          ).join('')}
          ${turn.events.length === 0 ? '<div class="run-empty">Iniciando…</div>' : ''}
        </div>
        ${turn.meta ? `
          <div class="turn-meta">
            ${turn.meta.duration_ms ? `${(turn.meta.duration_ms / 1000).toFixed(1)}s` : ''}
            ${typeof turn.meta.total_cost_usd === 'number' ? `· US$ ${turn.meta.total_cost_usd.toFixed(4)}` : ''}
            ${turn.meta.num_turns ? `· ${turn.meta.num_turns} turnos` : ''}
          </div>` : ''}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Empty state (mazyui-ui.js:1952)
// ---------------------------------------------------------------------------

function renderChatEmpty() {
  return `
    <div class="chat-empty">
      <div class="lead">Comece pela memória</div>
      <p>Rode <code>/abrir</code> primeiro pra carregar o contexto. Depois pergunte ou execute outras skills — tudo no mesmo chat.</p>
      <div class="chip-row" style="justify-content: center;">
        ${CHAT_QUICK.slice(0, 4).map(q => `<button class="chip" data-empty-cmd="${escapeHtml(q.cmd)}">${escapeHtml(q.label)}</button>`).join('')}
      </div>
    </div>
  `;
}

function scrollChatToBottom() {
  const scroll = document.getElementById('chat-scroll');
  if (!scroll) return;
  scroll.scrollTop = scroll.scrollHeight;
}

function updateChatStatus() {
  const info = document.getElementById('chat-status');
  if (!info) return;
  if (state.chat.running) {
    info.innerHTML = `<span class="dot live"></span> Rodando`;
  } else if (state.chat.cliSessionId) {
    info.innerHTML = `<span class="dot session"></span> Sessão ativa`;
  } else {
    info.innerHTML = `<span class="dot"></span> Sem sessão`;
  }
  const sendBtn = document.getElementById('chat-send-btn');
  const cancelBtn = document.getElementById('chat-cancel-btn');
  const resetBtn = document.getElementById('chat-reset');
  if (sendBtn) sendBtn.disabled = state.chat.running;
  if (cancelBtn) cancelBtn.style.display = state.chat.running ? '' : 'none';
  if (resetBtn) resetBtn.disabled = state.chat.running;
}

// ---------------------------------------------------------------------------
// onMount — wires all interactions (mazyui-ui.js:1666)
// ---------------------------------------------------------------------------

function onMount(container, ctx) {
  const turns = state.chat.turns;

  container.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-top">
        <div class="info" id="chat-status"><span class="dot"></span> Sem sessão</div>
        <div class="chat-top-right">
          <div class="model-picker">
            <button class="model-trigger" id="model-trigger">
              <span class="m-kicker">Modelo</span>
              <span class="m-current" id="model-current">${escapeHtml(modelName(state.chat.model))}</span>
              <span class="m-caret">▾</span>
            </button>
            <div class="model-menu" id="model-menu">
              ${MODELS.map(m => `
                <button data-model="${m.id}" class="${m.id === state.chat.model ? 'selected' : ''}">
                  <div class="m-name">${escapeHtml(m.name)} ${m.id === state.chat.model ? '<span class="m-check">selecionado</span>' : ''}</div>
                  <div class="m-desc">${escapeHtml(m.desc)}</div>
                </button>`).join('')}
            </div>
          </div>
          <button class="persist-toggle ${isChatPersistEnabled() ? 'on' : ''}" id="chat-persist-toggle"
                  title="${isChatPersistEnabled() ? 'Histórico de chat é salvo localmente no navegador' : 'Histórico não é salvo — limpa ao recarregar'}">
            <span class="persist-dot"></span>
            <span class="persist-label">Lembrar conversa</span>
          </button>
          <div class="history-picker">
            <button class="btn btn-ghost" id="chat-history-trigger" title="Conversas anteriores">
              Histórico ${(() => { const n = loadChatSessions().length; return n ? `<span class="history-count">${n}</span>` : ''; })()}
            </button>
            <div class="history-menu" id="chat-history-menu">
              ${renderHistoryMenuHTML()}
            </div>
          </div>
          <button class="btn btn-ghost" id="chat-reset" ${state.chat.running ? 'disabled' : ''}>Nova conversa</button>
        </div>
      </div>
      <div class="chat-scroll" id="chat-scroll">
        ${turns.length === 0 ? renderChatEmpty() : turns.map(renderTurnHTML).join('')}
      </div>
      <div class="chat-input-wrap" id="chat-input-wrap">
        <div class="chip-row" id="chat-chips">
          ${CHAT_QUICK.map(q => `<button class="chip" data-cmd="${escapeHtml(q.cmd)}">${escapeHtml(q.label)}</button>`).join('')}
        </div>
        <div class="chat-attachments" id="chat-attachments"></div>
        <div class="chat-input-row">
          <input type="file" id="chat-file-input" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple hidden>
          <button class="chat-attach" id="chat-attach-btn" title="Anexar imagem" aria-label="Anexar imagem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <textarea class="chat-input" id="chat-input" rows="1" placeholder="Pergunta, instrução, ou digite um /comando..."></textarea>
          <button class="chat-send" id="chat-cancel-btn" style="display:none; background: var(--paper-3); color: var(--paper); box-shadow: none;">Cancelar</button>
          <button class="chat-send" id="chat-send-btn">Enviar</button>
        </div>
      </div>
    </div>
  `;

  ctx.setTopbar(state.business.name || 'Chat', 'Chat');
  updateChatStatus();
  scrollChatToBottom();

  // --- Nova conversa ---
  container.querySelector('#chat-reset').onclick = () => {
    if (state.chat.running) return;
    archiveCurrentChat();
    state.chat.turns = [];
    state.chat.cliSessionId = null;
    state.chat.cliSessionEstablished = false;
    state.chat.sessionId = null;
    clearChatHistory();
    ctx.setActive('chat'); // re-monta o painel
  };

  // --- Persist toggle ---
  const persistBtn = container.querySelector('#chat-persist-toggle');
  if (persistBtn) {
    persistBtn.onclick = () => {
      const next = !isChatPersistEnabled();
      setChatPersist(next);
      persistBtn.classList.toggle('on', next);
      persistBtn.title = next
        ? 'Histórico de chat é salvo localmente no navegador'
        : 'Histórico não é salvo — limpa ao recarregar';
      toast(next ? 'Histórico ligado' : 'Histórico desligado');
    };
  }

  // --- History picker ---
  wireHistoryPicker(container, ctx);

  // --- Composer ---
  const input = container.querySelector('#chat-input');
  const send = container.querySelector('#chat-send-btn');
  const cancel = container.querySelector('#chat-cancel-btn');

  const submit = () => {
    const text = input.value.trim();
    const atts = state.chat.attachments;
    if (!text && atts.length === 0) return;
    if (atts.some(a => a.status === 'uploading')) {
      toast('Aguarda os anexos terminarem de subir.');
      return;
    }
    const ready = atts.filter(a => a.status === 'done');
    input.value = '';
    autoResize(input);
    clearAttachments();
    dispatchRun(text, { attachments: ready });
  };

  send.onclick = submit;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  input.addEventListener('input', () => autoResize(input));

  // --- Chips ---
  // chip.dataset.cmd vem como "/carrossel" — openSkillModal espera o id "carrossel".
  const cmdToSkillId = (cmd) => (cmd || '').replace(/^\//, '');
  container.querySelectorAll('#chat-chips .chip').forEach(chip => {
    chip.onclick = () => {
      openSkillModal(cmdToSkillId(chip.dataset.cmd));
    };
  });

  // --- Empty-state chips ---
  container.querySelectorAll('[data-empty-cmd]').forEach(b => {
    b.onclick = () => {
      openSkillModal(cmdToSkillId(b.dataset.emptyCmd));
    };
  });

  // --- Attachments + stream listeners ---
  setupAttachments(container, ctx);
  attachStreamListeners(container, ctx);
  wireModelPicker(container);

  // --- Hydrate history ---
  // (já hidratado no boot; state.chat.turns já está preenchido antes do mount)
}

// ---------------------------------------------------------------------------
// onUnmount
// ---------------------------------------------------------------------------

function onUnmount() {
  // Nada pra limpar: event listeners são em elementos do container (removido pelo registry)
  // Active stream NÃO é abortado — continua rodando em background e atualiza
  // os elementos DOM quando o usuário voltar pro chat.
}

// ---------------------------------------------------------------------------
// register — v1 (imperativo, não lit-html)
// ---------------------------------------------------------------------------

export function register() {
  Sabec.registerPanel({
    id: 'chat',
    label: 'Chat',
    glyph: 'C',
    crumb: 'Chat',
    sidebar: true,
    onMount,
    onUnmount,
  });
}
