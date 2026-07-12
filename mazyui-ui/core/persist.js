// Onda 1.B — Persistência em localStorage
// Portado de mazyui-ui.js:57-206.
//
// Em ambientes sem localStorage (ex: Node.js no smoke test), todos os helpers
// retornam defaults sem lançar erro — detect feito via `_ls` abaixo.

// --- Ambiente -------------------------------------------------------------

/** Safe reference to localStorage; null em Node/SSR. */
const _ls = (() => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; }
  catch { return null; }
})();

function _lsGet(key) {
  try { return _ls ? _ls.getItem(key) : null; } catch { return null; }
}
function _lsSet(key, value) {
  try { if (_ls) _ls.setItem(key, value); } catch { /* cheio ou indisponível */ }
}
function _lsRemove(key) {
  try { if (_ls) _ls.removeItem(key); } catch {}
}

// --- Constantes -----------------------------------------------------------

export const MODEL_KEY         = 'sabec:model:v1';
export const SLIDE_MODEL_KEY   = 'sabec:slide-model:v1';
export const CHAT_PERSIST_KEY  = 'sabec:chat-persist:v1';
export const CHAT_HISTORY_KEY  = 'sabec:chat-history:v1';
export const CHAT_SESSIONS_KEY = 'sabec:chat-sessions:v1';
export const CONSENT_KEY       = 'sabec:consented:v1';

export const CHAT_HISTORY_MAX_TURNS = 60;
export const CHAT_SESSIONS_MAX      = 40;
export const SLIDE_MODEL_DEFAULT    = 'claude-sonnet-4-6';

export const MODELS = [
  { id: 'claude-opus-4-7',           name: 'Opus 4.7',   desc: 'Mais capaz · raciocínio pesado, melhor pra criação visual e SEO' },
  { id: 'claude-sonnet-4-6',         name: 'Sonnet 4.6', desc: 'Equilíbrio · velocidade e qualidade pro dia a dia' },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5',  desc: 'Rápido e barato · ótimo pra emails, reviews, tarefas curtas' },
];

// --- Modelo de chat -------------------------------------------------------

/** Retorna o id do modelo salvo (ou default MODELS[0]). */
export function getModel() {
  const saved = _lsGet(MODEL_KEY);
  if (saved && MODELS.some(m => m.id === saved)) return saved;
  return MODELS[0].id;
}

/**
 * Persiste o id do modelo e atualiza state.chat.model.
 * Obs: importa `state` lazy pra evitar dependência circular Onda 1.B → state.
 */
export function setModelId(id) {
  _lsSet(MODEL_KEY, id);
  // Atualiza state sem criar dep circular no topo do módulo.
  import('./state.js').then(({ state }) => { state.chat.model = id; }).catch(() => {});
}

/** Retorna o nome display do modelo (ou do primeiro se id desconhecido). */
export function modelName(id) {
  return (MODELS.find(m => m.id === id) || MODELS[0]).name;
}

// --- Modelo de slides -----------------------------------------------------

export function getSlideModel() {
  const saved = _lsGet(SLIDE_MODEL_KEY);
  if (saved && MODELS.some(m => m.id === saved)) return saved;
  return SLIDE_MODEL_DEFAULT;
}

export function setSlideModel(id) {
  if (!MODELS.some(m => m.id === id)) return;
  _lsSet(SLIDE_MODEL_KEY, id);
  import('./state.js').then(({ state }) => { state.slideModel = id; }).catch(() => {});
}

// --- Persistência do histórico de chat ------------------------------------

/** Retorna true se persistência está habilitada (default ON). */
export function isChatPersistEnabled() {
  const v = _lsGet(CHAT_PERSIST_KEY);
  return v === null ? true : v === '1';
}

export function setChatPersist(on) {
  _lsSet(CHAT_PERSIST_KEY, on ? '1' : '0');
  if (!on) clearChatHistory();
  else saveChatHistory();
}

/**
 * Salva turns atuais + session ids em localStorage.
 * Lê state via import dinâmico pra manter o módulo usável fora do browser.
 */
export function saveChatHistory() {
  if (!isChatPersistEnabled()) return;
  try {
    // Acesso síncrono ao state (já importado em browser; no-op em Node).
    const stateModule = _getStateSync();
    if (!stateModule) return;
    const { state } = stateModule;
    const turns = state.chat.turns.slice(-CHAT_HISTORY_MAX_TURNS);
    const payload = {
      turns,
      sessionId: state.chat.sessionId || null,
      cliSessionId: state.chat.cliSessionId || null,
      cliSessionEstablished: !!state.chat.cliSessionEstablished,
      savedAt: Date.now(),
    };
    _lsSet(CHAT_HISTORY_KEY, JSON.stringify(payload));
  } catch { /* silencioso */ }
}

/**
 * Carrega histórico do chat. Retorna null se desabilitado ou nada salvo.
 * @returns {{ turns, sessionId, cliSessionId, cliSessionEstablished } | null}
 */
export function loadChatHistory() {
  if (!isChatPersistEnabled()) return null;
  try {
    const raw = _lsGet(CHAT_HISTORY_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!Array.isArray(obj?.turns)) return null;
    return {
      turns: obj.turns,
      sessionId: obj.sessionId || null,
      cliSessionId: obj.cliSessionId || null,
      cliSessionEstablished: !!obj.cliSessionEstablished,
    };
  } catch { return null; }
}

