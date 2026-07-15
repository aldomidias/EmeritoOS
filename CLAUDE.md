# EméritoOS — Sistema operacional do negócio

Sua empresa roda em cima desse arquivo. Aqui ficam as regras de operação
do EméritoOS — como o Claude lê o contexto, aprende com correções, mantém
tudo atualizado e cria skills novas conforme a operação evolui.

Esse arquivo é editável. Quando o `/instalar` rodar, ele complementa o
final dessa página com as regras específicas do seu negócio.

---

## ⚠️ Regra inviolável — extensões de cliente vão em `local-*`

Quando o usuário pedir uma feature nova que envolve **UI** ou **endpoint
de servidor** (ex: "sincroniza a UI com o CSV", "adiciona painel de
agenda", "cria um endpoint pra exportar dados"), o código novo vai
**SEMPRE** em:

- **Servidor:** `local-routes.mjs` (via `register({ helpers, addRoute })`)
- **UI:** `local-ui.js` (via `window.Sabec.registerPanel(def)`)

**NUNCA edite `mazyui-server.mjs`, `mazyui-ui.html`, `mazyui-ui.css` ou `mazyui-ui.js` direto pra adicionar
feature de cliente.** Esses arquivos são reescritos pelo `/atualizar-sistema`
— qualquer feature colada neles vira lixo no próximo update. Esse erro
já aconteceu (e já fez cliente perder código).

Antes de mexer em qualquer arquivo de UI/servidor, faça o teste mental:

> "Isso é feature universal pro EméritoOS (vai pro repo central) ou é
>  específico desse cliente (vai pra `local-*`)?"

Se é específico do cliente → `local-*`. Se é universal → contribua pro
repo central em `github.com/DiogoSabec/sabec-os` em vez de hackear no
cliente.

Detalhes completos da API dos hooks `local-*` estão na seção
"Extensões locais por cliente" mais abaixo.

---

## Contexto do negócio

No início de toda conversa, ler os seguintes arquivos (quando existirem
e estiverem preenchidos):

1. `_memoria/empresa.md` — quem é o usuário, o que faz, como funciona o negócio
2. `_memoria/preferencias.md` — tom de voz, estilo de escrita, o que evitar
3. `_memoria/estrategia.md` — foco atual, prioridades, prazos

Usar essas informações como base pra qualquer resposta ou decisão. Ao
sugerir prioridades, formatos ou abordagens, considerar o foco atual
descrito em `estrategia.md`.

Pra qualquer tarefa visual (carrossel, post, landing page), consultar
`identidade/design-guide.md` como referência de estilo.

Não é necessário listar o que foi lido nem confirmar a leitura. Apenas
usar o contexto naturalmente.

---

## Fluxo de trabalho

Antes de executar qualquer tarefa, verificar se existe skill relevante
em `.claude/skills/`. Se encontrar, seguir as instruções da skill. Se
não encontrar, executar a tarefa normalmente.

Ao concluir uma tarefa que não tinha skill mas parece repetível (o
usuário provavelmente vai pedir de novo no futuro), perguntar:

> "Isso pode virar uma skill pra próxima vez. Quer que eu crie?"

Não perguntar pra tarefas pontuais ou perguntas simples. Só quando o
padrão de repetição for claro.

---

## Aprender com correções

Quando o usuário corrigir algo, melhorar uma resposta ou dar uma
instrução que parece permanente (frases como "na verdade é assim", "não
faça mais isso", "prefiro assim", "sempre que...", "evita...", "da
próxima vez..."), perguntar:

> "Quer que eu salve isso pra não precisar repetir?"

Se sim, identificar onde faz mais sentido salvar:

- **Sobre o negócio** (clientes, serviços, mercado) → `_memoria/empresa.md`
- **Sobre preferências e estilo** (tom de voz, formato, o que evitar) → `_memoria/preferencias.md`
- **Sobre prioridades e foco** (projetos, metas, prazos) → `_memoria/estrategia.md`
- **Regra de comportamento nessa pasta** → próprio `CLAUDE.md`

Salvar com uma linha nova clara, sem reformatar o arquivo inteiro.
Confirmar mostrando a linha adicionada.

Não perguntar se a correção for óbvia de contexto imediato (ex: "na
verdade o arquivo se chama X"). Só perguntar quando a informação tiver
valor duradouro.

---

## Manter contexto atualizado

Ao terminar uma tarefa que mudou algo relevante (cliente novo, skill
nova, mudança de foco, processo novo, ferramenta instalada, estrutura
alterada), perguntar:

> "Isso mudou algo no teu contexto. Quer que eu atualize a memória?"

Se sim, identificar o que atualizar:

- **Cliente, serviço, ferramenta, equipe** → `_memoria/empresa.md`
- **Mudança de prioridade ou foco** → `_memoria/estrategia.md`
- **Tom ou estilo** → `_memoria/preferencias.md`
- **Pasta, regra de organização, skill criada** → `CLAUDE.md`
- **Visual (cores, fontes, logo)** → `identidade/design-guide.md`

Mostrar o que vai mudar antes de salvar. Não reformatar o arquivo
inteiro, só adicionar ou editar a linha relevante.

**Quando NÃO perguntar:**
- Tarefas pontuais sem impacto no contexto (escrever um email avulso, criar um post)
- Perguntas simples ou conversas sem ação
- Mudanças já salvas pelo bloco "Aprender com correções"

**Dica:** rode `/atualizar` pra uma varredura completa quando houver dúvida.

---

## Criação de skills

Quando o usuário pedir skill nova:

1. Verificar se existe template relevante em `templates/skills/`. Se
   existir, usar como base e adaptar pro contexto
2. Perguntar se é específica desse projeto ou útil em qualquer:
   - Específica → `.claude/skills/nome-da-skill/SKILL.md` (local)
   - Universal → `~/.claude/skills/nome-da-skill/SKILL.md` (global)
3. Ler `_memoria/empresa.md` e `_memoria/preferencias.md` pra calibrar
   o conteúdo da skill ao contexto do negócio
4. Se a skill precisar de arquivos de apoio (templates, exemplos),
   criar dentro da pasta da skill
5. Seguir o fluxo da skill-creator nativa do Claude Code

---

## Skills técnicas padrão do sistema

O EméritoOS traz um pacote de skills técnicas de segurança, UI/UX e
criação de interfaces em `.claude/skills/` (origem e licenças documentadas
em `.claude/skills/SKILLS-TECNICAS.md`):

- **Segurança:** `seguranca-web` (checklist obrigatório Emérito) e
  `owasp-security` (OWASP Top 10:2025, ASVS 5.0, LLM/Agentic AI security).
  Consultar SEMPRE antes de publicar site, API ou painel.
- **Design de UI:** `ui-ux-pro-max` (paletas, fontes, estilos por nicho),
  `frontend-design` (direção de arte), `theme-factory` (temas prontos),
  `web-design-guidelines` (auditoria de acessibilidade e UX).
- **Construção e verificação:** `react-best-practices` (performance
  React/Next), `webapp-testing` (testa sites locais com Playwright).
- **Assets visuais:** `canvas-design` (arte PNG/PDF, carrosséis) e
  `banner-design` (banners de social, ads e heroes).
- **Documentos:** `pdf`, `docx`, `xlsx`, `pptx` — propostas, relatórios,
  planilhas e apresentações profissionais direto do Claude.
- **Meta:** `skill-creator` — usar no fluxo de "Criação de skills" acima.

Fluxo padrão pra qualquer entrega visual/web: projetar com
`ui-ux-pro-max` + `frontend-design` → construir → auditar com
`web-design-guidelines` + `seguranca-web`/`owasp-security` → verificar
com `webapp-testing`.

---

## Atualização do sistema (clientes)

Cada cliente do EméritoOS é um clone com brand, dados e memória próprios.
O sistema central evolui em `github.com/DiogoSabec/sabec-os`. Pra puxar
melhorias do sistema central pra dentro de um cliente sem sobrescrever o
que é dele, o cliente roda `/atualizar-sistema`.

A skill `atualizar-sistema` puxa apenas arquivos da whitelist (server,
UI, launchers, skills, templates, partes genéricas de `package.json` e
`CLAUDE.md`) e nunca toca em `brand.config.js`, `_memoria/`,
`identidade/`, `REFERENCIAS/`, `marketing/`, `saidas/`, `dados/`,
`pacientes/`, `clientes/`.

**Convenção do `CLAUDE.md`:** esse arquivo termina com `---` (três
hífens em linha isolada) como marcador de fim do bloco genérico do
sistema. O cliente acrescenta customizações abaixo desse separador.
`/atualizar-sistema` preserva tudo o que estiver depois do último `---`.

---

## Extensões locais por cliente

Cada cliente precisa de coisas próprias: caixa pra clínica, prontuários
pra dentista, agenda pra terapeuta. O contrato é simples:

- **Código de sistema** (`mazyui-server.mjs`, `mazyui-ui.html`,
  `mazyui-ui.css`, `mazyui-ui.js`) → evolui no repo central, sobrescrito
  a cada `/atualizar-sistema`.
- **Código do cliente** (`local-routes.mjs`, `local-ui.js`) →
  intocável pelo sync. É onde feature custom mora.

Editar `mazyui-server.mjs`, `mazyui-ui.html`, `mazyui-ui.css` ou `mazyui-ui.js` direto pra adicionar uma
feature do cliente **vira lixo no próximo sync** — é assim que clientes
perdem código. Use os hooks abaixo.

### Servidor: `local-routes.mjs`

Arquivo opcional na raiz do cliente. Se existe, o servidor carrega
antes de escutar e chama `register({ ROOT, helpers, addRoute })`:

```js
// local-routes.mjs
export function register({ ROOT, helpers, addRoute }) {
  addRoute('GET', '/api/caixa', (req, res) => {
    const data = helpers.readSafe('dados/caixa.csv');
    helpers.json(res, 200, { csv: data });
  });

  addRoute('POST', '/api/caixa', async (req, res) => {
    const body = await helpers.readBody(req);
    // ... persiste em dados/caixa.csv usando helpers.safeResolve(...)
    helpers.json(res, 200, { ok: true });
  });
}
```

Helpers disponíveis: `json(res, status, payload)`, `text(res, status,
body, ct?)`, `readBody(req)`, `safeResolve(rel)`, `readSafe(rel)`. O
match de rota é por (método, path) exato — rotas internas vencem em
caso de conflito, então use prefixos próprios (ex: `/api/caixa/...`).

Se `register()` lançar, o servidor loga e continua subindo com as
rotas internas — extensão quebrada nunca derruba o painel.

### UI: `local-ui.js`

Arquivo opcional na raiz do cliente. Carregado depois do boot, registra
painéis via `window.Sabec.registerPanel(def)`:

```js
// local-ui.js
window.Sabec.registerPanel({
  id:      'caixa',
  label:   'Caixa',
  crumb:   'Caixa',
  glyph:   'C',
  sidebar: true,
  onMount: async (container, ctx) => {
    const data = await ctx.api.call('GET', '/api/caixa');
    container.innerHTML = `<div class="card"><pre>${data.csv}</pre></div>`;
  },
  onUnmount: () => { /* cleanup opcional */ },
});
```

O painel aparece na sidebar abaixo de um separador, depois dos items
internos do sistema. O `ctx` passado pra `onMount` traz:

- `state` — leitura do estado da UI (memória, library, business)
- `setTopbar(crumb, title, actionsHTML?)` — atualiza header
- `setActive(id)` — navega pra outro painel
- `api.call(method, path, body?)` — fetch envelopado com JSON e erro
- `fileUrl(path)` — URL pra servir arquivo do workspace
- `toast(msg)` — notificação curta
- `escapeHtml(str)` — sanitização básica

### Tema: `local-ui.css`

Arquivo opcional na raiz do cliente. Se existir, `mazyui-ui.html` carrega
ele depois do `mazyui-ui.css` (com `onerror="this.remove()"`, então
silenciosamente some quando ausente). É o canal correto pra cliente
sobrescrever paleta/tipografia sem hackear o CSS do sistema:

```css
/* local-ui.css */
:root {
  --ink:    #0A0A0A;
  --paper:  #EDE9DF;
  --red:    #1F4FFF;
  --sans:   'Inter', system-ui, sans-serif;
}
body { color: var(--paper); background: var(--ink); }
```

Funciona apenas pra **overrides cosméticos** (variáveis CSS, cores,
fontes, ajustes pontuais). Mudança estrutural (layout, novos elementos)
exige `local-ui.js` com `registerPanel`.

### Escape hatch: `.ui-fork`

Quando um cliente já hackeou `mazyui-ui.html/css/js` direto e não dá
mais pra desfazer, criar um arquivo vazio `.ui-fork` na raiz. O
`/atualizar-sistema` detecta e **pula os 3 arquivos UI** em todo sync
futuro — o resto (server, skills, templates, CLAUDE.md) flui normal.
É admissão de dívida técnica, não solução; sempre que possível, prefira
`local-ui.css`/`local-ui.js`.

### O que NUNCA fazer

- Editar `mazyui-server.mjs`, `mazyui-ui.html`, `mazyui-ui.css` ou `mazyui-ui.js` pra adicionar feature de
  cliente — `/atualizar-sistema` vai sobrescrever e a feature some.
  (Exceção: cliente com `.ui-fork`. Veja acima.)
- Persistir dados do cliente em qualquer lugar fora de `dados/`,
  `_memoria/`, ou pastas custom listadas em CLIENTE na skill
  `/atualizar-sistema`.
- Importar bibliotecas externas no `local-routes.mjs` — sistema não tem
  build, depende só da stdlib do Node.

Editou `local-*`? Reinicia o servidor pelo botão da topbar. Mudanças
em runtime não são suportadas de propósito.

---

## Painéis v2 (opcional, novo)

Além do `window.Sabec.registerPanel()` v1 (preservado), existe o
`window.Sabec.v2.registerPanel()` com lit-html e re-render reativo automático.

Use v2 pra painéis novos quando puder — basta adicionar `v2: true` na def e
declarar uma função `view(ctx)` que retorna um template lit-html. O registry
gerencia o `subscribe`/re-render automaticamente.

Painéis v1 (`local-ui.js` etc.) continuam funcionando exatamente como antes
— não há necessidade de migrar.

Detalhes completos, exemplos e checklist de portagem em `mazyui-ui/README.md`.

---
