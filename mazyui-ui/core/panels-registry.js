// Onda 1.D — Registry de painéis + bridge window.Sabec
// Implementação portada de mazyui-ui.js:270-315 (customPanels, makePanelCtx, window.Sabec)
// + :2024 (render → mount/unmount lifecycle).
//
// Este módulo é o ÚNICO autorizado a re-exportar lit-html pro ctx.v2.
// Os módulos internos podem importar direto de '../vendor/lit-html.js'.

import { html, render } from '../vendor/lit-html.js';
import { state, subscribe } from './state.js';
import { apiCall, fileUrl } from './api.js';
import { toast, escapeHtml } from './dom.js';

// id -> { def, version: 1 | 2 }
const panels = new Map();

// { id, def, version, cleanup? } | null
let currentMounted = null;

// Importados lazily via setActive/setTopbar proxies — ver nota sobre import circular
// abaixo. router.js importa panels-registry.js, então panels-registry NÃO pode
// importar router.js directamente (ciclo). A solução é receber as funções via
// setRouterCallbacks(), chamado por router.js durante sua inicialização.
let _setActive = null;
let _setTopbar = null;

/**
 * Chamado por router.js durante boot pra fechar o ciclo sem import circular.
 * @param {{ setActive: Function, setTopbar: Function }} callbacks
 */
export function setRouterCallbacks({ setActive, setTopbar }) {
  _setActive = setActive;
  _setTopbar = setTopbar;
}

// ---------------------------------------------------------------------------
// ctx factories — semântica byte-a-byte de mazyui-ui.js:273-301
// ---------------------------------------------------------------------------

function makeCtxV1() {
  return {
    state,
    setTopbar: (crumb, title, actionsHTML) => {
      if (_setTopbar) _setTopbar(crumb, title, actionsHTML);
    },
    setActive: (id) => {
      if (_setActive) _setActive(id);
    },
    api: {
      call: apiCall,
    },
    fileUrl,
    toast,
    escapeHtml,
  };
}

function makeCtxV2() {
  return {
    ...makeCtxV1(),
    html,
    render,
    subscribe,
  };
}

// ---------------------------------------------------------------------------
// Registro público
// ---------------------------------------------------------------------------

/**
 * Registra painel v1 (contrato frozen — byte-a-byte de mazyui-ui.js:304-311).
 * @param {Object} def
 */
export function registerPanel(def) {
  if (!def || typeof def !== 'object' || !def.id || typeof def.onMount !== 'function') {
    console.warn('[mazyui] registerPanel: esperado { id, label, onMount, ... }', def);
    return;
  }
  panels.set(def.id, { def, version: 1 });
  if (state.loaded && _setActive) {
    // força re-render da nav (shell vai chamar renderNav via _navRenderer no router)
    _setActive(state.active);
  }
}

/**
 * Registra painel v2 (lit-html reactivo).
 * @param {Object} def
 */
export function registerPanelV2(def) {
  if (!def || typeof def !== 'object' || !def.id) {
    console.warn('[mazyui] v2.registerPanel: esperado { id, label, view, ... }', def);
    return;
  }
  if (typeof def.onMount !== 'function' && typeof def.view !== 'function') {
    console.warn('[mazyui] v2.registerPanel: esperado onMount ou view como function', def);
    return;
  }
  panels.set(def.id, { def, version: 2 });
  if (state.loaded && _setActive) {
    _setActive(state.active);
  }
}

