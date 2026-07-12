// Onda 3.A — Entry point. Wire panels + boot.
//
// Ordem de inicialização:
//   1. window.Sabec exposto (local-ui.js de clientes pode checar Sabec na carga)
//   2. Painéis built-in registrados
//   3. mountShell() — monta chrome (sidebar/topbar); usa painéis já registrados
//   4. setBoot() — injeta hooks de navegação no boot (evita circular)
//   5. boot() — busca estado, hidrata, carrega local-ui.js, navega pra 'hoje'

import { Sabec }       from './core/panels-registry.js';
import { boot, setBoot }             from './core/boot.js';
import { mountShell, setTopbar }     from './ui/shell.js';
import { setActive }                 from './core/router.js';
import { escapeHtml }                from './core/dom.js';
import { state }                     from './core/state.js';
import * as persistModule            from './core/persist.js';

// Persist usa _getStateSync() internamente — sem injeção, saveChatHistory/
// archiveCurrentChat/openChatSession são no-ops silenciosos e o histórico
// de chat não persiste entre sessões nem ao trocar de aba do histórico.
persistModule._injectState({ state });

// Painéis built-in
import * as hoje        from './panels/hoje.js';
import * as chat        from './panels/chat.js';
import * as skills      from './panels/skills.js';
import * as memoria     from './panels/memoria.js';
import * as identidade  from './panels/identidade.js';
import * as biblioteca  from './panels/biblioteca.js';
import * as slideEditor from './panels/slide-editor.js';

import { dispatchRun } from './panels/chat-stream.js';

// ---------------------------------------------------------------------------
// 1. Expõe contrato público ANTES de qualquer boot
// ---------------------------------------------------------------------------
window.Sabec = Sabec;

// Expõe helpers úteis para painéis que dependem de globais legados
window.reload       = () => import('./core/boot.js').then(m => m.reload());
window.reloadQuiet  = () => import('./core/boot.js').then(m => m.reloadQuiet());

// ---------------------------------------------------------------------------
// 2. Registra painéis built-in
// ---------------------------------------------------------------------------
hoje.register();
chat.register();         // v1 via Sabec.registerPanel
skills.register();       // v2 via registerInternal({ v2: true })
memoria.register();      // registra 3 painéis: negocio, tom, estrategia
identidade.register();   // v1 imperativo (editor de swatches com listeners DOM)
biblioteca.register();   // v2 via Sabec.v2.registerPanel
slideEditor.register();  // v1 via Sabec.registerPanel (sidebar: false)

// ---------------------------------------------------------------------------
// 3. Monta o chrome (sidebar + topbar)
// ---------------------------------------------------------------------------
mountShell();

// ---------------------------------------------------------------------------
// 4. Injeta hooks no boot (evita dependência circular boot ↔ router)
// ---------------------------------------------------------------------------
setBoot({
  setActive,
  setTopbar,
  render: () => setActive(state.active || 'hoje'),
  escapeHtml,
  dispatchRun,
});

// ---------------------------------------------------------------------------
// 5. Boot: hidrata state, aplica identidade, carrega local-ui.js, navega
// ---------------------------------------------------------------------------
boot();
