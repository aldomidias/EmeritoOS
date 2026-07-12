// Onda 2.A — Painel "Skills" (catálogo de comandos + modal de formulário)
// Fonte: mazyui-ui.js:1515 (renderSkills) + :15-49 (SKILLS) + :50 (SKILL_CAT_ORDER)
//        + :2078 (SKILL_FORMS) + :2235 (buildPrompt) + :2345 (wireAspectGrid)
//        + :2313 (openSkillModal) + :2329 (renderSkillForm).

import { registerInternal } from '../core/panels-registry.js';
import { state } from '../core/state.js';
import { html } from '../vendor/lit-html.js';
import { escapeHtml } from '../core/dom.js';
import { openSkillModal as _openModalBackdrop, closeModal } from '../ui/modal.js';
import { dispatchRun } from './chat-stream.js';

// ---------------------------------------------------------------------------
// Catálogo de skills — copy de mazyui-ui.js:15-49
// ---------------------------------------------------------------------------

const SKILLS = [
  { id: 'instalar',    cat: 'NÚCLEO',     title: 'Instalar {{BRAND_NAME}}',       cmd: '/instalar',
    desc: 'Entrevista guiada que preenche empresa, preferências, estratégia e identidade visual.', form: 'none' },
  { id: 'abrir',       cat: 'NÚCLEO',     title: 'Abrir sessão',          cmd: '/abrir',
    desc: 'Carrega a memória do negócio e devolve um resumo do que importa hoje.', form: 'none' },
  { id: 'salvar',      cat: 'NÚCLEO',     title: 'Salvar no GitHub',      cmd: '/salvar',
    desc: 'Commit + push de tudo que mudou. Backup do trabalho.', form: 'none' },
  { id: 'atualizar',   cat: 'NÚCLEO',     title: 'Atualizar memória',     cmd: '/atualizar',
    desc: 'Varre o projeto e reconcilia a memória com o que mudou na prática.', form: 'none' },
  { id: 'novo-projeto', cat: 'NÚCLEO',    title: 'Novo projeto',          cmd: '/novo-projeto',
    desc: 'Cria pasta de projeto isolada com contexto próprio.', form: 'novo-projeto' },
  { id: 'mapear-rotinas', cat: 'NÚCLEO',  title: 'Mapear rotinas',        cmd: '/mapear-rotinas',
    desc: 'Descobre o que você repete e transforma em skill nova.', form: 'none' },

  { id: 'carrossel',     cat: 'CONTEÚDO', title: 'Criar carrossel',       cmd: '/carrossel',
    desc: 'Carrossel 1080×1350 com a identidade da marca, legenda inclusa.', form: 'carrossel' },
  { id: 'publicar-tema', cat: 'CONTEÚDO', title: 'Publicar tema',         cmd: '/publicar-tema',
    desc: 'Tema → artigo de blog + carrossel + 3 legendas, tudo amarrado.', form: 'tema' },
  { id: 'aprovar-post',  cat: 'CONTEÚDO', title: 'Aprovar post',          cmd: '/aprovar-post',
    desc: 'Publica o post da fila no blog, Instagram e Facebook num comando.', form: 'aprovar' },
  { id: 'responder-avaliacoes', cat: 'CONTEÚDO', title: 'Responder review', cmd: '/responder-avaliacoes',
    desc: 'Respostas humanas pras avaliações do Google Meu Negócio.', form: 'review' },

  { id: 'seo',           cat: 'SEO & ADS', title: 'SEO completo',         cmd: '/seo',
    desc: 'Pesquisa de demanda, concorrência, GMB, on-page, conteúdo, ads, monitoramento, GEO.', form: 'none' },
  { id: 'anuncio-google', cat: 'SEO & ADS', title: 'Campanha Google Ads', cmd: '/anuncio-google',
    desc: 'Briefing → CSV pronto pra importar no Google Ads Editor.', form: 'ads-google' },
  { id: 'relatorio-ads', cat: 'SEO & ADS', title: 'Relatório de ads',     cmd: '/relatorio-ads',
    desc: 'Lê exports de Google + Meta e devolve relatório executivo com alertas.', form: 'none' },

  { id: 'analisar-dados', cat: 'PRODUÇÃO', title: 'Analisar dados',       cmd: '/analisar-dados',
    desc: 'Lê CSV / Excel / PDF e gera resumo executivo com tendências.', form: 'analisar' },
  { id: 'email-profissional', cat: 'PRODUÇÃO', title: 'Email profissional', cmd: '/email-profissional',
    desc: 'Rascunho de email a partir de contexto livre, com tom calibrado.', form: 'email' },
];

