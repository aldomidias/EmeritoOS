// Onda 2.1 — Painel "Biblioteca" (v2, primeiro a portar pra lit-html)
// Fonte: mazyui-ui.js:1547 (renderBibliotecaInner) + :1594 (closeLibMenu)
// + :1600 (openLibMenu) + :1634 (deleteLibItem) + :1649 (renderBiblioteca).
// Depende de ui/lightbox.js pra abrir os itens.

import { Sabec } from '../core/panels-registry.js';
import { html, render } from '../vendor/lit-html.js';
import { state, update } from '../core/state.js';
import { apiCall, fileUrl } from '../core/api.js';
import { toast } from '../core/dom.js';
import { openLightbox, openSlideFullscreen } from '../ui/lightbox.js';

// ---------------------------------------------------------------------------
// Constantes (portadas de mazyui-ui.js:413-435)
// ---------------------------------------------------------------------------

const FORMAT_ASPECT = {
  instagram:   '4/5',
  quadrado:    '1/1',
  stories:     '9/16',
  horizontal:  '16/9',
  vertical:    '3/4',
  pinterest:   '2/3',
  'link-card': '1.91/1',
  classico:    '4/3',
};

const FORMAT_DIMS = {
  instagram:   { w: 1080, h: 1350 },
  quadrado:    { w: 1080, h: 1080 },
  stories:     { w: 1080, h: 1920 },
  horizontal:  { w: 1920, h: 1080 },
  vertical:    { w: 1080, h: 1440 },
  pinterest:   { w: 1000, h: 1500 },
  'link-card': { w: 1200, h: 628  },
  classico:    { w: 1200, h: 900  },
};

// ---------------------------------------------------------------------------
// Helpers (portados de mazyui-ui.js:437-465)
// ---------------------------------------------------------------------------

function isHtmlPath(p) {
  return typeof p === 'string' && /\.html?$/i.test(p);
}

function getPrimaryFormat(item) {
  if (!item.formats) return null;
  if (item.formats.instagram) return 'instagram';
  return Object.keys(item.formats)[0] || null;
}

function itemAspect(item) {
  return FORMAT_ASPECT[getPrimaryFormat(item)] || '4/5';
}

// ---------------------------------------------------------------------------
// Menu flutuante (portado de mazyui-ui.js:1594-1632)
// ---------------------------------------------------------------------------

function closeLibMenu() {
  const m = document.getElementById('lib-menu');
  if (m) m.remove();
  document.removeEventListener('click', closeLibMenu);
}

function openLibMenu(idx, anchor) {
  closeLibMenu();
  const item = state.library[idx];
  if (!item) return;

  const menu = document.createElement('div');
  menu.id = 'lib-menu';
  menu.className = 'lib-menu';
  menu.innerHTML = `
    <button type="button" data-act="fullscreen">Tela cheia</button>
    <button type="button" data-act="delete" class="danger">Apagar</button>
  `;

  const r = anchor.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = (r.bottom + 6) + 'px';
  menu.style.right = (window.innerWidth - r.right) + 'px';
  document.body.appendChild(menu);

  menu.querySelector('[data-act="fullscreen"]').onclick = (e) => {
    e.stopPropagation();
    closeLibMenu();
    // Seta state pra que openSlideFullscreen saiba qual item abrir
    update({ lightboxIdx: idx, lightboxSlide: 0, lightboxFormat: null });
    openSlideFullscreen();
  };

  menu.querySelector('[data-act="delete"]').onclick = async (e) => {
    e.stopPropagation();
    closeLibMenu();
    await deleteLibItem(item.name);
  };

  // Fecha em qualquer clique fora (timeout p/ não capturar o clique que abriu)
  setTimeout(() => document.addEventListener('click', closeLibMenu), 0);
}

// ---------------------------------------------------------------------------
// Delete (portado de mazyui-ui.js:1634-1648)
// ---------------------------------------------------------------------------

async function deleteLibItem(name) {
  try {
    const data = await apiCall('POST', '/api/delete-item', { name });
    toast('Apagado: ' + name);
    // Remove o item do state local imediatamente — reloadQuiet seria ideal mas
    // não está importado aqui (fica em core/boot.js, Onda 1.D). Filtramos
    // localmente; o próximo reload trará o estado correto do servidor.
    update({ library: state.library.filter(it => it.name !== name) });
  } catch (e) {
    toast('Erro ao apagar: ' + (e.message || e));
  }
}

