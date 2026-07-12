// Onda 2.A — Painéis de memória (Negócio, Tom de voz, Estratégia)
// Os três compartilham a mesma view function; registramos 3 painéis distintos
// que apontam pro mesmo template, mudando só o arquivo-fonte e stateKey.
// Fonte: mazyui-ui.js:1176 (renderMemoryPage).

import { registerInternal } from '../core/panels-registry.js';
import { state, update } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { html } from '../vendor/lit-html.js';
import { autoResize, escapeHtml, toast } from '../core/dom.js';

const PAGES = [
  {
    id:       'negocio',
    label:    'Negócio',
    glyph:    'N',
    crumb:    'Negócio',
    file:     '_memoria/empresa.md',
    stateKey: 'empresa',
    subtitle: 'Quem é a empresa. O sistema lê isso antes de cada resposta.',
  },
  {
    id:       'tom',
    label:    'Tom',
    glyph:    'T',
    crumb:    'Tom de voz',
    file:     '_memoria/preferencias.md',
    stateKey: 'preferencias',
    subtitle: 'Como o sistema escreve. Tom, estilo, o que evitar.',
  },
  {
    id:        'estrategia',
    label:     'Estratégia',
    glyph:     'E',
    crumb:     'Estratégia',
    file:      '_memoria/estrategia.md',
    stateKey:  'estrategia',
    subtitle:  'Prioridades atuais. O que importa agora.',
  },
];

// ---------------------------------------------------------------------------
// Shared view factory — retorna view(ctx) específica ao `page`
// ---------------------------------------------------------------------------

function memoryView(page) {
  // Estado de edição local ao painel (não precisa subir pro store global)
  let editing = false;
  let draft = '';
  let saving = false;

  return function view(ctx) {
    const content = state.memory?.[page.stateKey] ?? '';

    // Handlers — definidos fora do template pra evitar recriação por render
    function startEdit() {
      draft = content;
      editing = true;
      // Força re-render manual via update (dispara subscribers)
      update({});
    }

    function cancelEdit() {
      editing = false;
      draft = '';
      update({});
    }

    async function saveEdit() {
      if (saving) return;
      saving = true;
      update({});
      try {
        await apiCall('POST', '/api/save', { path: page.file, content: draft });
        update({ memory: { ...state.memory, [page.stateKey]: draft } });
        editing = false;
        draft = '';
        toast('Salvo ✓');
      } catch (e) {
        toast('Erro ao salvar: ' + escapeHtml(String(e.message || e)));
      } finally {
        saving = false;
        update({});
      }
    }

    function onInput(e) {
      draft = e.target.value;
      autoResize(e.target);
    }

    if (editing) {
      return html`
        <div class="section-head">
          <h2>${page.label}</h2>
          <p>${page.subtitle}</p>
        </div>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
            <div class="kicker">${page.file}</div>
            <div>
              <button class="btn btn-ghost" @click=${cancelEdit} ?disabled=${saving}>Cancelar</button>
              <button class="btn btn-primary" @click=${saveEdit} ?disabled=${saving}>
                ${saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
          <textarea
            class="md-edit"
            .value=${draft}
            @input=${onInput}
            style="min-height:240px;width:100%;box-sizing:border-box;"
          ></textarea>
        </div>
      `;
    }

    // Modo leitura
    return html`
      <div class="section-head">
        <h2>${page.label}</h2>
        <p>${page.subtitle}</p>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <div class="kicker">${page.file}</div>
          <button class="btn btn-secondary" @click=${startEdit}>Editar</button>
        </div>
        <div class="md-view" .innerHTML=${
          content
            ? (typeof marked !== 'undefined' ? marked.parse(content) : `<pre>${escapeHtml(content)}</pre>`)
            : '<p style="color:var(--ink-muted)">Arquivo vazio. Clique em <strong>Editar</strong> pra preencher.</p>'
        }></div>
      </div>
    `;
  };
}

// ---------------------------------------------------------------------------
// register() — 3 painéis, mesma view factory
// ---------------------------------------------------------------------------

export function register() {
  for (const page of PAGES) {
    registerInternal({
      id:      page.id,
      label:   page.label,
      glyph:   page.glyph,
      crumb:   page.crumb,
      sidebar: true,
      v2:      true,

      // onMount: seta topbar e deixa o re-render reativo cuidar do conteúdo
      onMount(container, ctx) {
        ctx.setTopbar(page.crumb, page.label);
      },

      view: memoryView(page),
    });
  }
}
