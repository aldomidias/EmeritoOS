// Onda 2.3 — Painel "Hoje" (dashboard de boas-vindas, home)
// Fonte: mazyui-ui.js:1159 (renderHoje) + :1227 (qaButton) + :1233 (memoryHealth).
//
// Portado pra v2 (lit-html reactivo via ctx.html / ctx.render).
// Suporta dois estados: filled (memória preenchida) e empty (setup ainda não rodou).

import { registerInternal } from '../core/panels-registry.js';
import { extractBusiness, extractFocus, extractTone, extractNextSteps } from '../core/markdown.js';
import { openSkillModal } from './skills.js';
import { openGuideModal } from '../ui/modal.js';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Retorna quantas das 4 fontes de memória estão preenchidas.
 * Portado de mazyui-ui.js:1233 (memoryHealth).
 *
 * @param {object} s — state snapshot
 * @returns {number} 0–4
 */
function memoryHealth(s) {
  let n = 0;
  if (s.memory?.empresa)      n++;
  if (s.memory?.preferencias) n++;
  if (s.memory?.estrategia)   n++;
  if (s.identidade)           n++;
  return n;
}

// ---------------------------------------------------------------------------
// Skills disponíveis como atalhos rápidos
// (espelha as calls do legacy renderHoje)
// ---------------------------------------------------------------------------
const QUICK_ACTIONS = [
  { skillId: 'abrir',             title: 'Resumo do dia',    desc: 'Carrega memória e responde "o que vamos fazer?"' },
  { skillId: 'carrossel',         title: 'Criar carrossel',  desc: 'Post 1080×1350 com a marca aplicada' },
  { skillId: 'publicar-tema',     title: 'Publicar tema',    desc: 'Tema → blog + carrossel + legendas' },
  { skillId: 'email-profissional',title: 'Escrever email',   desc: 'Rascunho com tom calibrado' },
  { skillId: 'relatorio-ads',     title: 'Relatório de ads', desc: 'Análise executiva de Google + Meta' },
  { skillId: 'salvar',            title: 'Salvar tudo',      desc: 'Commit + push no GitHub' },
];

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

export function register() {
  registerInternal({
    id:      'hoje',
    label:   'Hoje',
    glyph:   'H',
    crumb:   'Hoje',
    sidebar: true,
    v2:      true,

    /**
     * view(ctx) — chamado a cada re-render reativo pelo registry.
     * Retorna um TemplateResult lit-html.
     *
     * @param {import('../core/panels-registry.js').CtxV2} ctx
     */
    view(ctx) {
      const { html, state } = ctx;

      // --- extrai dados da memória ---
      const biz    = extractBusiness(state.memory?.empresa || '');
      const focus  = extractFocus(state.memory?.estrategia || '')
                       || 'Defina a prioridade principal em Estratégia.';
      const tone   = extractTone(state.memory?.preferencias || '');
      const steps  = extractNextSteps(state.memory?.estrategia || '');
      const filled = memoryHealth(state) > 0;

      /** Abre modal de skill via import direto de panels/skills.js. */
      const runSkill = (skillId) => {
        openSkillModal(skillId);
      };

      // --- variante vazia: memória ainda não preenchida ---
      if (!filled) {
        return html`
          <div class="section-head">
            <h2>Bem-vindo ao MazyUI</h2>
            <p>
              O sistema ainda não conhece seu negócio.
              Clique em <strong>Primeiros passos</strong> no topo
              pra ver o roteiro de setup.
            </p>
          </div>
        `;
      }

      // --- variante preenchida ---
      const bizName    = state.business?.name    || biz || '—';
      const bizTagline = state.business?.tagline || '—';
      const libCount   = Array.isArray(state.library) ? state.library.length : 0;

      return html`
        <div class="today-grid">

          <!-- Coluna esquerda: foco atual, tom de voz e próximas prioridades -->
          <div>
            <div class="focus-card">
              <div class="kicker">Foco atual</div>
              <h3>${bizName}</h3>
              <div style="color:rgba(245,240,232,0.6);font-size:14px;margin-bottom:12px;">
                ${bizTagline}
              </div>
              <div class="rule"></div>
              <p>${focus}</p>
              <div class="stat-row">
                <div class="stat">
                  <div class="num">${libCount}</div>
                  <div class="label">Conteúdos</div>
                </div>
              </div>
            </div>

            ${tone ? html`
              <div class="card" style="margin-top:18px;">
                <div class="kicker">Como o sistema escreve</div>
                <h3>Tom de voz</h3>
                <p style="margin:0;color:var(--ink-soft);">${tone}</p>
              </div>
            ` : ''}

            ${steps.length ? html`
              <div class="card">
                <div class="kicker">Próximas prioridades</div>
                <ol style="padding-left:20px;margin:0;">
                  ${steps.map(s => html`<li style="padding:5px 0;">${s}</li>`)}
                </ol>
              </div>
            ` : ''}
          </div>

          <!-- Coluna direita: atalhos de skills -->
          <div>
            <div class="kicker" style="margin-bottom:10px;">Ações rápidas</div>
            <div class="quick-actions">
              ${QUICK_ACTIONS.map(({ skillId, title, desc }) => html`
                <button class="qa-btn" @click=${() => runSkill(skillId)}>
                  <div>
                    <div class="qa-title">${title}</div>
                    <div class="qa-desc">${desc}</div>
                  </div>
                  <span class="arrow">→</span>
                </button>
              `)}
            </div>
          </div>

        </div>
      `;
    },

    /**
     * onMount — define topbar e anexa handlers dos botões de ação.
     * O conteúdo principal é gerenciado de forma reativa por view().
     *
     * @param {HTMLElement} _container
     * @param {import('../core/panels-registry.js').CtxV2} ctx
     */
    onMount(_container, ctx) {
      const bizName = ctx.state.business?.name || 'Bem-vindo';
      ctx.setTopbar('Hoje', bizName,
        `<button class="btn btn-secondary" id="btn-guide">Primeiros passos</button>
         <button class="btn btn-secondary" id="btn-refresh">Atualizar</button>`
      );

      // Os botões ficam na topbar (fora do container gerenciado por lit-html).
      // Usamos event delegation no document pra evitar re-bind a cada re-render.
      const handleTopbar = async (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (!t) return;
        if (t.id === 'btn-guide') {
          openGuideModal();
        }
        if (t.id === 'btn-refresh') {
          if (typeof window !== 'undefined' && typeof window.reload === 'function') {
            await window.reload();
            ctx.toast('Memória recarregada.');
          }
        }
      };

      document.addEventListener('click', handleTopbar);
      // Guarda referência pra cleanup no onUnmount.
      this._topbarHandler = handleTopbar;
    },

    onUnmount() {
      if (typeof this._topbarHandler === 'function') {
        document.removeEventListener('click', this._topbarHandler);
        this._topbarHandler = null;
      }
    },
  });
}