// ---------------------------------------------------------------------------
// View lit-html (portado de mazyui-ui.js:1547-1591)
// ---------------------------------------------------------------------------

function scaleSlideFrame(f) {
  if (!f) return;
  const canvasW = parseInt(f.dataset.canvasW || '1080', 10);
  const parentW = (f.parentElement && f.parentElement.clientWidth) || 0;
  if (parentW <= 0 || canvasW <= 0) return;
  const scale = parentW / canvasW;
  if ('zoom' in document.body.style) {
    f.style.zoom = scale;
  } else {
    f.style.transform = `scale(${scale})`;
    f.style.transformOrigin = '0 0';
  }
}

function coverContent(item) {
  const cover = item.slides[0] || null;
  const fmt = getPrimaryFormat(item);
  const isHtml = isHtmlPath(cover);

  if (!cover) return html`<span>sem imagem</span>`;
  if (isHtml) {
    const d = FORMAT_DIMS[fmt] || FORMAT_DIMS.instagram;
    return html`<iframe
      class="slide-frame"
      data-canvas-w="${d.w}"
      src="${fileUrl(cover)}"
      style="width:${d.w}px;height:${d.h}px;border:none;display:block;"
      scrolling="no"
      @load=${(e) => scaleSlideFrame(e.target)}
    ></iframe>`;
  }
  return html``;  // imagem de fundo via CSS inline no .cover
}

function libCard(item, i) {
  const cover = item.slides[0] || null;
  const fmt = getPrimaryFormat(item);
  const isHtml = isHtmlPath(cover);
  const aspect = itemAspect(item);
  const bgStyle = cover && !isHtml
    ? `aspect-ratio:${aspect};background-image:url('${fileUrl(cover)}')`
    : `aspect-ratio:${aspect}`;

  const fmtCount = item.formats ? Object.keys(item.formats).length : 0;
  const subtitle = `${item.slides.length} slide${item.slides.length === 1 ? '' : 's'}${fmtCount > 1 ? ` · ${fmtCount} formatos` : ''}`;
  const displayName = (item.name || '').replace(/^(carrossel|post)-/, '').replace(/-/g, ' ');

  return html`
    <div
      class="lib-card"
      data-lib="${i}"
      @click=${(e) => {
        if (e.target.closest('.lib-menu-trigger') || e.target.closest('.lib-menu')) return;
        openLightbox(i);
      }}
    >
      <button
        class="lib-menu-trigger"
        type="button"
        data-lib="${i}"
        aria-label="Mais opções"
        @click=${(e) => { e.stopPropagation(); openLibMenu(i, e.currentTarget); }}
      >···</button>
      <div
        class="cover ${item.slides.length ? '' : 'empty'} ${isHtml ? 'cover-html' : ''}"
        style="${bgStyle}"
      >
        ${coverContent(item)}
      </div>
      <div class="body">
        <div class="title">${displayName}</div>
        <div class="sub">${subtitle}</div>
      </div>
    </div>
  `;
}

function bibliotecaView(ctx) {
  const lib = ctx.state.library;

  if (lib.length === 0) {
    return html`
      <div class="section-head">
        <h2>Biblioteca</h2>
        <p>Tudo que o sistema gerou em <code>marketing/conteudo/</code>.</p>
      </div>
      <div class="card">
        <p style="color:var(--ink-muted); margin:0;">
          Nada produzido ainda. Use a skill <strong>Criar carrossel</strong>
          ou <strong>Publicar tema</strong> pra começar.
        </p>
      </div>
    `;
  }

  return html`
    <div class="section-head">
      <h2>Biblioteca</h2>
      <p>Tudo que o sistema gerou em <code>marketing/conteudo/</code>.</p>
    </div>
    <div class="lib-grid">
      ${lib.map((item, i) => libCard(item, i))}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

export function register() {
  Sabec.v2.registerPanel({
    id:      'biblioteca',
    label:   'Biblioteca',
    glyph:   'B',
    crumb:   'Biblioteca',
    sidebar: true,
    v2:      true,
    view:    (ctx) => bibliotecaView(ctx),
    onMount: (container, ctx) => {
      ctx.setTopbar('Biblioteca', 'Conteúdo produzido');
    },
  });
}
