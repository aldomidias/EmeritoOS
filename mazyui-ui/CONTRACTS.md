# MazyUI UI — Contratos de módulos (v2)

Este arquivo é a fonte da verdade pra interfaces entre módulos. Agentes
paralelos importam contra estes contratos. Mudanças aqui exigem aviso
ao orquestrador e re-trabalho da Onda 0.

Convenções gerais:

- ES Modules nativos, imports relativos com extensão `.js` explícita.
- `lit-html` é importado SOMENTE via `core/panels-registry.js` (re-export
  pra `ctx.html` / `ctx.render` dos painéis v2); módulos internos podem
  importar direto de `../vendor/lit-html.js` quando precisarem renderizar.
- localStorage keys mantêm prefixo `sabec:` e versão `:v1` (vide tabela
  em `core/persist.js`).
- Nenhum módulo escreve em `window` exceto `index.js` (define
  `window.Sabec`). `panels-registry.js` exporta o objeto JS puro; o
  bridge global vive no entry point.
- O legacy `mazyui-ui.js` (3.628 linhas) é a fonte de portabilidade. As
  referências `mazyui-ui.js:NNN` apontam pra ele.

---

## Contrato público (`window.Sabec`)

### v1 — frozen (preservado byte-a-byte do legacy)

Mantido pra **não quebrar** os `local-ui.js` que já existem em clientes
em produção. Implementação portada de `mazyui-ui.js:303-315`.

```ts
type PanelDefV1 = {
  id:       string;                                  // obrigatório, único
  label?:   string;                                  // texto da sidebar
  crumb?:   string;                                  // breadcrumb do topo
  glyph?:   string;                                  // letra/símbolo do nav
  sidebar?: boolean;                                 // default false
  onMount:  (container: HTMLElement, ctx: CtxV1) => void | Promise<void>;
  onUnmount?: () => void;                            // cleanup ao trocar de aba
};

type CtxV1 = {
  state:      typeof state;                          // leitura direta (NÃO mutar)
  setTopbar:  (crumb: string, title: string, actionsHTML?: string) => void;
  setActive:  (id: string) => void;                  // navega pra outro painel
  api: {
    call: (method: string, path: string, body?: any) => Promise<any>;
  };
  fileUrl:    (path: string) => string;              // /api/file?path=...
  toast:      (msg: string) => void;
  escapeHtml: (s: unknown) => string;
};

// Lifecycle:
// 1. Cliente chama window.Sabec.registerPanel(def) durante o boot da UI.
// 2. Registry guarda no Map; se a UI já carregou (state.loaded), força re-render.
// 3. Quando setActive(def.id) corre, render() chama def.onMount(container, ctx).
// 4. Ao trocar de aba, render() chama def.onUnmount() do painel anterior.
// 5. Exceções no onMount são contidas (mostra card de erro em vez de quebrar tudo).

window.Sabec = {
  registerPanel(def: PanelDefV1): void,
  setActive(id: string): void,
  setTopbar(crumb: string, title: string, actions?: string): void,
  toast(msg: string): void,
};
```

### v2 — novo, opt-in, lit-html

Painéis internos novos e clientes que quiserem usar `lit-html` registram
via `window.Sabec.v2.registerPanel(def)`. O lifecycle é o mesmo, mas o
`ctx` ganha primitivas reativas.

```ts
import type { TemplateResult } from '../vendor/lit-html.js';

type PanelDefV2 = {
  id:       string;
  label?:   string;
  crumb?:   string;
  glyph?:   string;
  sidebar?: boolean;
  v2:       true;                                    // discriminator obrigatório
  onMount:  (container: HTMLElement, ctx: CtxV2) => void | Promise<void>;
  onUnmount?: () => void;
};

type CtxV2 = CtxV1 & {
  html:       typeof import('../vendor/lit-html.js').html;
  render:     (template: TemplateResult, container: HTMLElement) => void;
  subscribe:  (fn: (state: typeof state) => void) => () => void;
  // Açúcares opcionais (Onda 1.D decide se entrega na v2.0):
  update?:    (patch: Partial<typeof state>) => void;
};

// Lifecycle adicional v2:
// - subscribe() retorna unsubscribe; chamar no onUnmount pra evitar leak.
// - render() pode ser chamado quantas vezes quiser; lit-html faz diff.
// - subscribe respeita o debounce de microtask do store (1 notify por batch).

window.Sabec.v2 = {
  registerPanel(def: PanelDefV2): void,
};
```

