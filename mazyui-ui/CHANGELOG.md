# Changelog — mazyui-ui

## v2.0.0 — Modular UI + lit-html (Onda 2, em andamento)

### Adicionado

- Diretório `mazyui-ui/` com estrutura modular: `core/`, `ui/`, `panels/`,
  `styles/`, `vendor/`.
- **Contrato v2** (`window.Sabec.v2.registerPanel`) com lit-html templating
  reativo e discriminador `v2: true` na def.
- **Store reativo** (`core/state.js`): `subscribe(fn)` + `update(patch)`
  com debounce via `queueMicrotask` — 1 notify por batch de updates.
- **Lifecycle v2 automático**: painéis com `view(ctx)` ganham re-render
  automático sem precisar gerenciar `subscribe` manualmente; `unmountActive()`
  cancela o subscriber.
- **Módulos core portados do legado:**
  - `core/state.js` — shape de `mazyui-ui.js:235-261`
  - `core/router.js` — `setActive`/`getActive` + evento `sabec:nav`
  - `core/api.js` — fetch wrappers (`apiState`, `apiCall`, `streamRun`, `fileUrl`…)
  - `core/persist.js` — localStorage com chaves `sabec:*:v1`
  - `core/dom.js` — `escapeHtml`, `toast`, `$`, `$$`, `newId`, `autoResize`
  - `core/brand.js` — `extract*` + `applyIdentityToCSS` + `updateBrandLogo`
  - `core/markdown.js` — `renderChatMarkdown` (wrapper de `marked`)
  - `core/boot.js` — `boot()`, `reload()`, `reloadQuiet()`, `loadLocalUi()`
  - `core/panels-registry.js` — registry v1+v2, `mountPanel`, `unmountActive`,
    bridge `window.Sabec`, re-export de `lit-html` pro ctx v2
- **Módulos UI portados:**
  - `ui/shell.js` — `mountShell()`, `bindGlobalKeyboard()`
  - `ui/nav.js` — `renderNav()`, array `NAV`
  - `ui/topbar.js` — `setTopbar(crumb, title, actionsHTML?)`
  - `ui/lightbox.js` — `openLightbox`, `closeLightbox`, `goSlide`,
    `switchLightboxFormat`, fullscreen
  - `ui/modal.js` — `openSkillModal`, `openGuideModal`, `closeModal`
- **Painéis portados pra v2 (lit-html, reativos):**
  - `panels/hoje.js` — dashboard home
  - `panels/memoria.js` — 3 painéis: negocio, tom, estrategia (mesmo template)
  - `panels/identidade.js` — design guide
  - `panels/skills.js` — lista de skills disponíveis
  - `panels/biblioteca.js` — saídas do workspace
- **Painéis mantidos em v1 (imperativo):**
  - `panels/chat.js` — chat principal
  - `panels/chat-attachments.js` — upload de arquivos
  - `panels/chat-stream.js` — streaming de respostas
  - `panels/slide-editor.js` — edição inline de slides
- **`vendor/lit-html.js`** — lit-html 3.2.1 self-contained (BSD-3-Clause),
  sem deps externas, funciona com `import` nativo no browser.
- **`styles/tokens.css`** — CSS custom properties (paleta, tipografia, espaçamento).
- **`styles/base.css`** — reset + componentes base (`.card`, `.btn`, `.kicker`…).
- **Handler estático `/mazyui-ui/*`** no `mazyui-server.mjs` pra servir os módulos.

### Preservado (byte-a-byte, contrato frozen)

- `window.Sabec.registerPanel(def)` v1 — `local-ui.js` de clientes existentes
  continuam funcionando sem nenhuma alteração.
- Shape de `ctx` v1: `{ state, setTopbar, setActive, api: { call }, fileUrl, toast, escapeHtml }`.
- Chaves de `localStorage` com prefixo `sabec:` e sufixo `:v1`.

### Removido

- `mazyui-ui.css` e `mazyui-ui.js` na raiz — substituídos por `mazyui-ui/styles/`
  e `mazyui-ui/index.js`. O `/atualizar-sistema` faz cleanup automático.
- Rotas legacy `/mazyui-ui.css` e `/mazyui-ui.js` retornam `410 Gone` pra
  proteger caches stale.

### Mudado

- `mazyui-ui.html` aponta pros novos arquivos modulares (`mazyui-ui/index.js`,
  `mazyui-ui/styles/tokens.css`, `mazyui-ui/styles/base.css`). Placeholders
  `renderBrand` e `renderNav` preservados.
- `/atualizar-sistema` whitelist atualizada pra incluir `mazyui-ui/` inteiro.
- `.ui-fork` agora pula a pasta `mazyui-ui/` inteira no sync (além dos 3 arquivos
  de UI que já pulava).

### Pendente (Onda 3)

- `index.js` — wire completo de panels + boot (Onda 3.A)
- Integração `openSkillModal` via `ui/modal.js` (painéis v2 ainda usam global legado)
- `scripts/vendor-lit.mjs` — script de bump do lit-html

---

## v1.x — mazyui-ui.js monolítico (legado)

O `mazyui-ui.js` original (3.628 linhas) permanece como referência de
portabilidade durante a migração. Todas as referências `mazyui-ui.js:NNN`
nos comentários dos módulos apontam pra ele. Será removido após a Onda 3.