const SKILL_CAT_ORDER = ['NÚCLEO', 'CONTEÚDO', 'SEO & ADS', 'PRODUÇÃO'];

// ---------------------------------------------------------------------------
// SKILL_FORMS — copy de mazyui-ui.js:2078-2233
// ---------------------------------------------------------------------------

const SKILL_FORMS = {
  none: () => '',

  'carrossel': () => `
    <div class="field">
      <label>Tema do carrossel</label>
      <span class="hint">Sobre o quê é o post? Pode ser amplo.</span>
      <input type="text" id="f-tema" placeholder="Ex: porque splash vende mais que cartaz aéreo" autofocus>
    </div>
    <div class="field">
      <label>Tipo</label>
      <div class="radio-row">
        <label><input type="radio" name="f-tipo" value="texto" checked> Carrossel texto puro — dicas, listas, explicações</label>
        <label><input type="radio" name="f-tipo" value="foto"> Carrossel com foto — capa visual + slides internos</label>
        <label><input type="radio" name="f-tipo" value="unico"> Post único — frase de impacto, dado, citação</label>
      </div>
    </div>
    <div class="field">
      <label>Formato(s) <span class="hint" style="display:inline; font-weight:400;">— clica pra selecionar; o nº 1 é a base, os outros derivam dele (mesma copy, mesmas fotos)</span></label>
      <div class="aspect-grid" id="f-aspect-grid">
        <button type="button" class="aspect-card selected" data-format="4x5">
          <div class="aspect-order">1</div>
          <div class="aspect-shape" style="aspect-ratio: 4/5;"></div>
          <div class="aspect-label">4:5</div>
          <div class="aspect-meta">1080×1350</div>
          <div class="aspect-use">Feed IG/FB</div>
        </button>
        <button type="button" class="aspect-card" data-format="1x1">
          <div class="aspect-order"></div>
          <div class="aspect-shape" style="aspect-ratio: 1/1;"></div>
          <div class="aspect-label">1:1</div>
          <div class="aspect-meta">1080×1080</div>
          <div class="aspect-use">Quadrado</div>
        </button>
        <button type="button" class="aspect-card" data-format="9x16">
          <div class="aspect-order"></div>
          <div class="aspect-shape" style="aspect-ratio: 9/16;"></div>
          <div class="aspect-label">9:16</div>
          <div class="aspect-meta">1080×1920</div>
          <div class="aspect-use">Stories / Reels</div>
        </button>
        <button type="button" class="aspect-card" data-format="16x9">
          <div class="aspect-order"></div>
          <div class="aspect-shape" style="aspect-ratio: 16/9;"></div>
          <div class="aspect-label">16:9</div>
          <div class="aspect-meta">1920×1080</div>
          <div class="aspect-use">YouTube / X</div>
        </button>
        <button type="button" class="aspect-card" data-format="2x3">
          <div class="aspect-order"></div>
          <div class="aspect-shape" style="aspect-ratio: 2/3;"></div>
          <div class="aspect-label">2:3</div>
          <div class="aspect-meta">1080×1620</div>
          <div class="aspect-use">Pinterest</div>
        </button>
        <button type="button" class="aspect-card" data-format="3x4">
          <div class="aspect-order"></div>
          <div class="aspect-shape" style="aspect-ratio: 3/4;"></div>
          <div class="aspect-label">3:4</div>
          <div class="aspect-meta">1080×1440</div>
          <div class="aspect-use">Vertical leve</div>
        </button>
        <button type="button" class="aspect-card" data-format="191x100">
          <div class="aspect-order"></div>
          <div class="aspect-shape" style="aspect-ratio: 1.91/1;"></div>
          <div class="aspect-label">1.91:1</div>
          <div class="aspect-meta">1200×628</div>
          <div class="aspect-use">FB/LinkedIn link</div>
        </button>
        <button type="button" class="aspect-card" data-format="4x3">
          <div class="aspect-order"></div>
          <div class="aspect-shape" style="aspect-ratio: 4/3;"></div>
          <div class="aspect-label">4:3</div>
          <div class="aspect-meta">1440×1080</div>
          <div class="aspect-use">Clássico</div>
        </button>
      </div>
    </div>
    <div class="field">
      <label>Quantos slides? <span class="hint" style="display:inline; font-weight:400;">(opcional)</span></label>
      <input type="text" id="f-slides" placeholder="Ex: 7">
    </div>
  `,

  'tema': () => `
    <div class="field">
      <label>Tema</label>
      <span class="hint">Vira artigo de blog + carrossel + 3 legendas, tudo amarrado.</span>
      <input type="text" id="f-tema" placeholder="Ex: como organizar campanha de panfleto pra Black Friday" autofocus>
    </div>`,

  'aprovar': () => {
    const opts = state.library.map(l => `<option value="${escapeHtml(l.name)}">${escapeHtml(l.name)}</option>`).join('');
    return `
      <div class="field">
        <label>Qual post aprovar?</label>
        <span class="hint">Selecione um conteúdo da biblioteca. Vai publicar blog + Instagram + Facebook.</span>
        <select id="f-post">${opts || '<option>Nenhum conteúdo encontrado</option>'}</select>
      </div>`;
  },

  'review': () => `
    <div class="field">
      <label>Texto da avaliação</label>
      <span class="hint">Cole aqui o que o cliente escreveu no Google Meu Negócio.</span>
      <textarea id="f-review" placeholder="Cole a avaliação..." autofocus></textarea>
    </div>
    <div class="field">
      <label>Nome do cliente <span class="hint" style="display:inline;font-weight:400;">(opcional)</span></label>
      <input type="text" id="f-nome" placeholder="Ex: Marcos">
    </div>`,

  'ads-google': () => `
    <div class="field"><label>Produto / serviço</label><input type="text" id="f-produto" placeholder="Ex: Splash promocional pra supermercado"></div>
    <div class="field"><label>Público</label><input type="text" id="f-publico" placeholder="Ex: compradores de rede de varejo"></div>
    <div class="field"><label>Região (cidades / raio)</label><input type="text" id="f-regiao" placeholder="Ex: cidade + 100km"></div>
    <div class="field"><label>Orçamento diário</label><input type="text" id="f-orc" placeholder="Ex: R$ 80/dia"></div>
    <div class="field"><label>Objetivo</label>
      <div class="radio-row">
        <label><input type="radio" name="f-obj" value="whatsapp" checked> WhatsApp</label>
        <label><input type="radio" name="f-obj" value="ligacao"> Ligação</label>
        <label><input type="radio" name="f-obj" value="form"> Formulário</label>
        <label><input type="radio" name="f-obj" value="visita"> Visita</label>
      </div>
    </div>
    <div class="field"><label>URL da landing page</label><input type="text" id="f-url" placeholder="https://"></div>`,

  'analisar': () => `
    <div class="field">
      <label>Caminho do arquivo</label>
      <span class="hint">Onde está? Geralmente em <code>dados/</code>.</span>
      <input type="text" id="f-arquivo" placeholder="Ex: dados/google-ads-2026-05-12.csv" autofocus>
    </div>
    <div class="field">
      <label>O que você quer saber?</label>
      <textarea id="f-pergunta" placeholder="Ex: quais campanhas estão queimando orçamento sem converter"></textarea>
    </div>`,

  'email': () => `
    <div class="field"><label>Pra quem?</label><input type="text" id="f-para" placeholder="Ex: comprador da rede Cantareira"></div>
    <div class="field"><label>Sobre o quê?</label>
      <textarea id="f-assunto" placeholder="Ex: envio de orçamento de 200k panfletos pra campanha de aniversário" autofocus></textarea>
    </div>
    <div class="field"><label>Tom</label>
      <div class="radio-row">
        <label><input type="radio" name="f-tom" value="formal" checked> Formal — primeiro contato, proposta</label>
        <label><input type="radio" name="f-tom" value="cordial"> Cordial — cliente recorrente</label>
        <label><input type="radio" name="f-tom" value="direto"> Direto — alinhamento operacional</label>
      </div>
    </div>`,

  'novo-projeto': () => `
    <div class="field"><label>Nome do projeto ou cliente</label><input type="text" id="f-nome" autofocus></div>
    <div class="field"><label>Tipo</label>
      <div class="radio-row">
        <label><input type="radio" name="f-tipo" value="cliente" checked> Cliente novo</label>
        <label><input type="radio" name="f-tipo" value="interno"> Projeto interno</label>
        <label><input type="radio" name="f-tipo" value="pessoal"> Iniciativa pessoal</label>
      </div>
    </div>
    <div class="field"><label>Objetivo</label><input type="text" id="f-obj" placeholder="Uma frase"></div>
    <div class="field"><label>Entregas previstas</label><input type="text" id="f-entregas" placeholder="Ex: ads, site, conteúdo, automação"></div>`,
};

