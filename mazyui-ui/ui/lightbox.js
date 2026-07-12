// Onda 1.G + 2.C — Lightbox IG-style completo
// Portado de mazyui-ui.js:2885-3585.
//
// Keyboard: listener GLOBAL adicionado em attachKeyboardListeners() e
// removido em detachKeyboardListeners(). Optamos por global (não scoped)
// por duas razões:
//   1. ESC precisa funcionar independentemente do foco estar dentro do
//      lightbox ou não (o usuário pode ter clicado no fundo).
//   2. O listener da Onda 1 é leve (apenas ESC + setas) e se auto-remove
//      quando o lightbox fecha — sem vazamento de listeners.
// ui/shell.js (Onda 2.D) também registra um keydown global pra ESC/Ctrl+Z;
// ambos coexistem porque cada módulo verifica a condição antes de agir.

import { state, update } from '../core/state.js';
import { fileUrl, apiSave, apiState, openFolder, streamRun } from '../core/api.js';
import { escapeHtml, toast, newId } from '../core/dom.js';
import { MODELS, setSlideModel } from '../core/persist.js';
import { FORMAT_LABEL, FORMAT_DIMS, FORMAT_ASPECT, editSlide, editHtml } from '../panels/slide-editor.js';
import { reloadQuiet } from '../core/boot.js';

// ─── keyboard ────────────────────────────────────────────────────────────────

/** Handler referenciado para que removeEventListener funcione. */
let _kbHandler = null;

function _onKey(e) {
  if (e.key === 'Escape') {
    closeLightbox();
    return;
  }
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevSlide();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    nextSlide();
  }
}

export function attachKeyboardListeners() {
  detachKeyboardListeners(); // garante que não duplica
  _kbHandler = _onKey;
  document.addEventListener('keydown', _kbHandler);
}

export function detachKeyboardListeners() {
  if (_kbHandler) {
    document.removeEventListener('keydown', _kbHandler);
    _kbHandler = null;
  }
}

// ─── state helpers ────────────────────────────────────────────────────────────

/** Retorna os slides ativos do item respeitando lightboxFormat. */
function _getActiveSlides(item) {
  const fmt = state.lightboxFormat;
  if (fmt && item.formats && item.formats[fmt]) return item.formats[fmt].slides;
  return item.slides || [];
}

function _getActiveFolder(item) {
  const fmt = state.lightboxFormat;
  if (fmt && item.formats && item.formats[fmt]) return item.formats[fmt].folder;
  return item.folder;
}

function _getPrimaryFormat(item) {
  if (!item.formats) return null;
  if (item.formats.instagram) return 'instagram';
  return Object.keys(item.formats)[0] || null;
}

function _activeAspect(item) {
  const fmt = state.lightboxFormat || _getPrimaryFormat(item);
  return (FORMAT_ASPECT && FORMAT_ASPECT[fmt]) || '4/5';
}

// ─── slide preview markup ────────────────────────────────────────────────────

function _isHtmlPath(p) {
  return typeof p === 'string' && /\.html?$/i.test(p);
}

function _slidePreviewMarkup(path, fmt, idx) {
  if (!path) return '';
  if (_isHtmlPath(path)) {
    const d = (FORMAT_DIMS && FORMAT_DIMS[fmt]) || { w: 1080, h: 1350 };
    return `<iframe class="slide-frame" data-canvas-w="${d.w}" src="${fileUrl(path)}" style="width:${d.w}px;height:${d.h}px;border:none;display:block;" scrolling="no"></iframe>`;
  }
  return `<img class="slide-img" src="${fileUrl(path)}" alt="slide ${(idx || 0) + 1}" draggable="false">`;
}

// ─── restoreSlideRuns ────────────────────────────────────────────────────────

function _slideRunKey(itemName, slideIdx) {
  return itemName + '::' + slideIdx;
}

/** Restaura status visual de slides cujo run ainda está em curso após reabrir lightbox. */
function _restoreSlideRuns(item) {
  if (!item) return;
  _getActiveSlides(item).forEach((_, i) => {
    const run = state.slideRuns[_slideRunKey(item.name, i)];
    if (!run) return;
    paintSlideBusy(i, true);
    paintSlideStatus(i, 'rodando · ' + Math.floor((Date.now() - run.startedAt) / 1000) + 's');
  });
}

// ─── renderItemPng / renderItemAllPngs ───────────────────────────────────────

async function _renderItemPng(itemName, htmlPath) {
  const btn = document.getElementById('lb-render-current');
  const prog = document.getElementById('lb-render-progress');
  if (btn) { btn.textContent = 'Gerando…'; btn.disabled = true; }
  if (prog) prog.textContent = '';
  try {
    const r = await fetch('/api/render-slide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ htmlPath }),
    });
    const data = await r.json();
    if (data.ok) {
      if (prog) prog.textContent = `PNG gerado em ${data.ms || 0}ms.`;
      toast('PNG gerado.');
      reloadQuiet();
    } else {
      const msg = data.error || data.stderr || '?';
      if (prog) prog.textContent = 'erro: ' + msg;
      toast('Erro ao gerar PNG: ' + msg);
    }
  } catch {
    if (prog) prog.textContent = 'erro de conexão';
    toast('Erro ao conectar ao servidor.');
  }
  if (btn) { btn.textContent = 'PNG deste HTML'; btn.disabled = false; }
}

