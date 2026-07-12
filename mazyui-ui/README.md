# MazyUI UI — Modular (v2)

## TL;DR

Tudo da UI vive em `mazyui-ui/`. ES Modules nativos, sem bundler, sem build step.
`lit-html` vendorizado em `vendor/lit-html.js`. Painéis v1 (legado, `local-ui.js`)
continuam funcionando byte-a-byte. Painéis novos usam v2 (opt-in, reativo).

---

## Estrutura

```
mazyui-ui/
├── index.js                  # Entry point (Onda 3.A) — wire panels + boot
├── CONTRACTS.md              # Fonte da verdade dos contratos entre módulos
├── README.md                 # Este arquivo
├── CHANGELOG.md              # Histórico de versões
│
├── core/
│   ├── state.js              # Store reativo (subscribe + update)
│   ├── router.js             # setActive, getActive, evento 'sabec:nav'
│   ├── api.js                # Fetch wrappers (apiState, apiCall, streamRun…)
│   ├── persist.js            # localStorage (modelo, chat history, sessions)
│   ├── dom.js                # Helpers DOM: escapeHtml, toast, $, $$, newId
│   ├── brand.js              # extract* + applyIdentityToCSS + updateBrandLogo
│   ├── markdown.js           # renderChatMarkdown (wrapper seguro de marked)
│   ├── boot.js               # boot(), reload(), reloadQuiet(), loadLocalUi()
│   └── panels-registry.js    # Registry v1+v2, lifecycle mount/unmount, Sabec global
│
├── ui/
│   ├── shell.js              # mountShell(), bindGlobalKeyboard()
│   ├── nav.js                # renderNav(), NAV array
│   ├── topbar.js             # setTopbar(crumb, title, actionsHTML?)
│   ├── lightbox.js           # openLightbox, closeLightbox, goSlide…
│   └── modal.js              # openSkillModal, openGuideModal, closeModal
│
├── panels/
│   ├── hoje.js               # Dashboard home (v2, reativo)
│   ├── chat.js               # Chat principal (v1, imperativo)
│   ├── chat-attachments.js   # Upload de arquivos pro chat (v1)
│   ├── chat-stream.js        # Streaming de respostas (v1)
│   ├── memoria.js            # Memória: negocio/tom/estrategia (v2, 3 painéis)
│   ├── identidade.js         # Design guide (v2)
│   ├── skills.js             # Lista de skills disponíveis (v2)
│   ├── biblioteca.js         # Saídas do workspace (v2)
│   └── slide-editor.js       # Edição inline de slides (v1)
│
├── styles/
│   ├── tokens.css            # CSS custom properties (paleta, tipografia, espaçamento)
│   └── base.css              # Reset + componentes base (.card, .btn, .kicker…)
│
└── vendor/
    ├── lit-html.js           # lit-html 3.2.1 (self-contained, sem deps externas)
    └── lit-html-LICENSE      # BSD-3-Clause
```

---

## Contratos públicos

### v1 — legado, frozen (preservado byte-a-byte)

Mantido pra não quebrar os `local-ui.js` existentes em clientes em produção.
Nenhuma alteração de assinatura é permitida neste contrato.

```js
// Registro (chamado pelo cliente em local-ui.js)
window.Sabec.registerPanel({
  id:       'meu-painel',    // obrigatório, único
  label:    'Meu Painel',    // texto da sidebar
  crumb:    'Meu Painel',    // breadcrumb do topo
  glyph:    'M',             // letra/símbolo do nav
  sidebar:  true,            // default false
  onMount:  async (container, ctx) => { /* ... */ },
  onUnmount: () => { /* cleanup opcional */ },
});
```

**Shape do `ctx` v1:**

```js
ctx = {
  state,                                          // objeto vivo — NÃO mutar
  setTopbar(crumb, title, actionsHTML?),          // atualiza header
  setActive(id),                                  // navega pra outro painel
  api: {
    call(method, path, body?) => Promise<any>,    // fetch envelopado
  },
  fileUrl(path) => string,                        // /api/file?path=<enc>
  toast(msg),                                     // notificação curta (2400ms)
  escapeHtml(s) => string,                        // sanitização básica
}
```

**Exemplo real — painel de caixa em `local-ui.js`:**

```js
// local-ui.js (na raiz do cliente)
window.Sabec.registerPanel({
  id:      'caixa',
  label:   'Caixa',
  crumb:   'Caixa do dia',
  glyph:   'C',
  sidebar: true,

  onMount: async (container, ctx) => {
    ctx.setTopbar('Caixa', 'Movimento de hoje');
    const data = await ctx.api.call('GET', '/api/caixa');
    container.innerHTML = `
      <div class="card">
        <div class="kicker">CSV atual</div>
        <pre style="white-space:pre-wrap">${ctx.escapeHtml(data.csv)}</pre>
      </div>
    `;
  },

  onUnmount: () => {
    // limpa timers ou listeners criados no onMount
  },
});
```