// ---------------------------------------------------------------------------
// buildPrompt — copy de mazyui-ui.js:2235-2311
// ---------------------------------------------------------------------------

function buildPrompt(skill) {
  let p = skill.cmd;
  const v = id => (document.getElementById(id)?.value || '').trim();
  const rv = name => document.querySelector(`input[name="${name}"]:checked`)?.value || '';
  switch (skill.form) {
    case 'carrossel': {
      const tema = v('f-tema'); if (tema) p += `\n\nTema: ${tema}`;
      const tipo = rv('f-tipo');
      const tipoLabel = { texto: 'carrossel texto puro', foto: 'carrossel com foto', unico: 'post único' }[tipo];
      if (tipoLabel) p += `\nTipo: ${tipoLabel}`;

      const FORMATO_LABEL = {
        '4x5':     'Feed retrato 4:5 (1080×1350, pasta instagram/)',
        '1x1':     'Feed quadrado 1:1 (1080×1080, pasta instagram/)',
        '9x16':    'Stories/Reels 9:16 (1080×1920, pasta stories/)',
        '16x9':    'Horizontal 16:9 (1920×1080, pasta horizontal/)',
        '2x3':     'Pinterest 2:3 (1080×1620, pasta pinterest/)',
        '3x4':     'Vertical 3:4 (1080×1440, pasta vertical/)',
        '191x100': 'Link card 1.91:1 (1200×628, pasta link-card/)',
        '4x3':     'Clássico 4:3 (1440×1080, pasta classico/)',
      };
      const selectedCards = document.querySelectorAll('#f-aspect-grid .aspect-card.selected');
      const formats = Array.from(selectedCards).map(c => c.dataset.format);
      if (formats.length) {
        p += `\nFormato principal: ${FORMATO_LABEL[formats[0]] || formats[0]}`;
        if (formats.length > 1) {
          const extras = formats.slice(1).map(f => FORMATO_LABEL[f] || f);
          p += `\nGerar também em: ${extras.join('; ')}`;
        }
      }

      const slides = v('f-slides'); if (slides) p += `\nSlides: ${slides}`;
      break;
    }
    case 'tema': { const tema = v('f-tema'); if (tema) p += `\n\nTema: ${tema}`; break; }
    case 'aprovar': { const post = v('f-post'); if (post) p += ` ${post}`; break; }
    case 'review': {
      const txt = v('f-review'); const nome = v('f-nome');
      if (txt) p += `\n\nAvaliação:\n"${txt}"`;
      if (nome) p += `\n\nCliente: ${nome}`;
      break;
    }
    case 'ads-google': {
      const lines = [];
      [['Produto','f-produto'],['Público','f-publico'],['Região','f-regiao'],['Orçamento','f-orc'],['URL','f-url']]
        .forEach(([k,id]) => { const val = v(id); if (val) lines.push(`${k}: ${val}`); });
      const obj = rv('f-obj'); if (obj) lines.push(`Objetivo: ${obj}`);
      if (lines.length) p += `\n\n${lines.join('\n')}`;
      break;
    }
    case 'analisar': {
      const arq = v('f-arquivo'); if (arq) p += `\n${arq}`;
      const q = v('f-pergunta'); if (q) p += `\n\nFoco: ${q}`;
      break;
    }
    case 'email': {
      const parts = [];
      const para = v('f-para'); const assunto = v('f-assunto'); const tom = rv('f-tom');
      if (para) parts.push(`Pra: ${para}`);
      if (assunto) parts.push(`Assunto: ${assunto}`);
      if (tom) parts.push(`Tom: ${tom}`);
      if (parts.length) p += `\n\n${parts.join('\n')}`;
      break;
    }
    case 'novo-projeto': {
      const parts = [];
      const nome = v('f-nome'); const tipo = rv('f-tipo'); const obj = v('f-obj'); const ent = v('f-entregas');
      if (nome) parts.push(`Nome: ${nome}`);
      if (tipo) parts.push(`Tipo: ${tipo}`);
      if (obj) parts.push(`Objetivo: ${obj}`);
      if (ent) parts.push(`Entregas: ${ent}`);
      if (parts.length) p += `\n\n${parts.join('\n')}`;
      break;
    }
  }
  return p;
}

