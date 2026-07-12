// Onda 1.E — Markdown safe (wrap em volta do marked global)
// Implementação portada de mazyui-ui.js:2777.
// Extractors de memória portados de mazyui-ui.js:877-929.
//
// Estratégia do parser: regex pura, sem lib externa.
// Motivo: os extractors são altamente específicos ao formato do design-guide.md
// (headers Markdown + bold labels + code spans), e o formato é controlado pelo
// sistema. Regex byte-a-byte do original é suficiente e mantém zero deps no módulo.

// --- DOM guard (smoke test Node.js) ---

function escapeHtmlInternal(s) {
  const str = s == null ? '' : String(s);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renderiza markdown em HTML seguro, usando o `marked` global injetado via
 * `<script>` em mazyui-ui.html. Falha graciosamente: se marked não estiver
 * disponível, retorna o texto escapado em `<pre>`.
 *
 * Portado de mazyui-ui.js:2777.
 *
 * @param {string} text
 * @returns {string} HTML sanitizado
 */
export function renderChatMarkdown(text) {
  const src = text == null ? '' : String(text);
  // Guard: em Node (smoke test) `marked` não existe — retorna pre escapado.
  if (typeof marked === 'undefined' || !marked.parse) {
    return `<pre style="margin:0;white-space:pre-wrap;font-family:inherit">${escapeHtmlInternal(src)}</pre>`;
  }
  try {
    return marked.parse(src, { breaks: true, gfm: true });
  } catch {
    return escapeHtmlInternal(src);
  }
}

/* ============================================================
   Memory / identity extractors
   Portados byte-a-byte de mazyui-ui.js:877-929.
   ============================================================ */

/**
 * Extrai o nome do negócio do markdown de empresa como string.
 * Retorna o valor de `**Nome:**` se encontrado, caso contrário o primeiro
 * parágrafo não-vazio, ou string vazia.
 *
 * Nota: brand.js exporta `extractBusiness` como objeto { name, tagline }
 * para o state; aqui a versão string serve pra smoke tests e usos simples.
 *
 * @param {string} md
 * @returns {string}
 */
export function extractBusiness(md) {
  if (!md) return '';
  const nameMatch = md.match(/\*\*Nome:\*\*\s*([^\n]+)/i);
  if (nameMatch) return nameMatch[1].trim();
  // Fallback: primeiro parágrafo não-vazio
  const lines = md.split('\n');
  for (const line of lines) {
    const t = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
    if (t) return t;
  }
  return '';
}

/**
 * Extrai prioridade principal do markdown de estratégia.
 * Portado de mazyui-ui.js:887.
 *
 * @param {string} md
 * @returns {string}
 */
export function extractFocus(md) {
  if (!md) return '';
  const m = md.match(/##\s*Prioridade principal\s*\n+\*\*([^*]+)\*\*/i);
  if (m) return m[1].trim().replace(/\.$/, '');
  const m2 = md.match(/##\s*Prioridade principal\s*\n+([^\n]+)/i);
  return m2 ? m2[1].trim().replace(/^\*+|\*+$/g, '') : '';
}

/**
 * Extrai resumo do tom de voz do markdown de preferências.
 * Portado de mazyui-ui.js:894.
 *
 * @param {string} md
 * @returns {string}
 */
export function extractTone(md) {
  if (!md) return '';
  const m = md.match(/##\s*Tom de voz\s*\n+([^\n]+)/i);
  return m ? m[1].split('.')[0].trim() + '.' : '';
}

/**
 * Extrai próximas prioridades do markdown de estratégia.
 * Portado de mazyui-ui.js:899.
 *
 * @param {string} md
 * @returns {string[]}
 */
export function extractNextSteps(md) {
  if (!md) return [];
  const m = md.match(/##\s*Próximas prioridades[^\n]*\n([\s\S]*?)(?:\n##|$)/i);
  if (!m) return [];
  return m[1].split('\n')
    .filter(l => /^\s*\d+\./.test(l))
    .map(l => l.replace(/^\s*\d+\.\s*/, '').replace(/\*\*/g, '').split('—')[0].trim());
}

/**
 * Extrai paleta de cores do design-guide.md.
 * Formato esperado: `- **Nome:** \`#RRGGBB\` — Descrição`
 * Portado de mazyui-ui.js:907.
 *
 * @param {string} md
 * @returns {{ name: string, hex: string, note: string }[]}
 */
export function extractPalette(md) {
  if (!md) return [];
  const colors = [];
  const re = /^- \*\*([^:]+):\*\*\s*`(#[0-9a-fA-F]{3,8})`\s*[—–-]\s*([^\n]+)/gm;
  let m;
  while ((m = re.exec(md)) !== null) {
    colors.push({ name: m[1].trim(), hex: m[2].toUpperCase(), note: m[3].trim() });
  }
  return colors;
}

/**
 * Extrai fontes do design-guide.md, ignorando entradas de cor.
 * Formato esperado: `- **Label:** \`Font Family\``
 * Portado de mazyui-ui.js:918.
 *
 * @param {string} md
 * @returns {{ label: string, family: string }[]}
 */
export function extractFonts(md) {
  if (!md) return [];
  const out = [];
  const re = /^- \*\*([^:]+):\*\*\s*`([^`]+)`/gm;
  let m;
  while ((m = re.exec(md)) !== null) {
    const value = m[2].trim();
    if (/^#[0-9a-fA-F]/.test(value)) continue; // skip cor
    out.push({ label: m[1].trim(), family: value });
  }
  return out;
}
