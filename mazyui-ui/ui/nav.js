// Onda 1.F — Sidebar de navegação
// Implementação portada de mazyui-ui.js:1007-1027 (renderNav + navItemHTML)
// + NAV array em mazyui-ui.js:4-13.

import { html, render } from '../vendor/lit-html.js';
import { state } from '../core/state.js';
import { listSidebarPanels } from '../core/panels-registry.js';

export const NAV = [
  { id: 'hoje',       label: 'Hoje',        glyph: 'H' },
  { id: 'chat',       label: 'Chat',        glyph: '/' },
  { id: 'skills',     label: 'Skills',      glyph: 'S' },
  { id: 'negocio',    label: 'Negócio',     glyph: 'N' },
  { id: 'tom',        label: 'Tom de voz',  glyph: 'T' },
  { id: 'estrategia', label: 'Estratégia',  glyph: 'E' },
  { id: 'identidade', label: 'Identidade',  glyph: 'I' },
  { id: 'biblioteca', label: 'Biblioteca',  glyph: 'B' },
];

function navItem(item, active) {
  return html`
    <button
      class="nav-item ${active ? 'active' : ''}"
      data-id="${item.id}"
      @click="${() => window.Sabec && window.Sabec.setActive(item.id)}"
    >
      <span class="ico">${item.glyph || '·'}</span>
      <span>${item.label}</span>
    </button>
  `;
}

export function renderNav() {
  const sidebar = document.querySelector('.nav') || document.getElementById('nav');
  if (!sidebar) return;

  const internal = NAV;
  let custom = [];
  try {
    custom = listSidebarPanels().filter(p => p.sidebar !== false && !NAV.find(i => i.id === p.id));
  } catch (_) {
    // panels-registry ainda não implementado (Onda 1.D) — ignora silenciosamente
  }

  render(html`
    ${internal.map(item => navItem(item, state.active === item.id))}
    ${custom.length ? html`<div class="nav-sep" aria-hidden="true"></div>` : ''}
    ${custom.map(item => navItem({
      id:    item.id,
      label: item.label || item.id,
      glyph: (item.glyph || (item.label || item.id).slice(0, 1)).toString().toUpperCase(),
    }, state.active === item.id))}
  `, sidebar);
}