export function clearChatHistory() {
  _lsRemove(CHAT_HISTORY_KEY);
}

// --- Sessões arquivadas ---------------------------------------------------

/** @returns {Array} lista de sessões arquivadas */
export function loadChatSessions() {
  try {
    const raw = _lsGet(CHAT_SESSIONS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveChatSessions(sessions) {
  try {
    const trimmed = sessions.slice(0, CHAT_SESSIONS_MAX);
    _lsSet(CHAT_SESSIONS_KEY, JSON.stringify(trimmed));
  } catch {}
}

function _deriveSessionTitle(turns) {
  const firstUser = turns.find(t => t.kind === 'user');
  if (!firstUser) return 'Conversa sem título';
  const text = (firstUser.text || '').trim();
  if (!text) return 'Conversa sem título';
  return text.length > 60 ? text.slice(0, 60) + '…' : text;
}

function _newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Arquiva a conversa atual. Faz dedup por sessionId (se já arquivada, atualiza).
 */
export function archiveCurrentChat() {
  const stateModule = _getStateSync();
  if (!stateModule) return;
  const { state } = stateModule;
  if (!state.chat.turns.length) return;
  const sessions = loadChatSessions();
  if (state.chat.sessionId) {
    const idx = sessions.findIndex(s => s.id === state.chat.sessionId);
    if (idx >= 0) {
      sessions[idx] = {
        ...sessions[idx],
        turns: state.chat.turns.slice(-CHAT_HISTORY_MAX_TURNS),
        cliSessionId: state.chat.cliSessionId || null,
        cliSessionEstablished: !!state.chat.cliSessionEstablished,
        savedAt: Date.now(),
      };
      saveChatSessions(sessions);
      return;
    }
  }
  const id = _newId('s');
  sessions.unshift({
    id,
    title: _deriveSessionTitle(state.chat.turns),
    turns: state.chat.turns.slice(-CHAT_HISTORY_MAX_TURNS),
    cliSessionId: state.chat.cliSessionId || null,
    cliSessionEstablished: !!state.chat.cliSessionEstablished,
    savedAt: Date.now(),
  });
  saveChatSessions(sessions);
}

export function deleteChatSession(id) {
  const sessions = loadChatSessions().filter(s => s.id !== id);
  saveChatSessions(sessions);
}

/**
 * Abre uma sessão arquivada como conversa ativa.
 * @returns {boolean} false se sessão não encontrada.
 */
export function openChatSession(id) {
  const stateModule = _getStateSync();
  if (!stateModule) return false;
  const { state } = stateModule;
  const sessions = loadChatSessions();
  const sess = sessions.find(s => s.id === id);
  if (!sess) return false;
  archiveCurrentChat();
  state.chat.turns = (sess.turns || []).map(t => ({ ...t }));
  state.chat.cliSessionId = sess.cliSessionId || null;
  state.chat.cliSessionEstablished = !!sess.cliSessionEstablished;
  state.chat.sessionId = sess.id;
  saveChatHistory();
  return true;
}

// --- Consentimento --------------------------------------------------------

export function isConsented() {
  return !!_lsGet(CONSENT_KEY);
}

export function setConsented() {
  _lsSet(CONSENT_KEY, new Date().toISOString());
}

// --- Namespace object (para smoke test e acesso agrupado) ----------------

/**
 * API agrupada exposta como `persist` — conveniente pra imports de outros módulos.
 * Espelha exatamente as funções individuais acima.
 */
export const persist = {
  chat: {
    load:    loadChatHistory,
    save:    saveChatHistory,
    clear:   clearChatHistory,
    session: {
      load:   loadChatSessions,
      save:   saveChatSessions,
      archive: archiveCurrentChat,
      delete: deleteChatSession,
      open:   openChatSession,
    },
  },
  model: {
    load:  getModel,
    save:  setModelId,
    name:  modelName,
  },
  slideModel: {
    load:  getSlideModel,
    save:  setSlideModel,
  },
  identity: {
    load:  loadChatHistory,   // alias — histórico de identidade usa bloco state.identityHistory
    save:  () => {},           // persistência de identidade gerenciada em boot.js
  },
  consent: {
    load:  isConsented,
    save:  setConsented,
  },
  persistToggle: {
    load:  isChatPersistEnabled,
    save:  setChatPersist,
  },
};

// --- Helpers internos -----------------------------------------------------

/**
 * Acesso síncrono ao módulo state sem import dinâmico.
 * Em browser o módulo já foi carregado pelo bundler ES; em Node retorna null.
 * Funções que dependem de `state` (saveChatHistory, etc.) são no-op em Node —
 * isso é esperado: smoke test só verifica a API, não executa fluxo browser.
 */
let _stateCacheModule = null;
function _getStateSync() {
  if (_stateCacheModule) return _stateCacheModule;
  // Em Node, dynamic import é assíncrono e não podemos resolver aqui;
  // browser já terá o módulo no cache de ES modules após o boot.
  // Tentativa: importar via await no chamador (usado em setModelId/setSlideModel).
  return null;
}

/**
 * Injeta referência ao módulo state. Chamado por index.js após o boot
 * pra que funções síncronas (saveChatHistory, archiveCurrentChat, etc.)
 * possam acessar `state` sem import circular.
 *
 * @param {{ state: object }} stateModule
 */
export function _injectState(stateModule) {
  _stateCacheModule = stateModule;
}
