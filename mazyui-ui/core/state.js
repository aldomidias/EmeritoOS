// Onda 1.B — Store reativo
// Shape portado de mazyui-ui.js:235-261.
//
// IMPORTANTE: mutações diretas em `state.foo = x` (estilo v1) NÃO disparam
// subscribers. Apenas `update(patch)` dispara. Isso é intencional:
// - Painéis v1 que lêem `ctx.state.foo` continuam funcionando (referência viva).
// - Painéis v2 que precisam reagir a mudanças usam `subscribe()` / `update()`.

export const state = {
  active: 'hoje',
  loaded: false,
  folderName: '',
  memory: { empresa: '', preferencias: '', estrategia: '' },
  identidade: '',
  logo: null,              // { path, size, mtime } | null
  contentEditing: {},
  library: [],
  business: { name: '—', tagline: '—' },
  currentRun: null,
  lightboxIdx: null,
  lightboxSlide: 0,        // slide ativo dentro do lightbox (IG-style)
  lightboxFormat: null,    // formato ativo no lightbox (null = primário do item)
  slideRuns: {},           // `${itemName}::${slideIdx}` -> { runId, startedAt, timer }
  slideModel: null,        // modelo das edições inline; hidrata no boot
  identityHistory: [],     // pilha de undo pra edições do design-guide.md
  chat: {
    turns: [],             // [{ id, kind: 'user'|'assistant', ... }]
    cliSessionId: null,    // UUID estável da sessão Claude CLI desse chat
    cliSessionEstablished: false, // true depois da 1ª msg bem-sucedida
    running: false,
    model: null,           // hydrated in boot
    sessionId: null,       // id da sessão arquivada associada (null = fresca)
    attachments: [],       // [{ id, name, dataUrl, path, status, error? }]
  },
};

export const IDENTITY_HISTORY_MAX = 20;

// --- Subscribers ---------------------------------------------------------

/** @type {Set<(state: typeof state) => void>} */
const _subscribers = new Set();

/** Pending microtask flush flag — garante 1 notify por batch de updates. */
let _pending = false;

function _flush() {
  _pending = false;
  for (const fn of _subscribers) {
    try { fn(state); } catch (e) { console.error('[state] subscriber error', e); }
  }
}

/**
 * Adiciona subscriber. Retorna função pra remover (unsubscribe).
 * @param {(state: typeof state) => void} fn
 * @returns {() => void}
 */
export function subscribe(fn) {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

/**
 * Aplica shallow-merge no state (Object.assign nos nós top-level) e agenda
 * notificação dos subscribers via queueMicrotask — múltiplos updates no
 * mesmo tick disparam APENAS 1 callback por subscriber (debounce por batch).
 *
 * Shallow nos nós top-level: `update({ chat: { running: true } })` substitui
 * o objeto `state.chat` inteiro. Para merge parcial de sub-objeto, passe o
 * valor mesclado: `update({ chat: { ...state.chat, running: true } })`.
 *
 * @param {Partial<typeof state>} patch
 */
export function update(patch) {
  Object.assign(state, patch);
  if (!_pending) {
    _pending = true;
    queueMicrotask(_flush);
  }
}
