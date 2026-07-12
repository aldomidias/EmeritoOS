// Onda 2.2 — Painel "Identidade" (cores, fontes, logo)
// Portado de mazyui-ui.js:1239 (renderIdentidade) + :1329 (openSwatchColorEdit)
// + :1358 (applyColorChange) + :1377 (updateColorInMd) + :1384 (pushIdentityHistory)
// + :1391 (undoLastIdentityChange) + :1409 (onLogoFilePicked) + :1443 (removeLogo)
// + :1465 (syncDesignGuideLogo) + :1504 (formatLogoDate).
//
// Estratégia de undo:
//   state.identityHistory é a pilha (cap IDENTITY_HISTORY_MAX = 20). Ela é
//   in-memory: reset no reload da página, como no legacy. Isso é intencional —
//   o design-guide.md no disco é sempre a fonte da verdade; o histórico de
//   sessão é só QoL (desfazer edits acidentais na mesma aba). Persistir o
//   histórico em localStorage traria complexidade sem benefício real: o usuário
//   pode sempre reabrir o guia e editar manualmente.

import { registerInternal } from '../core/panels-registry.js';
import { state, update, IDENTITY_HISTORY_MAX } from '../core/state.js';
import { apiSave, apiCall, fileUrl } from '../core/api.js';
import { applyIdentityToCSS } from '../core/brand.js';
import { extractPalette, extractFonts } from '../core/markdown.js';
import { escapeHtml, toast } from '../core/dom.js';

// ---------------------------------------------------------------------------
// Helpers internos (sem acesso ao DOM durante a importação)
// ---------------------------------------------------------------------------

function formatLogoDate(ms) {
  try {
    const d = new Date(ms);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) +
           ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function updateColorInMd(md, name, newHex) {
  if (!md) return md;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(- \\*\\*' + esc + ':\\*\\*\\s*`)#[0-9a-fA-F]{3,8}(`)');
  return md.replace(re, `$1${newHex.toUpperCase()}$2`);
}

function pushIdentityHistory(label) {
  state.identityHistory.push({ md: state.identidade, label, ts: Date.now() });
  if (state.identityHistory.length > IDENTITY_HISTORY_MAX) {
    state.identityHistory.shift();
  }
}

async function applyColorChange(name, oldHex, newHex) {
  const newMd = updateColorInMd(state.identidade, name, newHex);
  if (newMd === state.identidade) {
    toast('Não localizei essa cor no guia. Verifica se a linha não foi reescrita à mão.');
    return;
  }
  pushIdentityHistory(`${name}: ${oldHex} → ${newHex}`);
  try {
    await apiSave('identidade/design-guide.md', newMd);
    state.identidade = newMd;
    applyIdentityToCSS(newMd);
    update({ identidade: newMd });   // notifica subscribers → re-render automático
    toast(`${name}: ${oldHex} → ${newHex} · Ctrl+Z desfaz`);
  } catch {
    state.identityHistory.pop(); // não chegou a aplicar
    toast('Falhou ao salvar a cor no disco.');
  }
}

async function undoLastIdentityChange() {
  if (!state.identityHistory.length) {
    toast('Nada pra desfazer.');
    return;
  }
  const prev = state.identityHistory.pop();
  try {
    await apiSave('identidade/design-guide.md', prev.md);
    state.identidade = prev.md;
    applyIdentityToCSS(prev.md);
    update({ identidade: prev.md });
    toast(`Desfeito: ${prev.label}`);
  } catch {
    state.identityHistory.push(prev); // devolve pro stack
    toast('Falhou ao desfazer.');
  }
}

function openSwatchColorEdit(swatchEl, palette) {
  const name = swatchEl.dataset.name;
  const oldHex = (swatchEl.dataset.hex || '').toUpperCase();
  if (!name || !/^#[0-9A-F]{6}$/.test(oldHex)) {
    toast('Não consigo editar essa cor — formato inesperado.');
    return;
  }
  const input = document.createElement('input');
  input.type = 'color';
  input.value = oldHex;
  input.style.cssText = 'position:fixed; opacity:0; pointer-events:none; left:0; top:0;';
  document.body.appendChild(input);
  let settled = false;
  const cleanup = () => { if (input.parentNode) input.parentNode.removeChild(input); };
  const finish = (newHex) => {
    if (settled) return;
    settled = true;
    cleanup();
    if (!newHex) return;
    const upper = newHex.toUpperCase();
    if (upper === oldHex) return;
    applyColorChange(name, oldHex, upper);
  };
  input.addEventListener('change', () => finish(input.value));
  input.addEventListener('cancel', () => finish(null));
  setTimeout(cleanup, 60000);
  input.click();
}

async function syncDesignGuideLogo(logoExists, originalFilename) {
  const md = state.identidade || '';
  if (!md) return false;

  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const filenameHint = originalFilename ? ` (original: \`${originalFilename}\`)` : '';

  const newBlock = logoExists
    ? `## Logo

- **Arquivo:** \`identidade/logo.svg\` — versão vetorial principal, enviada via painel em ${date}${filenameHint}
- **Versão pra fundo escuro:** *(a definir)*
- **Onde usar:** header de propostas, slide final de carrossel (CTA), assinatura de e-mail, marca d'água em fichas de produto
- **Tamanho sugerido:** largura entre 120-200px nos HTMLs`
    : `## Logo

- **Arquivo:** *(não enviada — manda o SVG via painel em Identidade → Logo. Se a marca ainda não tem vetor oficial, esse é item da proposta: redesenhar o lockup na tipografia escolhida.)*
- **Versão pra fundo escuro:** *(a definir)*
- **Onde usar:** header de propostas, slide final de carrossel (CTA), assinatura de e-mail, marca d'água em fichas de produto
- **Tamanho sugerido:** largura entre 120-200px nos HTMLs`;

  const re = /## Logo[\s\S]*?(?=\n---|\n## |$)/;
  let newMd;
  if (re.test(md)) {
    newMd = md.replace(re, newBlock);
  } else {
    newMd = md.trimEnd() + '\n\n---\n\n' + newBlock + '\n';
  }

  if (newMd === md) return false;
  try {
    await apiSave('identidade/design-guide.md', newMd);
    state.identidade = newMd;
    update({ identidade: newMd });
    return true;
  } catch {
    return false;
  }
}

async function onLogoFilePicked(ev, reloadFn) {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
    toast('Só SVG. Outros formatos não rolam.');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    toast('SVG muito grande (max 2 MB).');
    return;
  }
  let content;
  try {
    content = await file.text();
  } catch {
    toast('Não consegui ler o arquivo.');
    return;
  }
  const head = content.slice(0, 500).toLowerCase();
  if (!head.includes('<svg') && !head.includes('<?xml')) {
    toast('Esse arquivo não parece SVG válido.');
    return;
  }
  try {
    await apiSave('identidade/logo.svg', content);
    const guideUpdated = await syncDesignGuideLogo(true, file.name);
    toast(guideUpdated ? 'Logo salva e design-guide atualizado.' : 'Logo salva em identidade/logo.svg.');
    await reloadFn();
  } catch (e) {
    toast('Falhou ao salvar: ' + (e.message || e));
  }
}