async function _renderItemAllPngs(itemName) {
  const btn = document.getElementById('lb-render-all');
  const prog = document.getElementById('lb-render-progress');
  if (btn) { btn.textContent = 'Gerando…'; btn.disabled = true; }
  if (prog) prog.textContent = 'preparando…';
  try {
    const r = await fetch('/api/render-carrossel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: itemName }),
    });
    if (!r.ok || !r.body) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${r.status}`);
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let total = 0, done = 0, failed = 0;
    while (true) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buf += dec.decode(value, { stream: true });
      const events = buf.split('\n\n');
      buf = events.pop() || '';
      for (const ev of events) {
        const lines = ev.split('\n');
        let name = '', payload = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) name = line.slice(7).trim();
          else if (line.startsWith('data: ')) payload += line.slice(6);
        }
        if (!payload) continue;
        let data; try { data = JSON.parse(payload); } catch { continue; }
        if (name === 'boot') { total = data.total || 0; if (prog) prog.textContent = `0/${total}…`; }
        else if (name === 'progress') { done = data.done || done; if (prog) prog.textContent = `${done}/${total}`; }
        else if (name === 'error') { failed++; }
      }
    }
    if (prog) {
      prog.textContent = failed
        ? `${done}/${total} ok · ${failed} falha${failed === 1 ? '' : 's'}`
        : `${done}/${total} pronto`;
    }
    toast(failed ? `Concluído com ${failed} falha(s).` : 'PNGs gerados.');
    reloadQuiet();
  } catch (e) {
    const msg = (e && e.message) || 'erro desconhecido';
    if (prog) prog.textContent = 'erro: ' + msg;
    toast('Erro ao gerar PNGs: ' + msg);
  }
  if (btn) { btn.textContent = 'Renderizar PNGs'; btn.disabled = false; }
}

// ─── caption helpers ─────────────────────────────────────────────────────────

/** Retorna a primeira linha da legenda, truncada a 140 chars. */
function _captionPreview(text) {
  if (!text) return '';
  const firstLine = String(text).split('\n').find(l => l.trim()) || '';
  return firstLine.length > 140 ? firstLine.slice(0, 140) + '…' : firstLine;
}

/** Gera o HTML do painel de legenda (caption). Portado de mazyui-ui.js:3236. */
function _renderCaptionPanelHTML(item) {
  const caption = (item.caption || '').trim();
  const captionPath = item.captionPath || `${item.itemFolder || ('marketing/conteudo/' + item.name)}/legenda.md`;
  const hasCaption = caption.length > 0;
  return `
    <div class="ig-caption-panel" id="cap-panel" data-path="${escapeHtml(captionPath)}">
      <div class="cap-head">
        <div class="cap-title"><span class="pin"></span> Legenda</div>
        <div class="cap-tag">${hasCaption ? 'legenda.md' : 'nenhuma legenda ainda'}</div>
      </div>
      <div id="cap-view-wrap">
        ${hasCaption
          ? `<div class="cap-view collapsed" id="cap-view">${escapeHtml(caption)}</div>`
          : `<div class="cap-empty">Nenhuma legenda salva ainda. Use "Gerar com IA" pra criar uma usando o tom da marca.</div>`}
      </div>
      <div class="cap-actions" id="cap-actions">
        ${hasCaption ? `
          <button type="button" data-cap-act="toggle">Ver tudo</button>
          <button type="button" data-cap-act="copy">Copiar</button>
          <button type="button" data-cap-act="edit">Editar</button>
          <button type="button" data-cap-act="redo">Refazer com IA</button>
        ` : `
          <button type="button" class="primary" data-cap-act="redo">Gerar com IA</button>
          <button type="button" data-cap-act="edit">Escrever manual</button>
        `}
      </div>
      <div id="cap-status" class="cap-status" style="display:none;"></div>
      <div id="cap-edit" style="display:none; flex-direction:column; gap:8px;">
        <textarea id="cap-edit-text" placeholder="Escreva a legenda…"></textarea>
        <div class="cap-actions">
          <button type="button" class="primary" data-cap-act="edit-save">Salvar</button>
          <button type="button" data-cap-act="edit-cancel">Cancelar</button>
        </div>
      </div>
      <div id="cap-redo" style="display:none; flex-direction:column; gap:8px;">
        <textarea id="cap-redo-text" placeholder="Que ajustes? Ex: mais curta, menos hashtags, foco em conversão, tom mais leve…"></textarea>
        <div class="cap-redo-suggestions">
          <button type="button" data-cap-sugg="Mais curta, direto ao ponto.">Mais curta</button>
          <button type="button" data-cap-sugg="Menos hashtags, mais texto autoral.">– hashtags</button>
          <button type="button" data-cap-sugg="Tom mais leve e conversacional.">Tom mais leve</button>
          <button type="button" data-cap-sugg="Foco em conversão com CTA claro no final.">Foco em CTA</button>
        </div>
        <div class="cap-actions">
          <button type="button" class="primary" data-cap-act="redo-go">Gerar legenda</button>
          <button type="button" data-cap-act="redo-cancel">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function _setCapStatus(msg, cls = '') {
  const el = document.getElementById('cap-status');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; el.className = 'cap-status'; return; }
  el.style.display = '';
  el.className = 'cap-status' + (cls ? ' ' + cls : '');
  el.textContent = msg;
}

