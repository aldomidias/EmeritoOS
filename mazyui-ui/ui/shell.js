// Onda 1.F — Shell (chrome da UI: nav + topbar)
// Orquestra a montagem inicial do chrome: registra renderNav no router
// e dispara o render inicial da sidebar.
//
// Nota: router.js (Onda 1.B) ainda não expõe setNavRenderer — o bind é
// feito via evento 'sabec:nav' (CustomEvent) lançado pelo router quando
// o painel ativo muda. Shell escuta e re-renderiza o nav.

import { renderNav }  from './nav.js';
import { setTopbar }  from './topbar.js';

export { setTopbar };  // re-export conveniente pro index.js

export function mountShell() {
  // Render inicial da sidebar
  renderNav();

  // Re-renderiza nav a cada mudança de painel ativo (evento disparado pelo
  // router — mazyui-ui.js:1028 equivalente). Compatível com Onda 1.B futura
  // que deve emitir CustomEvent('sabec:nav').
  window.addEventListener('sabec:nav', () => renderNav());

  // Fallback: se o router (Onda 1.B) expuser setNavRenderer quando importado,
  // registra o callback para garantir atualização reativa da sidebar.
  import('../core/router.js').then(router => {
    if (typeof router.setNavRenderer === 'function') {
      router.setNavRenderer(renderNav);
    }
  }).catch(() => {
    // router ainda stub — evento 'sabec:nav' é suficiente
  });
}