---

## Módulos internos

### `core/state.js` — Onda 1.B

Implementação portada de `mazyui-ui.js:235-261` + helpers de localStorage
em `mazyui-ui.js:85-206`.

```ts
export const state: {
  active:      string;             // id do painel ativo, default 'hoje'
  loaded:      boolean;            // true depois do apiState inicial
  folderName:  string;             // raiz do workspace do cliente
  memory:      { empresa: string; preferencias: string; estrategia: string };
  identidade:  string;             // conteúdo de identidade/design-guide.md
  logo:        { path: string; size: number; mtime: number } | null;
  contentEditing: Record<string, unknown>;
  library:     LibraryItem[];      // saídas da pasta /saidas
  business:    { name: string; tagline: string };
  currentRun:  { runId: string; turn: ChatTurn; startedAt: number } | null;
  lightboxIdx:    number | null;
  lightboxSlide:  number;
  lightboxFormat: string | null;
  slideRuns:   Record<string, { runId: string; startedAt: number; timer: number }>;
  slideModel:  string | null;
  identityHistory: { label: string; md: string; ts: number }[];
  chat: {
    turns:    ChatTurn[];
    cliSessionId:          string | null;
    cliSessionEstablished: boolean;
    running:  boolean;
    model:    string | null;
    sessionId: string | null;
    attachments: ChatAttachment[];
  };
};

export function subscribe(fn: (state: State) => void): () => void;
export function update(patch: DeepPartial<State>): void;
// notify() é interno — usa queueMicrotask pra coalescer múltiplas updates
// dentro do mesmo tick em uma única notificação.
```

### `core/router.js` — Onda 1.B

Implementação portada de `mazyui-ui.js:1028 (setActive)` + `:2024 (render)`.

```ts
export function setActive(id: string): void;
export function getActive(): string;
// Lança evento 'sabec:nav' (CustomEvent) com { detail: { from, to } }
// pra módulos não precisarem subscribe-ar o state inteiro.
```

### `core/api.js` — Onda 1.C

Fetch wrapper. Implementação portada de `mazyui-ui.js:334-373` +
`:2834 (streamRun)`.

```ts
export async function apiState(): Promise<ServerState>;
export async function apiSave(path: string, content: string): Promise<{ ok: true }>;
export async function apiShutdown(): Promise<void>;
export async function apiRestart(): Promise<void>;
export async function apiCancel(runId: string): Promise<void>;
export async function openFolder(folder: string): Promise<void>;

export function fileUrl(path: string): string;  // /api/file?path=<enc>

export type StreamEvent = { event: string; data: string };
export async function streamRun(
  prompt: string,
  runId: string,
  onEvent: (ev: StreamEvent) => void,
  opts?: { sessionId?: string | null; resumeSession?: string | null; model?: string | null },
): Promise<void>;

// Genérico usado pelo ctx.api dos painéis:
export async function apiCall(method: string, path: string, body?: any): Promise<any>;
```

### `core/persist.js` — Onda 1.B

Implementação portada de `mazyui-ui.js:57-206`.

Chaves canônicas:

| Constante           | Valor                       | Default          |
|---------------------|-----------------------------|------------------|
| `MODEL_KEY`         | `'sabec:model:v1'`          | `MODELS[0].id`   |
| `SLIDE_MODEL_KEY`   | `'sabec:slide-model:v1'`    | `'claude-sonnet-4-6'` |
| `CHAT_PERSIST_KEY`  | `'sabec:chat-persist:v1'`   | ON               |
| `CHAT_HISTORY_KEY`  | `'sabec:chat-history:v1'`   | —                |
| `CHAT_SESSIONS_KEY` | `'sabec:chat-sessions:v1'`  | `[]`             |
| `CONSENT_KEY`       | `'sabec:consented:v1'`      | —                |

