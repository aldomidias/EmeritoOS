// Onda 2.7 — Editor inline de slide (PNG e HTML) usado pelo lightbox.
// Não aparece na sidebar (sidebar: false). Expõe editSlide/editHtml
// + FORMAT_LABEL/FORMAT_ASPECT/FORMAT_DIMS pro lightbox importar.
// Fonte: mazyui-ui.js:402-435 (FORMAT_*) + :484-664 (editSlide/editHtml).

import { Sabec } from '../core/panels-registry.js';
import { state } from '../core/state.js';
import { streamRun, fileUrl } from '../core/api.js';
import { newId, toast } from '../core/dom.js';
import { paintSlideStatus, paintSlideBusy } from '../ui/lightbox.js';
import { reloadQuiet } from '../core/boot.js';

// ============================================================
// FORMAT dicts — fonte: mazyui-ui.js:402-435
// ============================================================

export const FORMAT_LABEL = {
  instagram:   'Feed retrato 4:5',
  quadrado:    'Quadrado 1:1',
  stories:     'Stories 9:16',
  horizontal:  'Horizontal 16:9',
  vertical:    'Vertical 3:4',
  pinterest:   'Pinterest 2:3',
  'link-card': 'Link card',
  classico:    'Clássico 4:3',
};

export const FORMAT_ASPECT = {
  instagram:   '4/5',
  quadrado:    '1/1',
  stories:     '9/16',
  horizontal:  '16/9',
  vertical:    '3/4',
  pinterest:   '2/3',
  'link-card': '1.91/1',
  classico:    '4/3',
};

// Dimensões do canvas HTML por formato (px). Usado pra calcular zoom dos
// iframes de preview (HTML é a fonte de verdade; PNG é só fallback).
export const FORMAT_DIMS = {
  instagram:   { w: 1080, h: 1350 },
  quadrado:    { w: 1080, h: 1080 },
  stories:     { w: 1080, h: 1920 },
  horizontal:  { w: 1920, h: 1080 },
  vertical:    { w: 1080, h: 1440 },
  pinterest:   { w: 1000, h: 1500 },
  'link-card': { w: 1200, h: 628  },
  classico:    { w: 1200, h: 900  },
};

// ============================================================
// Helpers internos (portados de mazyui-ui.js)
// ============================================================

function slideRunKey(itemName, slideIdx) {
  return itemName + '::' + slideIdx;
}

function getActiveSlides(item) {
  const fmt = state.lightboxFormat;
  if (fmt && item.formats && item.formats[fmt]) return item.formats[fmt].slides;
  return item.slides;
}

function getActiveFolder(item) {
  const fmt = state.lightboxFormat;
  if (fmt && item.formats && item.formats[fmt]) return item.formats[fmt].folder;
  return item.folder;
}

// ============================================================
// editSlide — fonte: mazyui-ui.js:497-609
// ============================================================

export async function editSlide(item, slideIdx, pedido) {
  const slidePath = getActiveSlides(item)[slideIdx];
  if (!slidePath) return;

  const key = slideRunKey(item.name, slideIdx);
  const runId = newId('slide');
  const startedAt = Date.now();
  // Tick re-queryia o DOM por ID — sobrevive fechar+reabrir lightbox.
  const timer = setInterval(() => {
    paintSlideStatus(slideIdx, 'rodando · ' + Math.floor((Date.now() - startedAt) / 1000) + 's');
  }, 500);
  state.slideRuns[key] = { runId, startedAt, timer };

  paintSlideBusy(slideIdx, true);
  paintSlideStatus(slideIdx, 'rodando · 0s');

  const prompt = `Edite UM ÚNICO slide específico de um carrossel do {{BRAND_NAME}}.

Post: ${item.name}
Pasta do post: ${getActiveFolder(item) || ''}
Arquivo a editar: ${slidePath}

Pedido do usuário: "${pedido}"

REGRAS RÍGIDAS — LEIA ANTES DE AGIR:
1. O ÚNICO arquivo PNG que você pode escrever/sobrescrever é: ${slidePath}
2. NÃO toque em NENHUM outro PNG da mesma pasta. Os outros slides do carrossel devem ficar EXATAMENTE como estão (mesmo conteúdo, mesmo mtime). Um sistema externo vai restaurar qualquer outro PNG que você modificar — e isso vai ser flagado como erro.
3. PROIBIDO invocar a skill /carrossel, /publicar-tema ou qualquer outra que regenere o carrossel inteiro — elas reescrevem todos os slides.
4. Se precisar de script (Python/Pillow/etc), o script deve abrir, modificar e salvar SÓ ${slidePath}. Nada de loop pela pasta.
5. Pode LER outros slides pra entender o estilo, mas NÃO ESCREVER.
6. Mantém dimensões originais do PNG e a identidade da marca (vê \`identidade/design-guide.md\` se precisar).
7. Responda com UMA frase curta confirmando o que foi feito nesse slide.`;

  // Snapshot dos slides irmãos ANTES do run — qualquer um alterado é
  // restaurado depois. Belt-and-suspenders contra Claude regenerar o
  // carrossel inteiro mesmo sendo instruído a não fazer.
  try {
    await fetch('/api/snapshot-siblings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath: slidePath, runId }),
    });
  } catch {}

  let exitCode = null;
  let resultData = null;
  let connectionError = false;

  try {
    await streamRun(prompt, runId, evt => {
      if (evt.event === 'event') {
        try {
          const obj = JSON.parse(evt.data);
          if (obj.type === 'result') resultData = obj;
        } catch {}
      } else if (evt.event === 'done') {
        try { exitCode = JSON.parse(evt.data).exitCode; } catch {}
      }
    }, { model: state.slideModel });
  } catch {
    connectionError = true;
  }

  // Restaura irmãos SEMPRE (sucesso, erro ou conexão caiu) — protege
  // contra escrita parcial em qualquer cenário.
  let restored = 0;
  try {
    const r = await fetch('/api/restore-siblings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath: slidePath, runId }),
    });
    const data = await r.json().catch(() => ({}));
    restored = data.restored || 0;
  } catch {}

  clearInterval(timer);
  delete state.slideRuns[key];

  if (connectionError) {
    paintSlideBusy(slideIdx, false);
    paintSlideStatus(slideIdx, 'erro de conexão.', 'err');
    return;
  }

  // Só pinta o slide se o lightbox ainda mostra o MESMO item — usuário
  // pode ter fechado e aberto outro post enquanto o run rodava.
  const visibleSameItem = state.library[state.lightboxIdx]?.name === item.name;
  const ok = exitCode === 0 || resultData?.subtype === 'success';

  if (visibleSameItem) {
    paintSlideBusy(slideIdx, false);
    if (ok) {
      const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
      const protMsg = restored > 0 ? ` · protegi ${restored} irmão${restored === 1 ? '' : 's'}` : '';
      paintSlideStatus(slideIdx, 'pronto · ' + secs + 's' + protMsg, 'ok');
      const inp = document.getElementById('slide-input-' + slideIdx);
      if (inp) inp.value = '';
      const imgEl = document.getElementById('slide-img-' + slideIdx);
      if (imgEl) {
        const base = fileUrl(slidePath);
        imgEl.src = base + (base.includes('?') ? '&' : '?') + 't=' + Date.now();
      }
    } else {
      paintSlideStatus(slideIdx, 'falhou. tenta de novo ou ajusta o pedido.', 'err');
    }
  } else if (ok) {
    const protMsg = restored > 0 ? ` (${restored} irmão${restored === 1 ? '' : 's'} protegido${restored === 1 ? '' : 's'})` : '';
    toast('Slide ' + (slideIdx + 1) + ' de "' + item.name + '" atualizado.' + protMsg);
  }

  if (ok) reloadQuiet();
}