// API interna preferida por panels/*.js (aceita v1 ou v2 discriminado por def.v2)
export function registerInternal(def) {
  if (def && def.v2) {
    registerPanelV2(def);
  } else {
    registerPanel(def);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: mount / unmount
// ---------------------------------------------------------------------------

/**
 * Desmonta o painel atualmente montado (chama onUnmount + cleanup).
 */
export function unmountActive() {
  if (!currentMounted) return;
  const { def, cleanup } = currentMounted;
  if (typeof def.onUnmount === 'function') {
    try { def.onUnmount(); } catch (e) { console.error('[mazyui] onUnmount error', e); }
  }
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch (e) { console.error('[mazyui] cleanup error', e); }
  }
  currentMounted = null;
}

/**
 * Monta o painel `id` no `container`.
 * @param {string} id
 * @param {HTMLElement} container
 * @returns {Promise<boolean>} false se painel não encontrado
 */
export async function mountPanel(id, container) {
  // 1. Desmonta o painel anterior
  unmountActive();

  // 2. Busca entry no Map
  const entry = panels.get(id);
  if (!entry) return false;

  // 3. Cria um wrapper fresco dentro do container hospedeiro. Cada mount escreve
  //    nesse wrapper, não no #content direto. Isso isola o estado de render
  //    de cada painel (especialmente o ChildPart do lit-html, que fica
  //    grudado no Element em que foi montado). v1 → v2 → v1 funciona limpo.
  container.innerHTML = '';
  const host = document.createElement('div');
  host.className = 'panel-host';
  host.style.cssText = 'display:contents';
  container.appendChild(host);

  const { def, version } = entry;

  // 4. v1 — onMount recebe wrapper + ctxV1
  if (version === 1) {
    try {
      const ctx = makeCtxV1();
      await def.onMount(host, ctx);
      currentMounted = { id, def, version };
    } catch (e) {
      console.error('[mazyui] onMount error (v1)', id, e);
      host.innerHTML = `<div class="card" style="color:var(--red,#f55)">
        <b>Erro ao montar painel "${escapeHtml(id)}"</b><br>
        <pre style="white-space:pre-wrap;font-size:0.85em">${escapeHtml(String(e))}</pre>
      </div>`;
      currentMounted = { id, def, version };
    }
    return true;
  }

  // 4. v2 — lit-html toma posse do wrapper
  if (version === 2) {
    const ctx = makeCtxV2();

    let unsubscribe = null;

    const doRender = () => {
      try {
        if (typeof def.view === 'function') {
          render(def.view(ctx), host);
        }
      } catch (e) {
        console.error('[mazyui] v2 render error', id, e);
      }
    };

    try {
      if (typeof def.onMount === 'function') {
        // v2 onMount recebe host (não container) — consistente com v1
        await def.onMount(host, ctx);
      }
      if (typeof def.view === 'function') {
        doRender();
      }

      // Auto re-render via subscribe, a menos que reactive === false
      if (def.reactive !== false && typeof def.view === 'function') {
        unsubscribe = subscribe(() => doRender());
      }
    } catch (e) {
      console.error('[mazyui] onMount error (v2)', id, e);
    }

    currentMounted = { id, def, version, cleanup: unsubscribe || undefined };
    return true;
  }

  return false;
}

// Alias pra compatibilidade com o contrato (CONTRACTS.md exporta mountActive)
export function mountActive() {
  const id = state.active || 'hoje';
  const container = document.getElementById('content');
  if (!container) return;
  return mountPanel(id, container);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getPanel(id) {
  const entry = panels.get(id);
  return entry ? entry.def : undefined;
}

/**
 * Retorna lista de painéis com sidebar !== false, em ordem de registro.
 * @returns {{ id: string, label: string, glyph: string, crumb: string }[]}
 */
export function listSidebarPanels() {
  const result = [];
  for (const [id, { def }] of panels) {
    if (def.sidebar !== false) {
      result.push({ id, label: def.label || id, glyph: def.glyph || '', crumb: def.crumb || def.label || id });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Ctx factory exposta (CONTRACTS.md: makeCtx(def))
// ---------------------------------------------------------------------------

export function makeCtx(def) {
  if (def && def.v2) return makeCtxV2();
  return makeCtxV1();
}

// ---------------------------------------------------------------------------
// Bridge global — NÃO escrever em window aqui. index.js faz `window.Sabec = Sabec`.
// ---------------------------------------------------------------------------

export const Sabec = {
  registerPanel,
  setActive(id) {
    if (_setActive) _setActive(id);
  },
  setTopbar(crumb, title, actions) {
    if (_setTopbar) _setTopbar(crumb, title, actions || '');
  },
  toast,
  v2: {
    registerPanel: registerPanelV2,
  },
};