```ts
export const CHAT_HISTORY_MAX_TURNS = 60;
export const CHAT_SESSIONS_MAX      = 40;

export function getModel(): string;
export function setModelId(id: string): void;
export function modelName(id: string): string;

export function getSlideModel(): string;
export function setSlideModel(id: string): void;

export function isChatPersistEnabled(): boolean;
export function setChatPersist(on: boolean): void;
export function saveChatHistory(): void;
export function loadChatHistory(): {
  turns: ChatTurn[];
  sessionId: string | null;
  cliSessionId: string | null;
  cliSessionEstablished: boolean;
} | null;
export function clearChatHistory(): void;

export function loadChatSessions(): ArchivedSession[];
export function saveChatSessions(sessions: ArchivedSession[]): void;
export function archiveCurrentChat(): void;
export function deleteChatSession(id: string): void;
export function openChatSession(id: string): boolean;

export function isConsented(): boolean;
export function setConsented(): void;
```

### `core/dom.js` — Onda 1.C

Helpers puros de DOM/string. Implementação portada de
`mazyui-ui.js:327 (newId)` + `:3587 (toast)` + `:3594 (escapeHtml)`.

```ts
export function newId(prefix: string): string;
export function escapeHtml(s: unknown): string;
export function toast(msg: string): void;       // #toast element, 2400ms
export function autoResize(textarea: HTMLTextAreaElement): void;
export function $(sel: string, root?: ParentNode): Element | null;
export function $$(sel: string, root?: ParentNode): Element[];
```

### `core/brand.js` — Onda 1.C

Parsing da memória + identidade visual. Implementação portada de
`mazyui-ui.js:877-1006` (extract* + applyIdentityToCSS) + `:944 (updateBrandLogo)`.

```ts
export function extractBusiness(md: string): { name: string; tagline: string };
export function extractFocus(md: string): string;
export function extractToneSummary(md: string): string;
export function extractNextSteps(md: string): string[];
export function extractPalette(md: string): { name: string; hex: string; note: string }[];
export function extractFonts(md: string): { label: string; family: string }[];

export function loadGoogleFont(family: string): void;
export function applyIdentityToCSS(md: string): void;
export function updateBrandLogo(): void;
export function updateFavicon(): void;
```

### `core/markdown.js` — Onda 1.C

Wrapper safe em volta do `marked` global (carregado via `<script>` em
`mazyui-ui.html`). Implementação portada de `mazyui-ui.js:2777`.

```ts
export function renderChatMarkdown(text: string): string;
// Falha graciosamente pra <pre> escapado se marked não tiver carregado.
```

### `core/boot.js` — Onda 1.D

Implementação portada de `mazyui-ui.js:757-872` (boot + consent + reload).

```ts
export async function boot(): Promise<void>;
export function renderConsent(): void;
export function postConsentBoot(): void;
export function triggerOnboarding(): void;
export async function reload(): Promise<void>;     // estado pesado
export async function reloadQuiet(): Promise<void>; // só library, sem re-render
export async function loadLocalUi(): Promise<void>; // <script src="/local-ui.js">
```

### `core/panels-registry.js` — Onda 1.D

Registry que combina painéis internos e externos. Re-exporta `lit-html`
pro `ctx.v2`. Implementação portada de `mazyui-ui.js:270-315`.

```ts
import { html, render } from '../vendor/lit-html.js';

export type PanelDef = PanelDefV1 | PanelDefV2;

// API interna usada por panels/*.js (preferida pra módulos internos):
export function registerInternal(def: PanelDef): void;
export function getPanel(id: string): PanelDef | undefined;
export function listSidebarPanels(): PanelDef[];
export function makeCtx(def: PanelDef): CtxV1 | CtxV2;

// Bridge global usada por clientes (local-ui.js):
export const Sabec: {
  registerPanel: (def: PanelDefV1) => void;     // v1, frozen
  setActive: (id: string) => void;
  setTopbar: (crumb: string, title: string, actions?: string) => void;
  toast: (msg: string) => void;
  v2: { registerPanel: (def: PanelDefV2) => void };
};

// Lifecycle/active-panel housekeeping (usado pelo router):
export function mountActive(): void | Promise<void>;
export function unmountActive(): void;
```

### `ui/shell.js` — Onda 2.D