// ============================================================
// editHtml — fonte: mazyui-ui.js:623-664
// ============================================================

export async function editHtml(item, htmlSrc, pedido) {
  const btn = document.getElementById('html-edit-btn');
  const inp = document.getElementById('html-edit-input');
  const status = document.getElementById('html-edit-status');
  if (btn) btn.disabled = true;
  if (status) { status.textContent = 'rodando…'; status.className = 'lightbox-slide-status'; }

  const prompt = `Edite o arquivo HTML de um carrossel do {{BRAND_NAME}}.

Post: ${item.name}
Arquivo HTML a editar: ${htmlSrc}

Pedido do usuário: "${pedido}"

REGRAS:
1. O ÚNICO arquivo que você pode modificar é: ${htmlSrc}
2. Não altere outros arquivos. Não rode render.js nem gere PNGs.
3. Mantenha a estrutura HTML existente — apenas modifique o conteúdo pedido.
4. Responda com UMA frase curta confirmando o que foi feito.`;

  const runId = newId('html');
  let exitCode = null;
  try {
    await streamRun(prompt, runId, evt => {
      if (evt.event === 'done') {
        try { exitCode = JSON.parse(evt.data).exitCode; } catch {}
      }
    }, { model: state.slideModel });
  } catch {}

  const ok = exitCode === 0;
  if (btn) btn.disabled = false;
  if (status) {
    status.textContent = ok ? 'pronto.' : 'falhou. tenta de novo.';
    status.className = 'lightbox-slide-status ' + (ok ? 'ok' : 'err');
  }
  if (ok) {
    if (inp) inp.value = '';
    const frame = document.getElementById('html-frame');
    if (frame) frame.src = fileUrl(htmlSrc) + '&t=' + Date.now();
  }
}

// ============================================================
// submitSlideEdit / submitHtmlEdit
// Form-submit handlers para usar como addEventListener('submit', …).
// Portados de mazyui-ui.js:484-494 / 611-622.
// Nota: NÃO usam onclick= inline — o lightbox attacha via addEventListener.
// ============================================================

/**
 * Handler de submit do form de edição de slide.
 * @param {Event} ev
 * @param {number} slideIdx
 */
export function submitSlideEdit(ev, slideIdx) {
  ev.preventDefault();
  const item = state.library[state.lightboxIdx];
  if (!item) return false;
  const input = document.getElementById('slide-input-' + slideIdx);
  if (!input) return false;
  const pedido = input.value.trim();
  if (!pedido) return false;
  const key = item.name + '::' + slideIdx;
  if (state.slideRuns[key]) return false;
  editSlide(item, slideIdx, pedido);
  return false;
}

/**
 * Handler de submit do form de edição de HTML.
 * @param {Event} ev
 * @param {string} htmlSrc
 */
export function submitHtmlEdit(ev, htmlSrc) {
  ev.preventDefault();
  const input = document.getElementById('html-edit-input');
  if (!input) return false;
  const pedido = input.value.trim();
  if (!pedido) return false;
  const item = state.library[state.lightboxIdx];
  if (!item) return false;
  editHtml(item, htmlSrc, pedido);
  return false;
}

// ============================================================
// register — painel oculto (sidebar: false); acionado pelo lightbox
// ============================================================

export function register() {
  Sabec.registerPanel({
    id:      'slide-editor',
    label:   'Editor de slide',
    glyph:   'S',
    crumb:   'Editor',
    sidebar: false,  // não aparece na sidebar — acionado via lightbox
    onMount(container) {
      // Raro: se navegado diretamente, exibe estado vazio amigável.
      container.innerHTML = '<div class="empty">Abra um slide pela biblioteca.</div>';
    },
  });
}
