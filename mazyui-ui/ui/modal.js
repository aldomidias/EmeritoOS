// Onda 1.G — Modal de skill + modal "Primeiros passos"
// Portado de:
//   mazyui-ui.js:2313 (openSkillModal) + :2871 (closeModal)
//   mazyui-ui.js:1121 (openGuideModal) + :1169 (closeGuideModal)
//
// Os backdrops (#modal-backdrop e #guide-backdrop) já existem no
// mazyui-ui.html — este módulo apenas adiciona/remove a classe `.open`
// e registra listeners de backdrop-click e ESC.
//
// Nota: os listeners de backdrop-click e ESC são registrados uma única
// vez (ao importar o módulo) via _initListeners(), chamado ao final do
// arquivo.  Isso replica exatamente o comportamento do legacy, onde os
// addEventListener ficavam no escopo top-level do mazyui-ui.js.

// ─── estado interno ────────────────────────────────────────────────────────

/** Rastreia o modal ativo pra que ESC saiba qual fechar. */
const ACTIVE_MODAL = { type: null }; // 'skill' | 'guide' | null

// ─── skill modal ──────────────────────────────────────────────────────────────

/**
 * Abre o modal de skill com `skillName` e conteúdo HTML `content`.
 * Na arquitetura modular (Onda 2.D) o panels/skills.js passará
 * kicker, título e formHTML; aqui recebemos como objetos opcionais
 * para máxima flexibilidade de chamada.
 *
 * Assinatura compatível com o contrato de CONTRACTS.md:
 *   openSkillModal(skillId: string): void
 * Assinatura estendida aceita por chamadas internas:
 *   openSkillModal(skillName, { kicker?, title?, bodyHTML?, footHTML? })
 *
 * Portado de mazyui-ui.js:2313.
 * @param {string} skillName
 * @param {{ kicker?: string; title?: string; bodyHTML?: string; footHTML?: string } | string} [content]
 */
export function openSkillModal(skillName, content) {
  const backdrop = document.getElementById('modal-backdrop');
  if (!backdrop) {
    console.warn('[modal] #modal-backdrop não encontrado no DOM');
    return;
  }

  // Preenche elementos opcionais se existirem no DOM
  const kicker = document.getElementById('modal-kicker');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footEl = document.getElementById('modal-foot');

  if (typeof content === 'object' && content !== null) {
    if (kicker && content.kicker != null) kicker.textContent = content.kicker;
    if (titleEl && content.title != null) titleEl.textContent = content.title;
    if (bodyEl && content.bodyHTML != null) bodyEl.innerHTML = content.bodyHTML;
    if (footEl && content.footHTML != null) footEl.innerHTML = content.footHTML;
  } else if (typeof content === 'string') {
    // string simples → vai pro body como HTML
    if (bodyEl) bodyEl.innerHTML = content;
  }
  // Se nenhum content foi passado, assume que o chamador já preencheu os
  // elementos antes de chamar openSkillModal (padrão do legacy).

  ACTIVE_MODAL.type = 'skill';
  backdrop.classList.add('open');
  // Failsafe: força display caso alguma regra CSS de cliente esteja interferindo
  // (ex: local-ui.css com !important). Se o usuário tiver overriden, fica claro
  // que o modal está abrindo.
  backdrop.style.display = 'flex';
}

/**
 * Fecha o modal de skill.
 * Portado de mazyui-ui.js:2871.
 */
export function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) {
    backdrop.classList.remove('open');
    backdrop.style.display = '';  // limpa o failsafe inline do openSkillModal
  }
  if (ACTIVE_MODAL.type === 'skill') ACTIVE_MODAL.type = null;
}

// ─── guide modal ─────────────────────────────────────────────────────────────

/**
 * Abre o modal "Primeiros passos" com conteúdo gerado/passado.
 * Aceita HTML string opcional; se omitido, usa o HTML padrão do legacy
 * (guia de onboarding).
 * Portado de mazyui-ui.js:1121.
 * @param {string} [guideContent]  HTML a injetar em #guide-body (opcional)
 */
export function openGuideModal(guideContent) {
  const backdrop = document.getElementById('guide-backdrop');
  if (!backdrop) return;

  if (guideContent != null) {
    const body = document.getElementById('guide-body');
    if (body) body.innerHTML = guideContent;
  }

  ACTIVE_MODAL.type = 'guide';
  backdrop.classList.add('open');
}

/**
 * Fecha o modal "Primeiros passos".
 * Portado de mazyui-ui.js:1169.
 */
export function closeGuideModal() {
  const backdrop = document.getElementById('guide-backdrop');
  if (backdrop) backdrop.classList.remove('open');
  if (ACTIVE_MODAL.type === 'guide') ACTIVE_MODAL.type = null;
}

// ─── listeners globais ────────────────────────────────────────────────────────

/**
 * Registra listeners de backdrop-click e ESC.
 * Chamado uma vez ao importar o módulo (equivalente ao top-level do
 * legacy, mazyui-ui.js:2874-2880 e :3599-3603).
 *
 * ESC: decisão de arquitetura — o handler de ESC mora AQUI (não em
 * shell.js) pra encapsular a lógica de modal num único módulo.
 * shell.js (Onda 2.D) pode re-usar importando closeModal/closeGuideModal.
 */
function _initListeners() {
  function _listen(el, event, fn) {
    if (el && typeof el.addEventListener === 'function') el.addEventListener(event, fn);
  }

  // Backdrop-click: skill modal
  const skillBackdrop = document.getElementById('modal-backdrop');
  _listen(skillBackdrop, 'click', (e) => {
    if (e.target === skillBackdrop) closeModal();
  });

  // Botão X do guide-modal
  const guideClose = document.getElementById('guide-close');
  _listen(guideClose, 'click', closeGuideModal);

  // Backdrop-click: guide modal
  const guideBackdrop = document.getElementById('guide-backdrop');
  _listen(guideBackdrop, 'click', (e) => {
    if (e.target === guideBackdrop) closeGuideModal();
  });

  // ESC global — fecha o modal ativo (skill ou guide)
  _listen(document, 'keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (ACTIVE_MODAL.type === 'skill') closeModal();
    else if (ACTIVE_MODAL.type === 'guide') closeGuideModal();
  });
}

// Guard: só inicializa quando há DOM (browser). Em Node (smoke test) o
// document.getElementById retorna null/undefined — _initListeners é
// chamado mas não lança porque todos os ifs guardam o null.
_initListeners();
