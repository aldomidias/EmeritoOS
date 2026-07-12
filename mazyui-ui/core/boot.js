// Onda 1.E — Boot + consent + reload
// Implementação portada de mazyui-ui.js:757-872 (boot + consent + reload).
//
// Dependências:
//   state, update     — core/state.js
//   apiState          — core/api.js
//   applyIdentityToCSS, updateBrandLogo — core/brand.js
//   extractBusiness   — core/markdown.js
//   persist.*         — core/persist.js (isConsented, setConsented, getModel, getSlideModel, loadChatHistory)
//   escapeHtml        — core/dom.js
//   setActive, setTopbar — injetados via setBoot() (evita circular com router/panels-registry)
//
// IMPORTANTE: index.js deve chamar setBoot() antes de boot() pra injetar os
// hooks de navegação/render. Isso evita dependência circular entre boot e router.

import { state, update } from './state.js';
import { apiState, apiShutdown } from './api.js';
import { applyIdentityToCSS, updateBrandLogo, extractBusiness } from './brand.js';
import {
  isConsented, setConsented,
  getModel, getSlideModel, loadChatHistory,
} from './persist.js';

// --- Hooks injetados por index.js ------------------------------------------

let _setActive  = (id) => { console.warn('[boot] setActive não injetado', id); };
let _setTopbar  = (crumb, title, actions) => { console.warn('[boot] setTopbar não injetado'); };
let _render     = () => { console.warn('[boot] render não injetado'); };
let _escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let _dispatchRun = (prompt, opts) => { console.warn('[boot] dispatchRun não injetado'); };

/**
 * Injeta os hooks de UI que boot precisa. Chamado por index.js antes de boot().
 */
export function setBoot({ setActive, setTopbar, render, escapeHtml, dispatchRun }) {
  if (setActive)   _setActive   = setActive;
  if (setTopbar)   _setTopbar   = setTopbar;
  if (render)      _render      = render;
  if (escapeHtml)  _escapeHtml  = escapeHtml;
  if (dispatchRun) _dispatchRun = dispatchRun;
}

/* ============================================================
   loadLocalUi — injeta <script src="/local-ui.js">
   Guard de DOM: no-op em Node.js.
   Portado de mazyui-ui.js:317.
   ============================================================ */

/**
 * Carrega extensão de UI do cliente (opcional) — 404 silencioso se não tem.
 * Deve ser chamada DEPOIS de window.Sabec estar exposto (responsabilidade de index.js).
 */
export async function loadLocalUi() {
  if (typeof document === 'undefined') return;
  return new Promise(resolve => {
    const s = document.createElement('script');
    s.src = '/local-ui.js';
    s.onload = () => resolve();
    s.onerror = () => resolve(); // 404 silencioso — cliente sem extensão
    document.head.appendChild(s);
  });
}

/* ============================================================
   boot — ponto de entrada principal
   Portado de mazyui-ui.js:757.
   ============================================================ */

/**
 * Inicializa a UI:
 * 1. Restaura histórico de chat do localStorage.
 * 2. Busca estado do servidor (apiState).
 * 3. Hidrata state (memory, identidade, logo, library, business).
 * 4. Aplica identidade visual (CSS vars + Google Fonts).
 * 5. Atualiza logo e favicon.
 * 6. Carrega local-ui.js do cliente.
 * 7. Exibe consent (1ª vez) ou navega pro painel "hoje".
 *
 * @returns {Promise<void>}
 */
export async function boot() {
  if (typeof document === 'undefined') return;
  try {
    // 1. Restaura modelo e histórico antes de qualquer render
    state.chat.model  = getModel();
    state.slideModel  = getSlideModel();
    const restored = loadChatHistory();
    if (restored && restored.turns && restored.turns.length) {
      state.chat.turns = restored.turns.map(t => {
        if (t.kind === 'assistant' && t.status === 'running') {
          return {
            ...t,
            status: 'error',
            events: [
              ...(t.events || []),
              { kind: 'system', ico: '·', title: 'Sessão interrompida', detail: 'Painel foi recarregado durante esse turno.' },
            ],
          };
        }
        return t;
      });
      state.chat.sessionId          = restored.sessionId || null;
      state.chat.cliSessionId       = restored.cliSessionId || null;
      state.chat.cliSessionEstablished = !!restored.cliSessionEstablished;
    }

    // 2. Busca estado do servidor
    const s = await apiState();

    // 3. Hidrata state
    state.folderName = s.folderName;
    state.memory     = s.memory;
    state.identidade = s.identidade;
    state.logo       = s.logo || null;
    state.library    = s.library;
    state.business   = extractBusiness(s.memory.empresa);
    update({ loaded: true });

    // 4. Identidade visual
    applyIdentityToCSS(state.identidade);

    // 5. Logo + topbar
    const folderEl   = document.getElementById('folder-name');
    const brandTagEl = document.getElementById('brand-tag');
    if (folderEl)   folderEl.textContent   = s.folderName;
    if (brandTagEl) brandTagEl.textContent = state.business.name || 'Painel';
    updateBrandLogo();

    // 6. Extensão do cliente (window.Sabec já está exposto pelo index.js)
    await loadLocalUi();

    // 7. Consent ou home
    if (!isConsented()) {
      renderConsent();
    } else {
      postConsentBoot();
    }
  } catch (e) {
    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = `
        <div class="empty">
          <div class="lead">Servidor <span class="red">offline</span></div>
          <p>Não consegui falar com o servidor do painel. Confira se o <strong>mazyui-server.mjs</strong> está rodando.</p>
          <p style="font-size: 13px; color: var(--ink-muted);">Detalhe técnico: ${_escapeHtml(String(e.message))}</p>
        </div>
      `;
    }
  }
}