async function removeLogo(reloadFn) {
  if (!confirm('Remover a logo? O arquivo identidade/logo.svg vai ser apagado.')) return;
  try {
    await apiCall('POST', '/api/delete-file', { path: 'identidade/logo.svg' });
    await syncDesignGuideLogo(false, '');
    toast('Logo removida.');
    await reloadFn();
  } catch (e) {
    toast('Não consegui remover: ' + (e.message || e));
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderPanelHTML(container) {
  const md = state.identidade;
  const palette = extractPalette(md);
  const fonts = extractFonts(md);
  const businessName = escapeHtml(state.business.name || '—');

  const swatchesHTML = palette.length
    ? palette.map(p => `
        <div class="swatch" data-hex="${escapeHtml(p.hex)}" data-name="${escapeHtml(p.name)}"
             title="Clique pra copiar ${escapeHtml(p.hex)} · Shift+Clique pra editar">
          <div class="chip" style="background:${escapeHtml(p.hex)}"></div>
          <div class="meta">
            <div class="name">${escapeHtml(p.name)}</div>
            <div class="hex">${escapeHtml(p.hex)}</div>
          </div>
        </div>`).join('')
    : '<p style="color:var(--ink-muted)">Nenhuma cor definida ainda. Edite o guia.</p>';

  const logoHTML = state.logo
    ? `<div style="display:flex; align-items:center; gap:24px; flex-wrap:wrap; margin-top:8px;">
        <div style="background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:24px; display:flex; align-items:center; justify-content:center; min-width:180px; min-height:120px;">
          <img id="logo-preview" src="${fileUrl(state.logo.path)}?t=${state.logo.mtime}" alt="logo"
               style="max-width:220px; max-height:120px; display:block;">
        </div>
        <div style="flex:1; min-width:200px;">
          <div style="font-family:var(--mono); font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:var(--ink-muted); margin-bottom:6px;">${escapeHtml(state.logo.path)}</div>
          <div style="font-size:13px; color:var(--ink-soft);">${(state.logo.size / 1024).toFixed(1)} KB · atualizado ${formatLogoDate(state.logo.mtime)}</div>
          <div style="margin-top:14px; display:flex; gap:8px;">
            <button class="btn btn-secondary" data-act="upload-logo">Substituir logo</button>
            <button class="btn btn-ghost" data-act="remove-logo">Remover</button>
          </div>
        </div>
      </div>`
    : `<p style="color:var(--ink-muted); margin:8px 0 14px;">Nenhuma logo enviada ainda. Manda um SVG aqui — fica em <code>identidade/logo.svg</code> e pode ser usado nas peças.</p>
       <button class="btn btn-primary" data-act="upload-logo">Enviar logo SVG</button>`;

  // Amostras tipográficas: usa as fontes do guia quando disponíveis, senão fallback por posição.
  const displayFont = fonts[0] ? escapeHtml(fonts[0].family) : null;
  const bodyFont    = fonts[1] ? escapeHtml(fonts[1].family) : null;
  const monoFont    = fonts[2] ? escapeHtml(fonts[2].family) : null;

  const typeSamples = fonts.length
    ? fonts.map(f => `
        <div class="type-sample">
          <div class="label">${escapeHtml(f.label)} — <code>${escapeHtml(f.family)}</code></div>
          <div style="font-family:'${escapeHtml(f.family)}', var(--sans); font-size:1.15em; margin-top:4px;">${businessName}</div>
        </div>`).join('')
    : `
        <div class="type-sample"><div class="label">Título — var(--syne)</div><div class="type-syne-800">${businessName}</div></div>
        <div class="type-sample"><div class="label">Corpo — var(--sans)</div><div class="type-sans">Identidade visual aplicada a partir do design-guide.md.</div></div>
        <div class="type-sample"><div class="label">Técnico — var(--mono)</div><div class="type-mono">GL-093-VM · SPLASH MÉDIO</div></div>`;

  // Renderização do guia completo (usa marked global se disponível)
  const mdRendered = (typeof marked !== 'undefined' && marked.parse)
    ? marked.parse(md || '', { breaks: true, gfm: true })
    : `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(md || '')}</pre>`;

  container.innerHTML = `
    <div class="section-head">
      <h2>Identidade visual</h2>
      <p>A própria UI desse painel é a aplicação da marca — paleta e tipografia vêm de <code>identidade/design-guide.md</code>.</p>
    </div>

    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap;">
        <div><div class="kicker">Paleta</div><h3 style="margin:0;">Cores aplicadas</h3></div>
        <div style="font-family:var(--mono); font-size:10px; color:var(--ink-muted); letter-spacing:0.18em; text-transform:uppercase;">clique: copiar · shift+click: editar</div>
      </div>
      <div class="swatch-grid" style="margin-top:18px;">${swatchesHTML}</div>
    </div>

    <div class="card">
      <div class="kicker">Logo</div>
      <h3>Marca aplicada</h3>
      ${logoHTML}
      <input type="file" id="logo-file-input" accept="image/svg+xml,.svg" style="display:none;">
    </div>

    <div class="card">
      <div class="kicker">Tipografia</div>
      <h3>Fontes aplicadas</h3>
      ${typeSamples}
    </div>

    <div class="card card-paper">
      <div class="kicker">Guia completo</div>
      <div class="md-view">${md ? mdRendered : '<p>Sem guia ainda.</p>'}</div>
    </div>
  `;
}

function bindEvents(container, reloadFn) {
  // Swatches
  container.querySelectorAll('.swatch').forEach(sw =>
    sw.addEventListener('click', (e) => {
      if (e.shiftKey) {
        openSwatchColorEdit(sw);
      } else {
        navigator.clipboard.writeText(sw.dataset.hex);
        toast(`${sw.dataset.hex} copiado.`);
      }
    }));

  // Logo upload
  const fileInput = container.querySelector('#logo-file-input');
  container.querySelectorAll('[data-act="upload-logo"]').forEach(btn =>
    btn.addEventListener('click', () => fileInput?.click()));
  if (fileInput) fileInput.addEventListener('change', (ev) => onLogoFilePicked(ev, reloadFn));

  // Logo remove
  container.querySelectorAll('[data-act="remove-logo"]').forEach(btn =>
    btn.addEventListener('click', () => removeLogo(reloadFn)));
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

export function register() {
  registerInternal({
    id: 'identidade',
    label: 'Identidade',
    glyph: 'I',
    crumb: 'Identidade',
    sidebar: true,

    onMount(container, ctx) {
      ctx.setTopbar('Identidade', 'Marca visual');

      // Função que faz reload pesado de estado (usado após upload/remoção de logo).
      // Em produção, boot.js expõe reload() globalmente (window.sabecReload ou
      // similar); aqui chamamos /api/state e re-hidratamos state manualmente
      // para não depender de um global que pode não existir ainda.
      const reloadFn = async () => {
        try {
          const r = await fetch('/api/state');
          if (r.ok) {
            const data = await r.json();
            if (data.logo !== undefined) update({ logo: data.logo });
            if (data.identidade !== undefined) {
              state.identidade = data.identidade;
              update({ identidade: data.identidade });
              applyIdentityToCSS(data.identidade);
            }
          }
        } catch { /* silencioso — o painel vai re-renderizar via subscribe mesmo assim */ }
        renderPanelHTML(container);
        bindEvents(container, reloadFn);
      };

      renderPanelHTML(container);
      bindEvents(container, reloadFn);

      // Undo via Ctrl+Z (escopo do painel — listener removido no onUnmount)
      this._undoHandler = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && state.active === 'identidade') {
          e.preventDefault();
          undoLastIdentityChange();
        }
      };
      document.addEventListener('keydown', this._undoHandler);
    },

    onUnmount() {
      if (this._undoHandler) {
        document.removeEventListener('keydown', this._undoHandler);
        this._undoHandler = null;
      }
    },
  });
}
