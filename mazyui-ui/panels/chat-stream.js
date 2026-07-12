// Onda 2.B — Streaming do chat (orquestração de runs + parser SSE → turn)
// Fonte: mazyui-ui.js:2526 (dispatchRun) + :2559 (startChatRun) + :2617 (finishTurn)
// + :2634-2670 (heartbeat) + :2692 (handleStreamEvent) + :2716 (appendEventToTurn)
// + :2728 (appendTextToTurn) + :2757 (renderEventEl) + :2789 (updateTurnDOM).

import { state } from '../core/state.js';
import { newId, escapeHtml } from '../core/dom.js';
import { streamRun, apiCancel, apiState } from '../core/api.js';
import { saveChatHistory } from '../core/persist.js';
import { renderChatMarkdown } from '../core/markdown.js';

// ---------------------------------------------------------------------------
// Friendly tool labels (portado de mazyui-ui.js:211-225)
// ---------------------------------------------------------------------------

const TOOL_FRIENDLY = {
  Read:       (i) => ({ ico: '◯', title: 'Lendo arquivo',     detail: i.file_path || '' }),
  Write:      (i) => ({ ico: '+',  title: 'Criando arquivo',   detail: i.file_path || '' }),
  Edit:       (i) => ({ ico: '✎', title: 'Editando arquivo',  detail: i.file_path || '' }),
  Bash:       (i) => ({ ico: '$',  title: i.description || 'Rodando comando', detail: i.command || '' }),
  PowerShell: (i) => ({ ico: '$',  title: i.description || 'Rodando comando', detail: i.command || '' }),
  Glob:       (i) => ({ ico: '⌕', title: 'Procurando arquivos', detail: i.pattern || '' }),
  Grep:       (i) => ({ ico: '⌕', title: 'Buscando no texto',  detail: i.pattern || '' }),
  TodoWrite:  ( ) => ({ ico: '☰', title: 'Atualizando tarefas', detail: '' }),
  WebFetch:   (i) => ({ ico: '↗', title: 'Acessando',          detail: i.url || '' }),
  WebSearch:  (i) => ({ ico: '⌕', title: 'Pesquisando na web', detail: i.query || '' }),
  Agent:      (i) => ({ ico: '⌬', title: i.description || 'Delegando para subagente', detail: '' }),
  Skill:      (i) => ({ ico: '/', title: 'Skill: ' + (i.skill || ''), detail: i.args || '' }),
  Task:       (i) => ({ ico: '⌬', title: i.description || 'Delegando', detail: '' }),
};

function friendlyTool(name, input) {
  const fn = TOOL_FRIENDLY[name];
  if (fn) return fn(input || {});
  return { ico: '·', title: name, detail: '' };
}

// ---------------------------------------------------------------------------
// Heartbeat (mazyui-ui.js:2632)
// ---------------------------------------------------------------------------

let _heartbeatTimer = null;