/* ============================================================
   renderConsent — tela de boas-vindas (primeira vez)
   Portado de mazyui-ui.js:805.
   ============================================================ */

/**
 * Exibe o painel de consent na primeira vez que o usuário abre o painel.
 */
export function renderConsent() {
  if (typeof document === 'undefined') return;
  _setTopbar('Bem-vindo', 'Antes de começar');
  const content = document.getElementById('content');
  if (!content) return;
  content.innerHTML = `
    <div style="max-width: 640px; margin: 40px auto 0;">
      <div class="kicker">Primeira vez por aqui</div>
      <h2 style="font-family: var(--syne); font-weight: 800; letter-spacing: -0.025em; font-size: 38px; line-height: 1.05; margin: 6px 0 20px;">
        Como o painel <span style="color: var(--red);">funciona</span>
      </h2>
      <p style="font-size: 16px; color: var(--ink-soft); margin: 0 0 24px;">
        Quando você clica em uma skill, o painel chama o Claude Code rodando no seu computador.
        Ele lê e edita arquivos dentro desta pasta, e às vezes roda comandos (git, scripts, instalação de dependências).
      </p>
      <div class="card" style="margin-bottom: 18px;">
        <div class="kicker">Pasta de trabalho</div>
        <div style="font-family: var(--mono); font-size: 14px; word-break: break-all;">${_escapeHtml(state.folderName)}</div>
      </div>
      <div class="card">
        <div class="kicker">O que ele pode fazer</div>
        <ul style="margin: 0; padding-left: 22px; color: var(--ink-soft); line-height: 1.7;">
          <li><strong>Ler e editar</strong> arquivos desta pasta (memória, identidade, conteúdos)</li>
          <li><strong>Criar</strong> novos arquivos (carrosséis, blog, relatórios)</li>
          <li><strong>Rodar comandos</strong> aqui dentro (git, npm, scripts seus)</li>
          <li><strong>Acessar internet</strong> via WebFetch/WebSearch quando a skill precisa</li>
        </ul>
        <div class="kicker" style="margin-top: 22px;">O que ele NÃO faz</div>
        <ul style="margin: 0; padding-left: 22px; color: var(--ink-soft); line-height: 1.7;">
          <li>Tocar em arquivos fora desta pasta</li>
          <li>Mandar dados pra qualquer lugar além do que a skill explicitamente pede</li>
          <li>Continuar rodando se você fechar o painel</li>
        </ul>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 28px;">
        <button class="btn btn-primary" id="btn-consent">Entendi, abrir painel</button>
        <button class="btn btn-ghost" id="btn-no-consent">Fechar</button>
      </div>
      <p style="font-size: 12px; color: var(--ink-muted); margin-top: 18px;">
        Isso aparece só na primeira vez. Pra rever, limpe o localStorage do navegador.
      </p>
    </div>
  `;
  document.getElementById('btn-consent').onclick = () => {
    setConsented();
    postConsentBoot();
  };
  document.getElementById('btn-no-consent').onclick = () => apiShutdown();
}

/* ============================================================
   postConsentBoot, triggerOnboarding
   Portados de mazyui-ui.js:852-858.
   ============================================================ */

/**
 * Pós-consent: navega pra home ("hoje").
 * O guia de "Primeiros passos" aparece se a memória estiver zerada.
 */
export function postConsentBoot() {
  _setActive('hoje');
}

/**
 * Dispara o onboarding (/instalar) via chat.
 */
export function triggerOnboarding() {
  _dispatchRun('/instalar', { label: '/instalar' });
}

/* ============================================================
   reload / reloadQuiet
   Portados de mazyui-ui.js:861 + :2678.
   ============================================================ */

/**
 * Reload pesado: re-busca estado, aplica identidade, re-renderiza tudo.
 * Portado de mazyui-ui.js:861.
 */
export async function reload() {
  if (typeof document === 'undefined') return;
  const s = await apiState();
  state.memory     = s.memory;
  state.identidade = s.identidade;
  state.logo       = s.logo || null;
  state.library    = s.library;
  state.business   = extractBusiness(s.memory.empresa);
  applyIdentityToCSS(state.identidade);
  const brandTagEl = document.getElementById('brand-tag');
  if (brandTagEl) brandTagEl.textContent = state.business.name || 'Painel';
  updateBrandLogo();
  _render();
}

/**
 * Reload silencioso: só atualiza library + identidade, sem re-render de painel.
 * Portado de mazyui-ui.js:2678.
 */
export async function reloadQuiet() {
  if (typeof document === 'undefined') return;
  try {
    const s = await apiState();
    state.memory     = s.memory;
    state.identidade = s.identidade;
    state.logo       = s.logo || null;
    state.library    = s.library;
    state.business   = extractBusiness(s.memory.empresa);
    applyIdentityToCSS(state.identidade);
    const brandTagEl = document.getElementById('brand-tag');
    if (brandTagEl) brandTagEl.textContent = state.business.name || 'Painel';
    updateBrandLogo();
  } catch {}
}