// ---------------------------------------------------------------------------
// wireAspectGrid — copy de mazyui-ui.js:2345-2365
// ---------------------------------------------------------------------------

function wireAspectGrid() {
  const grid = document.getElementById('f-aspect-grid');
  if (!grid) return;
  const refreshOrder = () => {
    const selected = grid.querySelectorAll('.aspect-card.selected');
    selected.forEach((card, i) => {
      const badge = card.querySelector('.aspect-order');
      if (badge) badge.textContent = i + 1;
    });
  };
  grid.querySelectorAll('.aspect-card').forEach(card => {
    card.addEventListener('click', () => {
      const selectedCount = grid.querySelectorAll('.aspect-card.selected').length;
      const isOnlyOne = card.classList.contains('selected') && selectedCount === 1;
      if (isOnlyOne) return; // Não deixa desmarcar todos
      card.classList.toggle('selected');
      refreshOrder();
    });
  });
  refreshOrder();
}

// ---------------------------------------------------------------------------
// dispatchSkillRun — envia o prompt da skill direto pro chat-stream.
// ---------------------------------------------------------------------------

function dispatchSkillRun(prompt, skill) {
  dispatchRun(prompt, { skill: skill.id, label: skill.cmd });
}

// ---------------------------------------------------------------------------
// openSkillModal — portado de mazyui-ui.js:2313 + :2329
// ---------------------------------------------------------------------------