---

### v2 — novo, opt-in, lit-html

Painéis internos novos e clientes que quiserem reatividade registram via
`window.Sabec.v2.registerPanel(def)`. O lifecycle é o mesmo do v1, mas o
`ctx` ganha primitivas reativas e o painel pode declarar uma função `view`
que é re-renderizada automaticamente a cada `update()` no store.

**Discriminador obrigatório:** o campo `v2: true` na def.

```js
window.Sabec.v2.registerPanel({
  id:       'meu-painel',
  label:    'Meu Painel',
  crumb:    'Meu Painel',
  glyph:    'M',
  sidebar:  true,
  v2:       true,            // discriminador obrigatório

  // Opção A: view(ctx) -> TemplateResult (re-render automático)
  view(ctx) {
    const { html, state } = ctx;
    return html`<div class="card">${state.business.name}</div>`;
  },

  // Opção B: onMount(container, ctx) — imperativo mas com ctx.html/render/subscribe
  // onMount: async (container, ctx) => { ... },

  onUnmount: () => { /* cleanup: cancelar subscribes manuais */ },
});
```

**Shape do `ctx` v2 (extends v1):**

```js
ctx = {
  // --- tudo do v1 ---
  state, setTopbar, setActive, api, fileUrl, toast, escapeHtml,

  // --- novo no v2 ---
  html,                                      // tag template do lit-html
  render(template, container),               // lit-html render (com diff)
  subscribe(fn: (state) => void) => unsubFn, // assina mudanças do store
  // update(patch) — disponível via import de core/state.js (não no ctx)
}
```

---

## Como escrever um painel v2 (guia passo-a-passo)

**Cenário:** painel interno novo que mostra o foco atual da estratégia e
re-renderiza automaticamente quando a memória muda.

```js
// panels/foco.js
import { registerInternal } from '../core/panels-registry.js';

export function register() {
  registerInternal({
    id:      'foco',
    label:   'Foco',
    crumb:   'Foco atual',
    glyph:   'F',
    sidebar: true,
    v2:      true,

    view(ctx) {
      const { html, state } = ctx;

      // Lê da memória (state é objeto vivo, sempre atualizado)
      const estrategia = state.memory?.estrategia || '';
      const foco = estrategia
        ? estrategia.split('\n').find(l => l.startsWith('## Foco')) || 'Sem foco definido'
        : 'Memória vazia — rode /instalar';

      return html`
        <div style="max-width:640px;margin:32px auto 0">
          <div class="kicker">Prioridade atual</div>
          <h2 style="font-family:var(--syne);font-size:32px;margin:8px 0 24px">
            ${foco}
          </h2>
          <div class="card">
            <pre style="white-space:pre-wrap;font-size:13px">${estrategia || '—'}</pre>
          </div>
        </div>
      `;
    },
  });
}
```

**Para usar `subscribe` manualmente (Opção B com onMount):**

```js
view(ctx) { /* não declarar */ }

onMount: async (container, ctx) => {
  const { html, render, subscribe } = ctx;

  const draw = () => {
    render(html`<p>${ctx.state.business.name}</p>`, container);
  };

  draw(); // render inicial

  // subscribe retorna unsubscribe — guardar pra cleanup
  const unsub = subscribe(() => draw());

  // salvar pra onUnmount
  container._unsub = unsub;
},

onUnmount: () => {
  // evita leak de subscriber
  if (document.getElementById('content')?._unsub) {
    document.getElementById('content')._unsub();
  }
},
```

**Regra de ouro v2:** se você usa `view(ctx)`, não precisa gerenciar
`subscribe` — o registry faz isso por você e chama o unsubscribe no
`unmountActive()`. Se você usa `onMount` + `subscribe` manualmente, chame
o unsubscribe no `onUnmount`.

---

## Como escrever um painel v1 (cliente externo — `local-ui.js`)

Use quando precisar de um painel custom no cliente sem depender de lit-html.
O contrato v1 é frozen — nada muda.

```js
// local-ui.js (na raiz da pasta do cliente)
window.Sabec.registerPanel({
  id:      'agenda',
  label:   'Agenda',
  crumb:   'Agenda',
  glyph:   'A',
  sidebar: true,

  onMount: async (container, ctx) => {
    ctx.setTopbar('Agenda', 'Próximas atividades');

    // Busca dado do servidor (requer endpoint em local-routes.mjs)
    let eventos = [];
    try {
      const res = await ctx.api.call('GET', '/api/agenda');
      eventos = res.eventos || [];
    } catch (e) {
      ctx.toast('Erro ao carregar agenda');
    }

    const items = eventos.map(ev =>
      `<li>${ctx.escapeHtml(ev.titulo)} — ${ctx.escapeHtml(ev.data)}</li>`
    ).join('');

    container.innerHTML = `
      <div class="card">
        <div class="kicker">Eventos</div>
        <ul style="margin:0;padding-left:22px;line-height:1.8">${items || '<li>Nenhum</li>'}</ul>
      </div>
    `;
  },
});
```