Renderização do "esqueleto" da UI (containers fixos: #content, #toast,
#modal-backdrop, #lightbox, #guide-backdrop). Implementação portada de
`mazyui-ui.html` (estrutura DOM) + bindings globais de `mazyui-ui.js:3599`.

```ts
export function mountShell(root?: HTMLElement): void;
export function bindGlobalKeyboard(): void;  // ESC + setas + Ctrl+Z
```

### `ui/nav.js` — Onda 2.D

Sidebar. Implementação portada de `mazyui-ui.js:1007-1027` (renderNav +
navItemHTML) + NAV array em `:4-13`.

```ts
export const NAV: { id: string; label: string; glyph: string }[];
export function renderNav(): void;
```

### `ui/topbar.js` — Onda 2.D

Header com breadcrumb, title e ações. Implementação portada de
`mazyui-ui.js:1029-1033`.

```ts
export function setTopbar(crumb: string, title: string, actionsHTML?: string): void;
```

### `ui/lightbox.js` — Onda 2.C

Lightbox de biblioteca (carrossel preview, edição inline de slides,
caption, fullscreen). Implementação portada de `mazyui-ui.js:2885-3585`.

```ts
export async function openLightbox(idx: number): Promise<void>;
export function closeLightbox(): void;
export function goSlide(targetIdx: number): void;
export function switchLightboxFormat(fmtKey: string): void;
export function openSlideFullscreen(): void;
export function closeSlideFullscreen(): void;
```

### `ui/modal.js` — Onda 2.D

Modal genérico de skill (form + execução) + modal "Primeiros passos".
Implementação portada de `mazyui-ui.js:1121 (openGuideModal)` +
`:2313 (openSkillModal)` + `:2871 (closeModal)`.

```ts
export function openSkillModal(skillId: string): void;
export function closeModal(): void;
export function openGuideModal(): void;
export function closeGuideModal(): void;
```

### `panels/*.js` — shape comum

Cada módulo de painel exporta um único símbolo:

```ts
export function register(): void;
// Implementação: chama registerInternal(...) do panels-registry,
// preferindo o shape v2 quando o painel for novo/portado pra lit-html.
```

Nada mais é exportado. `index.js` importa cada `panels/*.js` e chama
`register()` na ordem definida pelo `NAV` array.

Mapeamento legacy → módulo:

| Painel       | Módulo                       | Fonte legacy                       |
|--------------|------------------------------|------------------------------------|
| Hoje         | `panels/hoje.js`             | `renderHoje()` `:1038`             |
| Chat         | `panels/chat.js`             | `renderChat()` `:1666`             |
| Chat attach  | `panels/chat-attachments.js` | `:2370-2524`                       |
| Chat stream  | `panels/chat-stream.js`      | `:2526-2832`                       |
| Memória*     | `panels/memoria.js`          | `renderMemoryPage()` `:1176`       |
| Identidade   | `panels/identidade.js`       | `renderIdentidade()` `:1239`       |
| Skills       | `panels/skills.js`           | `renderSkills()` `:1515`           |
| Biblioteca   | `panels/biblioteca.js`       | `renderBibliotecaInner()` `:1547`  |
| Slide editor | `panels/slide-editor.js`     | `submitSlideEdit`/`editSlide` `:484-664` |

`memoria.js` cobre os 3 painéis de memória (`negocio`, `tom`,
`estrategia`) — todos compartilham o mesmo template, mudam só o
arquivo-fonte.

---

## Ambiguidades conhecidas (atenção das Ondas seguintes)

1. **`store.update()` shallow vs deep** — `state.chat` e `state.memory`
   são objetos aninhados. Decidir na Onda 1.B se `update({ chat: {...} })`
   é replace total ou merge. Sugestão: shallow nos nós top-level,
   mas documentar.

2. **Painéis v1 ainda mutam `state` direto** (ex: `local-ui.js` lê
   `ctx.state.business`). O store novo precisa expor `state` como objeto
   "vivo" (proxy ou referência direta). Se virar proxy, validar que
   `for...of` e `JSON.stringify` continuam funcionando.

3. **`window.Sabec` vs ESM puro** — clientes em produção dependem do
   global. `index.js` é o ÚNICO ponto que escreve em `window` — todos
   os outros módulos importam de `panels-registry.js`.

4. **lit-html bundling** — `vendor/lit-html.js` precisa ser self-contained
   (sem deps externas) pra evitar configurar bundler. Onda 1.A deve usar
   a build standalone do CDN (`https://esm.run/lit-html` → arquivo local).

5. **Compat do `ctx.api.call` v1** — Onda 1.D deve garantir que a
   assinatura é idêntica a `:278-296`. Mudança aqui quebra clientes.

6. **`local-ui.css`** — não tem módulo dedicado; é só `<link>` em
   `mazyui-ui.html` (mantido como está).
