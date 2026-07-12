// Onda 1.D — Router (navegação entre painéis)
// Implementação portada de mazyui-ui.js:1028 (setActive) + :1029 (setTopbar) + :2024 (render).
//
// Nota de import circular: panels-registry.js importa router.js via setRouterCallbacks.
// router.js importa panels-registry.js. O ciclo é resolvido assim:
//   - router.js importa mountPanel/unmountActive de panels-registry.js (OK: ESM defers)
//   - panels-registry.js NÃO importa router.js; recebe callbacks via setRouterCallbacks()
//   - router.js chama setRouterCallbacks({ setActive, setTopbar }) no final deste módulo

import { state } from './state.js';
import { mountPanel, unmountActive, setRouterCallbacks } from './panels-registry.js';

// Callback registrável pra renderNav (injetado por ui/shell.js via setNavRenderer)
// Evita import circular com ui/nav.js que importaria panels-registry.js
let _navRenderer = null;

/**
 * Registra a função que repinta a sidebar.
 * Chamado por ui/shell.js (Onda 2.D) durante o boot.
 * @param {() => void} fn
 */
export function setNavRenderer(fn) {
  _navRenderer = fn;
}

// ---------------------------------------------------------------------------
// setTopbar — portado de mazyui-ui.js:1029-1033
// ---------------------------------------------------------------------------

/**
 * Atualiza breadcrumb, título e ações do topbar.
 * @param {string} crumb
 * @param {string} title
 * @param {string|null|undefined} actionsHTML
 */
export function setTopbar(crumb, title, actionsHTML) {
  const elCrumb = document.getElementById('crumb');
  const elTitle = document.getElementById('page-title');
  const elActions = document.getElementById('topbar-actions');
  if (elCrumb) elCrumb.textContent = crumb || '';
  if (elTitle) elTitle.textContent = title || '';
  if (elActions) elActions.innerHTML = actionsHTML != null ? actionsHTML : '';
}

// ---------------------------------------------------------------------------
// setActive — portado de mazyui-ui.js:1028
// ---------------------------------------------------------------------------

/**
 * Navega para o painel `id`.
 * @param {string} id
 */
export function setActive(id) {
  // 1. Atualiza state (mutação direta — compat v1; não dispara subscribers)
  state.active = id;

  // 2. Atualiza data-panel em #content e classe ativa no nav
  const content = document.getElementById('content');
  if (content) {
    content.setAttribute('data-panel', id);
  }

  // Atualiza classe ativa nos itens de nav
  const navItems = document.querySelectorAll('[data-nav-id]');
  for (const el of navItems) {
    if (el.getAttribute('data-nav-id') === id) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  }

  // 3. Monta o painel
  if (content) {
    mountPanel(id, content);
  }

  // 4. Dispara re-render da nav
  if (_navRenderer) {
    try { _navRenderer(); } catch (e) { console.error('[router] navRenderer error', e); }
  }
}

export function getActive() {
  return state.active || 'hoje';
}

// ---------------------------------------------------------------------------
// mountInitial — determina painel inicial e navega
// ---------------------------------------------------------------------------

export async function mountInitial() {
  const initial = state.active || 'hoje';
  setActive(initial);
}

// ---------------------------------------------------------------------------
// Fecha o ciclo: injeta setActive + setTopbar no panels-registry
// ---------------------------------------------------------------------------
setRouterCallbacks({ setActive, setTopbar });