---

## Lifecycle

```
setActive(id)
  └─> mountPanel(id, #content)
        ├─ unmountActive()           — chama onUnmount() do painel anterior
        │                              + cleanup() do subscriber v2
        ├─ container.innerHTML = ''  — limpa DOM (v1)
        └─ onMount(container, ctx)   — monta o novo painel
             └─ [v2 com view(ctx)]
                  └─ subscribe(() => render(view(ctx), container))
                       — re-render automático no próximo microtask após update()
```

**Erros no `onMount` são contidos:** o registry exibe um card de erro no
lugar do painel — a aplicação não quebra.

---

## Store (`core/state.js`)

O store é um objeto JS simples com assinaturas reativas.

```js
import { state, update, subscribe } from './core/state.js';

// Leitura — sempre atualizado, referência viva
console.log(state.business.name);

// Mutação que DISPARA re-render em painéis v2
update({ business: { name: 'Novo nome', tagline: state.business.tagline } });

// Mutação que NÃO dispara re-render (legado, suportado pra v1)
state.business.name = 'Novo nome'; // painéis v2 NÃO reagem a isso

// Assinar mudanças
const unsub = subscribe((s) => {
  console.log('store mudou', s.active);
});
unsub(); // cancela
```

**`update()` é shallow no nó top-level.** Para atualizar objetos aninhados
como `state.chat`, passe o objeto inteiro:

```js
update({ chat: { ...state.chat, running: true } });
```

**Debounce de microtask:** múltiplos `update()` no mesmo tick JS geram
uma única notificação para os subscribers (via `queueMicrotask`).

---

## lit-html

Vendorizado em `vendor/lit-html.js`. Versão **3.2.1** (BSD-3-Clause).
Self-contained — sem deps externas, funciona com `import` nativo no browser.

**Importação dentro do `mazyui-ui/`:**

```js
// Módulos internos podem importar direto:
import { html, render } from '../vendor/lit-html.js';

// Painéis v2 recebem via ctx (re-exportado por panels-registry.js):
view(ctx) {
  const { html } = ctx;
  return html`<p>OK</p>`;
}
```

**Clientes externos (`local-ui.js` via v2) recebem `html` e `render` no
`ctx`** — não precisam importar o vendor diretamente.

**Atualizar versão:**

```bash
node scripts/vendor-lit.mjs --version=x.y.z
```

O script baixa a build standalone do CDN e sobrescreve `vendor/lit-html.js`.

---

## Como portar um painel legacy pra v2

Checklist:

- [ ] Adicionar `v2: true` na def
- [ ] Trocar `container.innerHTML = ...` por uma função `view(ctx) { return html\`...\` }`
- [ ] Substituir concatenação de string por template literals `html\`...\``
- [ ] Remover `escapeHtml()` explícito — lit-html escapa strings por padrão
      (exceto quando se usa `unsafeHTML`, que continua exigindo escape manual)
- [ ] Mover event handlers de `onclick="..."` inline pra `.onclick=${fn}` no template
- [ ] Remover `ctx.setTopbar()` do body do onMount se o painel usa `view()` —
      mover pra fora do view ou chamar só uma vez no onMount
- [ ] Testar que o painel re-renderiza quando `update({ ... })` é chamado
- [ ] Se usava `subscribe` manual + `render` manual: remover e deixar o registry
      gerenciar (basta declarar `view`)

**Painéis com estado local complexo** (ex: chat, slide-editor) podem
permanecer em v1 — não há obrigação de portar.

---

## Ambiguidades conhecidas (Ondas futuras)

1. **`update()` shallow vs deep** — objetos aninhados (`state.chat`, `state.memory`)
   precisam de spread manual. Documentado acima.

2. **`window.Sabec` é o único ponto que escreve em `window`** — todos os outros
   módulos importam de `panels-registry.js`. `index.js` faz a ponte.

3. **`index.js` ainda é stub (Onda 3.A)** — o wire de panels + boot ainda não
   está implementado. Por enquanto cada painel pode ser testado importando
   diretamente e chamando `register()`.

4. **`openSkillModal`** — painéis v2 como `hoje.js` ainda chamam o global legado
   `window.openSkillModal`. Será portado pra `ui/modal.js` na Onda 2.D.