export function openSkillModal(id) {
  const skill = SKILLS.find(s => s.id === id);
  if (!skill) return;

  // Skill sem form → dispara direto pro chat, sem modal
  if (!skill.form || skill.form === 'none') {
    dispatchSkillRun(skill.cmd, skill);
    return;
  }

  // Preenche os elementos do modal-backdrop (shell já os injeta no HTML)
  const kickerEl = document.getElementById('modal-kicker');
  const titleEl  = document.getElementById('modal-title');
  const bodyEl   = document.getElementById('modal-body');
  const footEl   = document.getElementById('modal-foot');

  if (kickerEl) kickerEl.textContent = skill.cat;
  if (titleEl)  titleEl.textContent  = skill.title;

  const formHTML = SKILL_FORMS[skill.form]?.() || '';
  if (bodyEl) bodyEl.innerHTML = formHTML;

  if (footEl) {
    footEl.innerHTML = `
      <button class="btn btn-ghost" data-act="close">Cancelar</button>
      <button class="btn btn-primary" data-act="run">Executar no chat</button>
    `;
    footEl.querySelector('[data-act="close"]').onclick = closeModal;
    footEl.querySelector('[data-act="run"]').onclick = () => {
      const prompt = buildPrompt(skill);
      closeModal();
      dispatchSkillRun(prompt, skill);
    };
  }

  // wireAspectGrid depois de injetar o HTML no DOM
  wireAspectGrid();

  // Abre o backdrop via ui/modal.js
  _openModalBackdrop(skill.id);
}

// ---------------------------------------------------------------------------
// view — lit-html template do catálogo de skills
// Portado de mazyui-ui.js:1515 (renderSkills).
// ---------------------------------------------------------------------------

function skillsView() {
  const sections = SKILL_CAT_ORDER
    .map(cat => {
      const items = SKILLS.filter(s => s.cat === cat);
      if (!items.length) return null;
      return html`
        <div class="skill-section-title">${cat}</div>
        <div class="skills-grid">
          ${items.map(s => html`
            <div class="skill-card" @click=${() => openSkillModal(s.id)}>
              <div class="cat">${escapeHtml(s.cat)}</div>
              <h4>${escapeHtml(s.title)}</h4>
              <p>${escapeHtml(s.desc)}</p>
              <div class="cmd">${escapeHtml(s.cmd)}</div>
            </div>
          `)}
        </div>
      `;
    })
    .filter(Boolean);

  return html`
    <div class="section-head">
      <h2>Skills</h2>
      <p>Cada skill é uma rotina pronta. Clique pra executar — o sistema cuida do resto.</p>
    </div>
    ${sections}
  `;
}

// ---------------------------------------------------------------------------
// register()
// ---------------------------------------------------------------------------

export function register() {
  registerInternal({
    id:      'skills',
    label:   'Skills',
    glyph:   'S',
    crumb:   'Skills',
    sidebar: true,
    v2:      true,

    onMount(container, ctx) {
      ctx.setTopbar('Skills', 'Comandos do sistema');
    },

    view: skillsView,
  });
}
