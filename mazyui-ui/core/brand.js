// Onda 1.E — Parsing de memória + identidade visual
// Implementação portada de mazyui-ui.js:877-1006 (extract* + applyIdentityToCSS)
// + :944 (updateBrandLogo) + :960 (updateFavicon) + :931 (loadGoogleFont).

import { state } from './state.js';
import { fileUrl } from './api.js';
import { extractPalette, extractFonts, extractFocus, extractTone, extractNextSteps } from './markdown.js';

// Re-exports dos extractors de markdown.js que o contrato de brand.js expõe.
export { extractFocus, extractTone as extractToneSummary, extractNextSteps, extractPalette, extractFonts } from './markdown.js';

/**
 * Extrai nome e tagline do negócio do markdown de empresa.
 * Versão estruturada (objeto) portada de mazyui-ui.js:877.
 * Usada por boot.js e state para popular state.business.
 *
 * @param {string} md
 * @returns {{ name: string, tagline: string }}
 */
export function extractBusiness(md) {
  if (!md) return { name: '—', tagline: '—' };
  const nameMatch = md.match(/\*\*Nome:\*\*\s*([^\n]+)/i);
  const doMatch   = md.match(/\*\*O que faz:\*\*\s*([^\n]+)/i);
  const negMatch  = md.match(/\*\*Neg[óo]cio:\*\*\s*([^\n]+)/i);
  return {
    name: nameMatch ? nameMatch[1].trim() : '—',
    tagline: doMatch ? doMatch[1].trim() : (negMatch ? negMatch[1].trim() : '—'),
  };
}

/* ============================================================
   Google Fonts — lazy loader
   Portado de mazyui-ui.js:931.
   ============================================================ */

/**
 * Injeta um `<link>` no `<head>` pra carregar a fonte do Google Fonts.
 * Idempotente: não duplica se já injetado.
 * Guard de DOM: no-op em Node.js (smoke test).
 *
 * @param {string} family  — nome da família (ex: "Inter", "Syne")
 */
export function loadGoogleFont(family) {
  if (typeof document === 'undefined') return;
  const id = 'gf-' + family.replace(/\s+/g, '-').toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  const familyParam = family.replace(/\s+/g, '+');
  link.href = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;500;700&display=swap`;
  document.head.appendChild(link);
}

/* ============================================================
   applyIdentityToCSS
   Sincroniza variáveis CSS (cores + fontes) com o design-guide.md.
   Markdown é fonte da verdade — editar o guia muda a UI inteira.
   Portado de mazyui-ui.js:968.
   ============================================================ */

/**
 * Parseia o markdown do design-guide e aplica variáveis CSS em `:root`.
 * Guard de DOM: no-op em Node.js.
 *
 * @param {string} md — conteúdo de identidade/design-guide.md
 */
export function applyIdentityToCSS(md) {
  if (typeof document === 'undefined') return;
  if (!md) return;
  const root = document.documentElement.style;

  // Cores — semântica dark: --ink é o fundo, --paper é o texto/superfícies invertidas.
  // O design-guide usa nomes humanos ("fundo principal", "texto principal");
  // esse mapa traduz pros tokens reais do CSS.
  const colorMap = [
    { test: n => /fundo principal/i.test(n),         vars: ['--ink'] },
    { test: n => /fundo alternativo|cards/i.test(n), vars: ['--paper-2'] },
    { test: n => /texto principal|tinta/i.test(n),   vars: ['--paper'] },
    { test: n => /destaque|cta|vermelho/i.test(n),   vars: ['--red'] },
    { test: n => /amarelo/i.test(n),                 vars: ['--yellow'] },
    { test: n => /verde/i.test(n),                   vars: ['--green'] },
  ];
  extractPalette(md).forEach(({ name, hex }) => {
    const hit = colorMap.find(m => m.test(name));
    if (hit) hit.vars.forEach(v => root.setProperty(v, hex));
  });

  // Fontes
  const fontMap = [
    { test: l => /título|destaque|subtítulo|display/i.test(l), varName: '--syne', fallback: 'Georgia, serif' },
    { test: l => /corpo|parágrafo|botão|botões/i.test(l),      varName: '--sans', fallback: 'system-ui, sans-serif' },
    { test: l => /sku|técnic|número|mono|código/i.test(l),     varName: '--mono', fallback: 'ui-monospace, monospace' },
  ];
  const applied = new Set();
  extractFonts(md).forEach(({ label, family }) => {
    const hit = fontMap.find(m => m.test(label));
    if (!hit || applied.has(hit.varName)) return;
    applied.add(hit.varName);
    loadGoogleFont(family);
    root.setProperty(hit.varName, `'${family}', ${hit.fallback}`);
  });
}

/* ============================================================
   Logo e favicon
   Portados de mazyui-ui.js:944 + :960.
   ============================================================ */

/**
 * Atualiza a imagem do logo na topbar com base em `state.logo`.
 * Guard de DOM: no-op em Node.js.
 * Portado de mazyui-ui.js:944.
 */
export function updateBrandLogo() {
  if (typeof document === 'undefined') return;
  const wrap = document.getElementById('brand-logo');
  const img  = document.getElementById('brand-logo-img');
  updateFavicon();
  if (!wrap || !img) return;
  if (state.logo && state.logo.path) {
    img.src = fileUrl(state.logo.path) + '&t=' + (state.logo.mtime || Date.now());
    img.alt = state.business?.name || 'Logo';
    wrap.classList.add('show');
  } else {
    wrap.classList.remove('show');
    img.removeAttribute('src');
    img.alt = '';
  }
}

/**
 * Atualiza o favicon com o logo do cliente (se disponível).
 * Guard de DOM: no-op em Node.js.
 * Portado de mazyui-ui.js:960.
 */
export function updateFavicon() {
  if (typeof document === 'undefined') return;
  const links = [document.getElementById('favicon'), document.getElementById('favicon-shortcut')];
  if (state.logo && state.logo.path) {
    const href = fileUrl(state.logo.path) + '&t=' + (state.logo.mtime || Date.now());
    links.forEach(l => { if (l) l.href = href; });
  }
}

/**
 * Busca os SVGs do brand via estado e retorna URLs.
 * Atalho conveniente pra quem precisar de { light, dark } sem montar URLs manualmente.
 *
 * @returns {Promise<{ light: string | null, dark: string | null }>}
 */
export async function loadLogo() {
  if (typeof document === 'undefined') return { light: null, dark: null };
  const logo = state.logo;
  if (!logo || !logo.path) return { light: null, dark: null };
  const url = fileUrl(logo.path) + '&t=' + (logo.mtime || Date.now());
  // O sistema não distingue light/dark por agora (logo único por cliente).
  // Quando o cliente tiver os dois SVGs, o servidor devolverá paths distintos.
  return { light: url, dark: url };
}