function formatElapsed(s) {
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m${rs.toString().padStart(2, '0')}`;
}

function tickHeartbeat() {
  const run = state.currentRun;
  if (!run) return;
  const seconds = Math.floor((Date.now() - run.startedAt) / 1000);
  const elapsed = formatElapsed(seconds);

  const info = document.getElementById('chat-status');
  if (info) info.innerHTML = `<span class="dot live"></span> Rodando · ${escapeHtml(elapsed)}`;

  if (state.active !== 'chat') return;
  const log = document.getElementById('log-' + run.turn.id);
  if (!log) return;
  let thinking = log.querySelector('.run-thinking');
  if (!thinking) {
    thinking = document.createElement('div');
    thinking.className = 'run-thinking';
    thinking.innerHTML = '<span class="ht-dots"><span></span><span></span><span></span></span><span class="ht-label"></span>';
    log.appendChild(thinking);
  }
  thinking.querySelector('.ht-label').textContent = `trabalhando há ${elapsed}`;
}

function startHeartbeat() {
  stopHeartbeat();
  _heartbeatTimer = setInterval(tickHeartbeat, 1000);
  tickHeartbeat();
}

function stopHeartbeat() {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer);
  _heartbeatTimer = null;
}

function bumpThinking(turn) {
  if (state.active !== 'chat') return;
  const log = document.getElementById('log-' + turn.id);
  if (!log) return;
  const thinking = log.querySelector('.run-thinking');
  if (thinking) log.appendChild(thinking);
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

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

function renderEventEl(ev) {
  const el = document.createElement('div');
  el.className = 'run-event ' + (ev.kind || '');
  el.innerHTML = `
    <div class="ev-ico">${escapeHtml(ev.ico || '·')}</div>
    <div class="ev-body">
      <div class="ev-title">${escapeHtml(ev.title || '')}</div>
      ${ev.detail ? `<div class="ev-detail">${escapeHtml(ev.detail)}</div>` : ''}
    </div>`;
  return el;
}

function renderTextEl(text) {
  const el = document.createElement('div');
  el.className = 'run-event text';
  el.innerHTML = `<div class="ev-ico"></div><div class="ev-body">${renderChatMarkdown(text)}</div>`;
  return el;
}

// ---------------------------------------------------------------------------
// Public: appendEventToTurn, appendTextToTurn (usados por outros módulos)
// ---------------------------------------------------------------------------

export function appendEventToTurn(turn, ev) {
  turn.events.push(ev);
  if (state.active !== 'chat') return;
  const log = document.getElementById('log-' + turn.id);
  if (!log) return;
  const empty = log.querySelector('.run-empty');
  if (empty) empty.remove();
  log.appendChild(renderEventEl(ev));
  bumpThinking(turn);
  scrollChatToBottom();
}

export function appendTextToTurn(turn, text) {
  const last = turn.events[turn.events.length - 1];
  if (last && last.kind === 'text') {
    last.text += text;
  } else {
    turn.events.push({ kind: 'text', text });
  }
  if (state.active !== 'chat') return;
  const log = document.getElementById('log-' + turn.id);
  if (!log) return;
  const empty = log.querySelector('.run-empty');
  if (empty) empty.remove();
  const textEls = log.querySelectorAll('.run-event.text');
  const lastText = textEls[textEls.length - 1];
  const allEvents = log.querySelectorAll('.run-event');
  const reallyLast = allEvents[allEvents.length - 1];
  if (lastText && lastText === reallyLast) {
    // Re-render markdown do texto acumulado (garante blocos que fecham no fim do stream)
    lastText.querySelector('.ev-body').innerHTML = renderChatMarkdown(last.text);
  } else {
    log.appendChild(renderTextEl(text));
  }
  bumpThinking(turn);
  scrollChatToBottom();
}

// ---------------------------------------------------------------------------
// Public: handleStreamEvent
// ---------------------------------------------------------------------------

export function handleStreamEvent(obj, turn) {
  if (obj.type === 'system' && obj.subtype === 'init') {
    appendEventToTurn(turn, { kind: 'system', ico: '·', title: 'Sistema pronto', detail: 'Modelo: ' + (obj.model || '—') });
    return;
  }
  if (obj.type === 'assistant' && obj.message?.content) {
    for (const part of obj.message.content) {
      if (part.type === 'text' && part.text) {
        appendTextToTurn(turn, part.text);
      } else if (part.type === 'tool_use') {
        const friendly = friendlyTool(part.name, part.input);
        appendEventToTurn(turn, { kind: 'tool', ico: friendly.ico, title: friendly.title, detail: friendly.detail });
      }
    }
    return;
  }
  if (obj.type === 'user' && obj.message?.content) {
    return; // tool results — skipped for clean UI
  }
  // obj.type === 'result': metadados capturados em startChatRun; texto já foi streamado
}

// ---------------------------------------------------------------------------
// Internal: finishTurn + reloadQuiet
// ---------------------------------------------------------------------------

async function _reloadQuiet() {
  try {
    // dynamic import evita circular: chat-stream -> boot (que importa chat)
    const { apiState: _apiState } = await import('../core/api.js');
    const s = await _apiState();
    state.memory = s.memory;
    state.identidade = s.identidade;
    state.logo = s.logo || null;
    state.library = s.library;
    // brand helpers importados dinamicamente pelo mesmo motivo
    const brand = await import('../core/brand.js');
    state.business = brand.extractBusiness(s.memory.empresa);
    brand.applyIdentityToCSS(state.identidade);
    const brandTag = document.getElementById('brand-tag');
    if (brandTag) brandTag.textContent = state.business.name || 'Painel';
    brand.updateBrandLogo();
  } catch { /* silencioso */ }
}

function updateTurnDOM(turn) {
  const el = document.getElementById('turn-' + turn.id);
  if (!el) return;
  el.classList.remove('running', 'error');
  if (turn.status === 'error') el.classList.add('error');
  if (turn.meta && !el.querySelector('.turn-meta')) {
    const meta = document.createElement('div');
    meta.className = 'turn-meta';
    const parts = [];
    if (turn.meta.duration_ms) parts.push(`${(turn.meta.duration_ms / 1000).toFixed(1)}s`);
    if (typeof turn.meta.total_cost_usd === 'number') parts.push(`US$ ${turn.meta.total_cost_usd.toFixed(4)}`);
    if (turn.meta.num_turns) parts.push(`${turn.meta.num_turns} turnos`);
    meta.textContent = parts.join(' · ');
    el.querySelector('.turn-body').appendChild(meta);
  }
}

function finishTurn(turn) {
  stopHeartbeat();
  state.chat.running = false;
  state.currentRun = null;
  document.querySelectorAll('.run-thinking').forEach(el => el.remove());
  updateChatStatus();
  updateTurnDOM(turn);
  saveChatHistory();
  _reloadQuiet();
}

// ---------------------------------------------------------------------------
// Public: startChatRun
// ---------------------------------------------------------------------------

export async function startChatRun(turn, prompt) {
  const runId = newId('run');
  if (!state.chat.cliSessionId) {
    state.chat.cliSessionId = crypto.randomUUID();
    state.chat.cliSessionEstablished = false;
  }
  const sessionEstablishedAtStart = state.chat.cliSessionEstablished;
  state.currentRun = { runId, turn, startedAt: Date.now() };
  startHeartbeat();

  let exitCode = null;
  let resultData = null;

  try {
    await streamRun(prompt, runId, evt => {
      if (evt.event === 'event') {
        try {
          const obj = JSON.parse(evt.data);
          handleStreamEvent(obj, turn);
          if (obj.type === 'result') resultData = obj;
        } catch { /* JSON parse fail — skip */ }
      } else if (evt.event === 'stderr') {
        appendEventToTurn(turn, { kind: 'error', ico: '!', title: 'Aviso', detail: evt.data });
      } else if (evt.event === 'done') {
        try { exitCode = JSON.parse(evt.data).exitCode; } catch {}
      }
    }, {
      sessionId: sessionEstablishedAtStart ? null : state.chat.cliSessionId,
      resumeSession: sessionEstablishedAtStart ? state.chat.cliSessionId : null,
      model: state.chat.model,
    });
  } catch (e) {
    appendEventToTurn(turn, { kind: 'error', ico: '!', title: 'Conexão caiu', detail: e.message || '' });
    turn.status = 'error';
    finishTurn(turn);
    return;
  }

  if (exitCode === 0 || resultData?.subtype === 'success') {
    turn.status = 'done';
    state.chat.cliSessionEstablished = true;
  } else if (exitCode === null) {
    turn.status = 'done';
  } else {
    turn.status = 'error';
  }
  if (resultData) {
    turn.meta = {
      duration_ms: resultData.duration_ms,
      total_cost_usd: resultData.total_cost_usd,
      num_turns: resultData.num_turns,
    };
  }
  finishTurn(turn);
}

// ---------------------------------------------------------------------------
// Public: attachStreamListeners — bind cancel button pós-mount
// ---------------------------------------------------------------------------

export function attachStreamListeners(container, ctx) {
  // Bind cancel button (also bound in chat.js onMount, kept here for completeness)
  const cancel = container.querySelector('#chat-cancel-btn');
  if (cancel) {
    cancel.onclick = async () => {
      const run = state.currentRun;
      if (run) await apiCancel(run.runId);
    };
  }

  // Re-tick heartbeat se já estava rodando ao montar o painel
  if (state.chat.running && state.currentRun) {
    tickHeartbeat();
  }
}

// ---------------------------------------------------------------------------
// Public: dispatchRun — entry point chamado por chat.js submit
// ---------------------------------------------------------------------------

export function dispatchRun(prompt, opts = {}) {
  if (state.chat.running) {
    // toast via ctx não disponível aqui — importar dom
    import('../core/dom.js').then(({ toast }) => toast('Espera o turno atual terminar.'));
    return;
  }
  const attachments = (opts.attachments || [])
    .filter(a => a && a.path)
    .map(a => ({ path: a.path, name: a.name || a.path, mime: a.mime || '' }));
  const userTurn = {
    id: newId('u'),
    kind: 'user',
    text: prompt,
    skill: opts.skill || null,
    label: opts.label || null,
    attachments,
  };
  const assistantTurn = {
    id: newId('a'),
    kind: 'assistant',
    events: [],
    status: 'running',
    meta: null,
  };
  state.chat.turns.push(userTurn, assistantTurn);
  state.chat.running = true;

  const finalPrompt = attachments.length
    ? attachments.map(a => `[Imagem anexada: ${a.path}]`).join('\n') + (prompt ? '\n\n' + prompt : '')
    : prompt;

  // Navegar pro chat e dar um frame antes de iniciar o stream
  // (setActive importado dinamicamente pra evitar circular)
  import('../core/router.js')
    .then(({ setActive }) => {
      setActive('chat');
      requestAnimationFrame(() => startChatRun(assistantTurn, finalPrompt));
    })
    .catch(() => {
      // fallback direto caso router não esteja disponível
      requestAnimationFrame(() => startChatRun(assistantTurn, finalPrompt));
    });
}