function _wireCaptionPanel(item) {
  const panel = document.getElementById('cap-panel');
  if (!panel) return;
  const captionPath = panel.dataset.path;

  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-cap-act], [data-cap-sugg]');
    if (!btn) return;

    if (btn.dataset.capSugg) {
      const ta = document.getElementById('cap-redo-text');
      if (ta) {
        const cur = ta.value.trim();
        ta.value = cur ? cur + ' ' + btn.dataset.capSugg : btn.dataset.capSugg;
        ta.focus();
      }
      return;
    }

    const act = btn.dataset.capAct;
    const view = document.getElementById('cap-view');
    const editBox = document.getElementById('cap-edit');
    const redoBox = document.getElementById('cap-redo');
    const actionsBox = document.getElementById('cap-actions');

    if (act === 'toggle' && view) {
      view.classList.toggle('collapsed');
      btn.textContent = view.classList.contains('collapsed') ? 'Ver tudo' : 'Recolher';
      return;
    }

    if (act === 'copy') {
      const text = (state.library[state.lightboxIdx]?.caption || '').trim();
      try {
        await navigator.clipboard.writeText(text);
        _setCapStatus('Legenda copiada.', 'ok');
        setTimeout(() => _setCapStatus(''), 1800);
      } catch {
        _setCapStatus('Não consegui copiar — selecione manualmente.', 'err');
      }
      return;
    }

    if (act === 'edit') {
      const text = (state.library[state.lightboxIdx]?.caption || '').trim();
      document.getElementById('cap-edit-text').value = text;
      editBox.style.display = 'flex';
      redoBox.style.display = 'none';
      actionsBox.style.display = 'none';
      if (view) view.classList.remove('collapsed');
      document.getElementById('cap-edit-text').focus();
      return;
    }

    if (act === 'edit-cancel') {
      editBox.style.display = 'none';
      actionsBox.style.display = '';
      _setCapStatus('');
      return;
    }

    if (act === 'edit-save') {
      const text = document.getElementById('cap-edit-text').value;
      _setCapStatus('Salvando…');
      try {
        await apiSave(captionPath, text);
        const cur = state.library[state.lightboxIdx];
        if (cur) cur.caption = text;
        _setCapStatus('Legenda salva.', 'ok');
        setTimeout(() => {
          editBox.style.display = 'none';
          actionsBox.style.display = '';
          openLightbox(state.lightboxIdx);
        }, 500);
      } catch (err) {
        _setCapStatus('Falhou: ' + (err.message || err), 'err');
      }
      return;
    }

    if (act === 'redo') {
      redoBox.style.display = 'flex';
      editBox.style.display = 'none';
      actionsBox.style.display = 'none';
      document.getElementById('cap-redo-text').focus();
      return;
    }

    if (act === 'redo-cancel') {
      redoBox.style.display = 'none';
      actionsBox.style.display = '';
      _setCapStatus('');
      return;
    }

    if (act === 'redo-go') {
      const direction = (document.getElementById('cap-redo-text').value || '').trim();
      await _runCaptionRedo(item, captionPath, direction);
      return;
    }
  });
}

async function _runCaptionRedo(item, captionPath, direction) {
  _setCapStatus('Gerando legenda… isso pode levar 20–60s.', '');
  const goBtn = document.querySelector('#cap-redo [data-cap-act="redo-go"]');
  if (goBtn) goBtn.disabled = true;
  const itemFolder = item.itemFolder || `marketing/conteudo/${item.name}`;
  const current = (item.caption || '').trim();
  const prompt = [
    `Tarefa: refazer (ou criar, se não existir) a legenda do conteúdo em \`${itemFolder}\`.`,
    ``,
    `Arquivo de destino: \`${captionPath}\` — substitua o conteúdo inteiro.`,
    ``,
    `Direção do usuário pra essa versão:`,
    direction ? `"""${direction}"""` : `(sem direção específica — apenas melhore a legenda mantendo o tema e tom da marca)`,
    ``,
    `Contexto obrigatório a consultar antes de escrever:`,
    `- \`_memoria/empresa.md\` — quem é o negócio`,
    `- \`_memoria/preferencias.md\` — tom de voz e estilo (NÃO violar)`,
    `- \`identidade/design-guide.md\` — referência visual/verbal`,
    `- Slides do post em \`${itemFolder}/\` (especialmente \`instagram/\` ou similar) — pra puxar tema, ganchos, CTA`,
    ``,
    current ? `Legenda atual (que deve ser refeita):\n"""\n${current}\n"""` : `Não existe legenda ainda — gere do zero baseado nos slides.`,
    ``,
    `Estrutura padrão pra Instagram + Facebook:`,
    `- Gancho na primeira linha (frase curta que para o scroll)`,
    `- Corpo curto (2–5 linhas) com a ideia central, no tom da marca`,
    `- CTA quando fizer sentido pro conteúdo`,
    `- Hashtags relevantes ao final (5–10), priorizando nicho > genéricas`,
    ``,
    `Saída obrigatória: salve a legenda final em \`${captionPath}\` (Write tool). Não altere outros arquivos. Não responda com a legenda no chat — só escreva o arquivo e confirme em uma linha.`,
  ].join('\n');

  const runId = 'cap_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let sawError = false;
  try {
    await streamRun(prompt, runId, ({ event, data }) => {
      if (event === 'stderr') { sawError = true; }
      if (event === 'done') {
        try {
          const j = JSON.parse(data);
          if (j.exitCode && j.exitCode !== 0) sawError = true;
        } catch {}
      }
    }, { model: state.chat?.model || null });
  } catch (err) {
    _setCapStatus('Falhou: ' + (err.message || err), 'err');
    if (goBtn) goBtn.disabled = false;
    return;
  }

  if (sawError) {
    _setCapStatus('Geração terminou com erro. Tente de novo ou edite manual.', 'err');
    if (goBtn) goBtn.disabled = false;
    return;
  }

  _setCapStatus('Pronto — recarregando legenda…', 'ok');
  try {
    const s = await apiState();
    state.library = s.library;
    const idx = state.library.findIndex(x => x.name === item.name);
    if (idx >= 0) {
      state.lightboxIdx = idx;
      openLightbox(idx);
    } else {
      openLightbox(state.lightboxIdx);
    }
  } catch (err) {
    _setCapStatus('Legenda gerada, mas falhei ao recarregar: ' + (err.message || err), 'err');
    if (goBtn) goBtn.disabled = false;
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Abre o lightbox no item `itemIdx` da library, renderizando o card IG e o
 * painel lateral completos. Portado de mazyui-ui.js:2885.
 * @param {number} itemIdx
 * @param {number} [slideIdx=0]
 */
export async function openLightbox(itemIdx, slideIdx = 0) {
  const item = state.library[itemIdx];
  if (!item) return;

  // Reseta formato quando muda de item
  if (state.lightboxIdx !== itemIdx) update({ lightboxFormat: null });
  update({ lightboxIdx: itemIdx, lightboxSlide: slideIdx });

  const slides = _getActiveSlides(item);
  const total = slides.length;

  // ── Caption text ──────────────────────────────────────────────────────────
  const cleanName = item.name
    .replace(/^(carrossel|post)-/, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-/g, ' ');
  const fallbackCaption = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  const realCaption = (item.caption || '').trim();
  const caption = realCaption || fallbackCaption;

  // ── Avatar ────────────────────────────────────────────────────────────────
  const avatarHtml = state.logo && state.logo.path
    ? `<img src="${fileUrl(state.logo.path)}?t=${state.logo.mtime || ''}" alt="">`
    : `<div class="ig-avatar-fallback">GL</div>`;

  // ── Username derived from business name ───────────────────────────────────
  const uname = (state.business?.name && state.business.name !== '—'
    ? state.business.name : 'minha_marca')
    .toLowerCase().replace(/[^a-z0-9]/g, '') || 'minha_marca';

  // ── #lightbox-images — IG card ───────────────────────────────────────────
  const stage = document.getElementById('lightbox-images');
  if (stage) {
    stage.innerHTML = `
      <div class="ig-card" id="ig-card">
        <div class="ig-header">
          <div class="ig-avatar"><div class="ig-avatar-inner">${avatarHtml}</div></div>
          <div class="ig-user">
            <div class="uname">${uname}</div>
            <div class="uplace">${escapeHtml(state.business?.location || 'Cidade, Estado')}</div>
          </div>
          <button class="ig-more" type="button" aria-label="Mais">···</button>
        </div>
        <div class="ig-viewport" style="aspect-ratio:${_activeAspect(item)};">
          ${item.htmlSrc ? `
            <iframe id="html-frame" src="${fileUrl(item.htmlSrc)}" style="width:1080px;height:1350px;border:none;display:block;" scrolling="no"></iframe>
            <div class="ig-counter" id="ig-counter" style="display:none;">1/1</div>
            <button class="ig-nav prev" id="ig-prev" type="button" aria-label="Anterior" disabled style="display:none;">‹</button>
            <button class="ig-nav next" id="ig-next" type="button" aria-label="Próximo" style="display:none;">›</button>
          ` : `
            <div class="ig-track" id="ig-track" style="transform: translateX(0%)">
              ${slides.map((p, i) => `
                <div class="ig-slide" id="slide-cell-${i}">
                  ${_slidePreviewMarkup(p, state.lightboxFormat || _getPrimaryFormat(item), i)}
                </div>
              `).join('')}
            </div>
            ${total > 1 ? `
              <div class="ig-counter" id="ig-counter">1/${total}</div>
              <button class="ig-nav prev" id="ig-prev" type="button" aria-label="Anterior" disabled>‹</button>
              <button class="ig-nav next" id="ig-next" type="button" aria-label="Próximo">›</button>
            ` : ''}
          `}
        </div>
        <div class="ig-actions">
          <button type="button" aria-label="Curtir">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button type="button" aria-label="Comentar">
            <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          </button>
          <button type="button" aria-label="Enviar">
            <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
          <div class="spacer"></div>
          <button type="button" aria-label="Salvar">
            <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
        ${total > 1 && !item.htmlSrc ? `<div class="ig-dots" id="ig-dots">${
          slides.map((_, i) => `<div class="ig-dot${i === 0 ? ' active' : ''}" data-slide="${i}"></div>`).join('')
        }</div>` : ''}
        <div class="ig-likes">Curtido por <strong>alguém</strong> e <strong>outras pessoas</strong></div>
        <div class="ig-caption"><strong>${uname}</strong> ${escapeHtml(_captionPreview(caption))} ${caption.length > 140 || caption.includes('\n') ? '<span class="more">… mais</span>' : ''}</div>
        <div class="ig-comments">Ver todos os comentários</div>
        <div class="ig-time">Há 1 hora</div>
      </div>
    `;

    // Attach slide navigation
    if (total > 1 && !item.htmlSrc) {
      document.getElementById('ig-prev').addEventListener('click', () => goSlide(state.lightboxSlide - 1));
      document.getElementById('ig-next').addEventListener('click', () => goSlide(state.lightboxSlide + 1));
      document.querySelectorAll('#ig-dots .ig-dot').forEach(d => {
        d.addEventListener('click', () => goSlide(parseInt(d.dataset.slide, 10)));
      });
      _attachLightboxSwipe(total);
      _updateNavButtons(total);
    }

    // Zoom de iframes de slide HTML
    if (!item.htmlSrc) {
      const track = document.getElementById('ig-track');
      if (track && track.querySelector('.slide-frame')) {
        const apply = () => {
          const w = track.clientWidth;
          if (w <= 0) { setTimeout(apply, 16); return; }
          track.querySelectorAll('.slide-frame').forEach(f => {
            const canvasW = parseInt(f.dataset.canvasW || '1080', 10);
            f.style.zoom = w / canvasW;
          });
        };
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(track);
      }
    }

    // Zoom de iframe HTML source único
    if (item.htmlSrc) {
      const applyZoom = () => {
        const vp = document.querySelector('.ig-viewport');
        const frame = document.getElementById('html-frame');
        if (!vp || !frame) return;
        const w = vp.clientWidth;
        if (w <= 0) { setTimeout(applyZoom, 16); return; }
        frame.style.zoom = w / 1080;
        frame.addEventListener('load', () => {
          try {
            const htmlSlides = frame.contentDocument?.querySelectorAll('.slide');
            if (!htmlSlides?.length) return;
            const n = htmlSlides.length;
            const positions = Array.from(htmlSlides).map(s => s.offsetTop);
            let cur = 0;
            const prevBtn = document.getElementById('ig-prev');
            const nextBtn = document.getElementById('ig-next');
            const counter = document.getElementById('ig-counter');
            if (n > 1) {
              if (counter) { counter.style.display = ''; counter.textContent = `1/${n}`; }
              if (prevBtn) { prevBtn.style.display = ''; prevBtn.disabled = true; }
              if (nextBtn) { nextBtn.style.display = ''; nextBtn.disabled = false; }
              const gotoSlide = (i) => {
                cur = Math.max(0, Math.min(i, n - 1));
                frame.contentWindow.scrollTo(0, positions[cur]);
                if (counter) counter.textContent = `${cur + 1}/${n}`;
                if (prevBtn) prevBtn.disabled = cur === 0;
                if (nextBtn) nextBtn.disabled = cur === n - 1;
              };
              prevBtn?.addEventListener('click', () => gotoSlide(cur - 1));
              nextBtn?.addEventListener('click', () => gotoSlide(cur + 1));
            }
          } catch {}
        });
      };
      setTimeout(applyZoom, 0);
    }
  }

  // ── #lightbox-side — painel lateral ──────────────────────────────────────
  const fmtKeys = item.formats ? Object.keys(item.formats) : [];
  const activeFmt = state.lightboxFormat || (fmtKeys[0] || null);
  const folder = _getActiveFolder(item) || '';

  const sideEl = document.getElementById('lightbox-side');
  if (sideEl) {
    sideEl.innerHTML = `
      <h3>${escapeHtml(item.name)}</h3>
      <p>${item.htmlSrc
        ? 'Fonte HTML · edite o código, gere PNG quando pronto.'
        : `${total} slide${total === 1 ? '' : 's'} · use as setas, dots ou arraste pra navegar.`}</p>

      ${fmtKeys.length > 1 ? `
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px;" id="fmt-switcher">
        ${fmtKeys.map(k => `
          <button data-fmt="${escapeHtml(k)}"
            style="padding:5px 10px; border-radius:999px; border:1px solid rgba(245,240,232,${k === activeFmt ? '0.7' : '0.22'}); background:${k === activeFmt ? 'rgba(245,240,232,0.15)' : 'transparent'}; color:var(--paper); font:12px var(--sans); cursor:pointer; white-space:nowrap;">
            ${escapeHtml((FORMAT_LABEL && FORMAT_LABEL[k]) || k)}
          </button>`).join('')}
      </div>` : ''}

      ${_renderCaptionPanelHTML(item)}

      <div style="margin-top: 18px;">
        <div style="font: 11px/1 var(--mono); letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.55; margin-bottom: 8px;">
          Modelo das edições
        </div>
        <select id="lightbox-model"
          style="width:100%; background: rgba(245,240,232,0.06); border: 1px solid rgba(245,240,232,0.18); color: var(--paper); padding: 8px 12px; border-radius: 8px; font: 13px var(--sans); cursor: pointer; outline: none;">
          ${MODELS.map(m => `<option value="${escapeHtml(m.id)}" ${m.id === state.slideModel ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
        </select>
        <div id="lightbox-model-desc" style="font: 11px/1.4 var(--sans); color: rgba(245,240,232,0.5); margin-top: 6px;">
          ${escapeHtml((MODELS.find(m => m.id === state.slideModel) || MODELS[1]).desc)}
        </div>
      </div>

      <div class="ig-edit-panel">
        ${item.htmlSrc ? `
        <div class="ig-edit-label"><span class="pin"></span> Editar HTML</div>
        <div class="ig-edit-forms">
          <form class="ig-edit-form active" id="html-edit-form">
            <div class="row">
              <input id="html-edit-input" type="text" placeholder="Pedir alteração… (ex: mudar título, trocar cor)" autocomplete="off">
              <button id="html-edit-btn" type="submit">Aplicar</button>
            </div>
            <div id="html-edit-status" class="lightbox-slide-status"></div>
          </form>
        </div>
        ` : `
        <div class="ig-edit-label">
          <span class="pin"></span>
          Editando slide <span id="ig-edit-current">1</span> de ${total}
        </div>
        <div class="ig-edit-forms">
          ${slides.map((_, i) => `
            <form class="ig-edit-form${i === 0 ? ' active' : ''}" data-slide="${i}" id="slide-edit-form-${i}">
              <div class="row">
                <input id="slide-input-${i}" type="text" placeholder="Pedir alteração nesse slide… (ex: aumentar título, trocar cor de fundo)" autocomplete="off">
                <button id="slide-btn-${i}" type="submit">Aplicar</button>
              </div>
              <div id="slide-status-${i}" class="lightbox-slide-status"></div>
            </form>
          `).join('')}
        </div>
        `}
      </div>

      ${(item.htmlSrc || (item.slidesHtml && item.slidesHtml.length)) ? `
      <div class="lb-render-bar">
        ${item.htmlSrc ? `
        <button type="button" id="lb-render-current" title="Gera PNG só do arquivo HTML aberto">
          PNG deste HTML
        </button>
        ` : ''}
        <button type="button" id="lb-render-all" class="primary"
          title="Varre slide-*.html da pasta do item e gera um PNG por slide — pronto pra postar">
          Renderizar PNGs
        </button>
      </div>
      <div class="lb-render-progress" id="lb-render-progress"></div>
      ` : ''}

      <div style="display:flex; gap:10px; margin-top:18px; flex-wrap:wrap;">
        <button id="lightbox-fullscreen"
          type="button"
          style="background: var(--ink); color: var(--paper); border: 0; padding: 10px 16px; border-radius: 999px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500;">
          Tela cheia
        </button>
        <button id="lightbox-open-folder"
          style="background: var(--paper); color: var(--ink); border: 0; padding: 10px 16px; border-radius: 999px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500;"
          data-folder="${escapeHtml(folder)}">
          Abrir pasta das imagens
        </button>
      </div>

      <p style="font-family: var(--mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.5; margin-top: 24px;">
        ${escapeHtml(folder.replace(/\//g, ' / '))}
      </p>
    `;

    // ── Attach side panel event listeners ────────────────────────────────
    const openBtn = document.getElementById('lightbox-open-folder');
    if (openBtn) {
      openBtn.addEventListener('click', async () => {
        try { await openFolder(openBtn.dataset.folder); }
        catch (err) { toast(err.message || 'Não consegui abrir a pasta.'); }
      });
    }

    const fsBtn = document.getElementById('lightbox-fullscreen');
    if (fsBtn) fsBtn.addEventListener('click', () => openSlideFullscreen());

    const modelSel = document.getElementById('lightbox-model');
    if (modelSel) {
      modelSel.addEventListener('change', e => {
        setSlideModel(e.target.value);
        const m = MODELS.find(x => x.id === e.target.value);
        const desc = document.getElementById('lightbox-model-desc');
        if (desc && m) desc.textContent = m.desc;
      });
    }

    // Format switcher buttons
    const fmtSwitcher = document.getElementById('fmt-switcher');
    if (fmtSwitcher) {
      fmtSwitcher.addEventListener('click', e => {
        const btn = e.target.closest('[data-fmt]');
        if (btn) switchLightboxFormat(btn.dataset.fmt);
      });
    }

    // HTML edit form
    const htmlForm = document.getElementById('html-edit-form');
    if (htmlForm) {
      htmlForm.addEventListener('submit', e => {
        e.preventDefault();
        const input = document.getElementById('html-edit-input');
        if (!input) return;
        const pedido = input.value.trim();
        if (!pedido) return;
        const cur = state.library[state.lightboxIdx];
        if (!cur) return;
        editHtml(cur, item.htmlSrc, pedido);
      });
    }

    // Slide edit forms
    slides.forEach((_, i) => {
      const form = document.getElementById(`slide-edit-form-${i}`);
      if (!form) return;
      form.addEventListener('submit', e => {
        e.preventDefault();
        const cur = state.library[state.lightboxIdx];
        if (!cur) return;
        const input = document.getElementById('slide-input-' + i);
        if (!input) return;
        const pedido = input.value.trim();
        if (!pedido) return;
        if (state.slideRuns[_slideRunKey(cur.name, i)]) return;
        editSlide(cur, i, pedido);
      });
    });

    // Render PNG buttons
    const renderCurrentBtn = document.getElementById('lb-render-current');
    if (renderCurrentBtn) {
      renderCurrentBtn.addEventListener('click', () => _renderItemPng(item.name, item.htmlSrc));
    }
    const renderAllBtn = document.getElementById('lb-render-all');
    if (renderAllBtn) {
      renderAllBtn.addEventListener('click', () => _renderItemAllPngs(item.name));
    }
  }

  // ── Caption panel wiring + restore slide runs ────────────────────────────
  _restoreSlideRuns(item);
  _wireCaptionPanel(item);

  // ── Show overlay + keyboard ───────────────────────────────────────────────
  const overlay = document.getElementById('lightbox');
  if (overlay) overlay.classList.add('open');

  // Close button + backdrop click. Re-bind a cada abertura (idempotente via _bound).
  const closeBtn = document.getElementById('lightbox-close');
  if (closeBtn && !closeBtn._closeBound) {
    closeBtn.addEventListener('click', closeLightbox);
    closeBtn._closeBound = true;
  }
  if (overlay && !overlay._closeBound) {
    overlay.addEventListener('click', (e) => {
      // Só fecha quando clica no backdrop (não no conteúdo)
      if (e.target === overlay) closeLightbox();
    });
    overlay._closeBound = true;
  }

  attachKeyboardListeners();
}

/**
 * Fecha o lightbox, limpa estado e remove listeners de teclado.
 */
export function closeLightbox() {
  update({ lightboxIdx: null, lightboxSlide: 0 });
  detachKeyboardListeners();

  const overlay = document.getElementById('lightbox');
  if (overlay) overlay.classList.remove('open');
}

/**
 * Navega para o slide seguinte.
 */
export function nextSlide() {
  const item = state.library[state.lightboxIdx];
  if (!item) return;
  const total = _getActiveSlides(item).length;
  goSlide(state.lightboxSlide + 1, total);
}

/**
 * Navega para o slide anterior.
 */
export function prevSlide() {
  goSlide(state.lightboxSlide - 1);
}

/**
 * Navega para o slide no índice `targetIdx`.
 * Portado de mazyui-ui.js:3472.
 * @param {number} targetIdx
 * @param {number} [totalOverride] - evita re-calcular se já conhecido
 */
export function goSlide(targetIdx, totalOverride) {
  const item = state.library[state.lightboxIdx];
  if (!item) return;
  const total = totalOverride ?? _getActiveSlides(item).length;
  const idx = Math.max(0, Math.min(total - 1, targetIdx));
  if (idx === state.lightboxSlide) return;
  update({ lightboxSlide: idx });

  const track = document.getElementById('ig-track');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;

  const counter = document.getElementById('ig-counter');
  if (counter) counter.textContent = `${idx + 1}/${total}`;

  document.querySelectorAll('#ig-dots .ig-dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.ig-edit-form').forEach((f, i) => {
    f.classList.toggle('active', i === idx);
  });

  const cur = document.getElementById('ig-edit-current');
  if (cur) cur.textContent = idx + 1;

  const visibleInput = document.getElementById('slide-input-' + idx);
  if (visibleInput && !visibleInput.disabled) {
    setTimeout(() => visibleInput.focus({ preventScroll: true }), 60);
  }

  _updateNavButtons(total);
}

/**
 * Troca o formato ativo (ex: 'instagram', 'stories') e reabre o lightbox.
 * Portado de mazyui-ui.js:3506.
 * @param {string} fmtKey
 */
export function switchLightboxFormat(fmtKey) {
  update({ lightboxFormat: fmtKey });
  openLightbox(state.lightboxIdx);
}

/**
 * Abre slide ativo em fullscreen.
 * Portado de mazyui-ui.js:3148.
 */
export function openSlideFullscreen() {
  const item = state.library[state.lightboxIdx];
  if (!item) return;
  const slides = _getActiveSlides(item);
  if (!slides || !slides.length) return;

  const fs = {
    idx: state.lightboxSlide || 0,
    slides,
    fmt: state.lightboxFormat || _getPrimaryFormat(item),
  };

  let overlay = document.getElementById('slide-fullscreen');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'slide-fullscreen';
    overlay.innerHTML = `
      <button class="fs-close" type="button" aria-label="Fechar">×</button>
      <div class="fs-counter" id="fs-counter"></div>
      <button class="fs-nav prev" type="button" aria-label="Anterior">‹</button>
      <div class="fs-stage" id="fs-stage"></div>
      <button class="fs-nav next" type="button" aria-label="Próximo">›</button>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.fs-close').onclick = closeSlideFullscreen;
    overlay.onclick = (e) => { if (e.target === overlay) closeSlideFullscreen(); };
    window.addEventListener('resize', () => {
      if (overlay.classList.contains('open')) _renderFsSlide(overlay._fsState, overlay);
    });
  }

  overlay._fsState = fs;
  overlay.querySelector('.fs-nav.prev').onclick = () => _fsGo(fs, -1, overlay);
  overlay.querySelector('.fs-nav.next').onclick = () => _fsGo(fs, +1, overlay);

  overlay.classList.add('open');
  _renderFsSlide(fs, overlay);

  const fsKeyHandler = (e) => {
    if (e.key === 'Escape') closeSlideFullscreen();
    else if (e.key === 'ArrowLeft') _fsGo(fs, -1, overlay);
    else if (e.key === 'ArrowRight') _fsGo(fs, +1, overlay);
  };
  overlay._fsKeyHandler = fsKeyHandler;
  document.addEventListener('keydown', fsKeyHandler);
}

/**
 * Fecha o fullscreen de slide.
 * Portado de mazyui-ui.js:3188.
 */
export function closeSlideFullscreen() {
  const overlay = document.getElementById('slide-fullscreen');
  if (overlay) {
    overlay.classList.remove('open');
    if (overlay._fsKeyHandler) {
      document.removeEventListener('keydown', overlay._fsKeyHandler);
      overlay._fsKeyHandler = null;
    }
  }
}

// ─── slide status helpers (portados de mazyui-ui.js:378-389) ──────────────────

/**
 * Pinta o badge de status do slide no painel de edição inline.
 * @param {number|string} slideKey  índice do slide (ou key `name::idx`)
 * @param {string}        txt       texto a exibir
 * @param {string}        [cls='']  classe CSS adicional (ex: 'ok', 'err')
 */
export function paintSlideStatus(slideKey, txt, cls = '') {
  const el = document.getElementById('slide-status-' + slideKey);
  if (!el) return;
  el.textContent = txt;
  el.className = 'lightbox-slide-status' + (cls ? ' ' + cls : '');
}

/**
 * Habilita/desabilita (busy) os controles de edição do slide.
 * @param {number|string} slideKey  índice do slide
 * @param {boolean}       busy
 */
export function paintSlideBusy(slideKey, busy) {
  const inp = document.getElementById('slide-input-' + slideKey);
  const btn = document.getElementById('slide-btn-' + slideKey);
  if (inp) inp.disabled = busy;
  if (btn) btn.disabled = busy;
}

// ─── private helpers ──────────────────────────────────────────────────────────

function _updateNavButtons(total) {
  const prev = document.getElementById('ig-prev');
  const next = document.getElementById('ig-next');
  if (prev) prev.disabled = state.lightboxSlide <= 0;
  if (next) next.disabled = state.lightboxSlide >= total - 1;
}

function _attachLightboxSwipe(total) {
  const vp = document.querySelector('#ig-card .ig-viewport');
  if (!vp) return;
  let startX = null;
  vp.addEventListener('pointerdown', e => {
    if (e.target.closest('.ig-nav')) return;
    startX = e.clientX;
  });
  vp.addEventListener('pointerup', e => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) < 40) return;
    goSlide(state.lightboxSlide + (dx < 0 ? 1 : -1));
  });
  vp.addEventListener('pointercancel', () => { startX = null; });
}

/** Helpers de fullscreen — portados de mazyui-ui.js:3197-3225 */
function _fsGo(fs, delta, overlay) {
  const n = fs.slides.length;
  fs.idx = Math.max(0, Math.min(n - 1, fs.idx + delta));
  _renderFsSlide(fs, overlay);
}

function _renderFsSlide(fs, overlay) {
  const stage = overlay.querySelector('#fs-stage') || document.getElementById('fs-stage');
  const counter = overlay.querySelector('#fs-counter') || document.getElementById('fs-counter');
  if (!stage) return;

  const { slides, fmt, idx } = fs;
  stage.innerHTML = _slidePreviewMarkup(slides[idx], fmt, idx);

  if (counter) counter.textContent = `${idx + 1}/${slides.length}`;

  const prev = overlay.querySelector('.fs-nav.prev');
  const next = overlay.querySelector('.fs-nav.next');
  if (prev) prev.disabled = idx === 0;
  if (next) next.disabled = idx === slides.length - 1;

  requestAnimationFrame(() => {
    const frame = stage.querySelector('.slide-frame');
    if (!frame) return;
    const dims = (FORMAT_DIMS && FORMAT_DIMS[fmt]) || { w: 1080, h: 1350 };
    const vw = stage.clientWidth, vh = stage.clientHeight;
    if (vw > 0 && vh > 0) frame.style.zoom = Math.min(vw / dims.w, vh / dims.h);
  });
}
