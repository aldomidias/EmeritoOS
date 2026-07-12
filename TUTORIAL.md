# EméritoOS — Tutorial completo

> Tudo que o sistema tem, o que cada peça faz e como usar no dia a dia.

O EméritoOS é um sistema operacional de negócio que roda dentro do Claude
Code, com um painel web local por cima. Duas portas de entrada, o mesmo
cérebro:

- **Claude Code** (terminal ou VS Code) — você conversa, o sistema executa.
- **Painel web** (`http://localhost:7777`) — interface visual pra memória,
  skills, biblioteca de conteúdo e edição de slides.

---

## 1. Ligando o sistema

### Pelo painel (visual)

- **macOS:** dois cliques em `Abrir EmeritoOS.command`
- **Windows:** dois cliques em `Abrir EmeritoOS.bat`

Na primeira vez no macOS, libera o script:

```bash
chmod +x "Abrir EmeritoOS.command"
```

O script sobe o servidor local e abre `http://localhost:7777` no navegador.
Pra desligar, botão de desligar no próprio painel.

Pré-requisitos: [Node.js 18+](https://nodejs.org) e Claude Code autenticado
(`claude login`).

### Pelo Claude Code (conversa)

Abre o terminal na pasta do EméritoOS, roda `claude` e usa as skills
direto (`/abrir`, `/carrossel`, etc.).

### Primeiro uso

Roda `/instalar` uma única vez. Ele te entrevista sobre o negócio, tom de
voz, foco atual e identidade visual, e preenche a memória. Depois disso o
sistema já te conhece — é só usar.

---

## 2. Como o sistema pensa

```
EmeritoOS/
├── _memoria/         ← o cérebro (lido antes de toda resposta)
│   ├── empresa.md         quem é o negócio, o que faz, como funciona
│   ├── preferencias.md    tom de voz, estilo, o que evitar
│   └── estrategia.md      foco atual, prioridades, prazos
├── identidade/       ← o rosto (design-guide.md: cores, fontes, logo)
├── dados/            ← entrada: solta CSV, export, print pra analisar
├── marketing/        ← saída: conteúdo produzido pelas skills
├── saidas/           ← saída: outputs gerais
├── scripts/          ← automações
├── templates/        ← modelos reutilizáveis (perfis, skills, identidade)
├── .claude/skills/   ← as 29 skills (16 do sistema + 13 do pacote agência)
├── _privado/         ← dados sensíveis: ofertas, pipeline, leads (fora do git)
├── clientes/         ← um projeto por cliente da agência (fora do git)
├── mazyui-server.mjs ← servidor do painel (não editar na mão)
├── mazyui-ui/        ← interface do painel (não editar na mão)
└── brand.config.js   ← marca do painel (esse pode editar)
```

Regra de ouro: **quanto melhor a `_memoria/`, melhor o sistema**. O Claude
lê ela antes de cada resposta.

---

## 3. As skills — sistema (16) + pacote agência (13)

### Núcleo — operação do dia a dia

**`/instalar`** — Setup inicial, roda uma vez. Entrevista sobre empresa,
tom de voz, foco e identidade visual; preenche `_memoria/` e
`identidade/design-guide.md` e adapta o `CLAUDE.md` ao teu perfil.
*Use quando:* acabou de clonar o sistema.

**`/abrir`** — Abre a sessão de trabalho: carrega a memória do negócio
(empresa, preferências, estratégia, identidade) e devolve um resumo curto
do contexto. *Use quando:* "abrir", "começar o dia", primeiro turno da sessão.

**`/salvar`** — Commit + push do trabalho pro GitHub. Na primeira vez,
configura o repositório remoto. *Use quando:* "salvar", "backup", fim de
sessão de trabalho.

**`/atualizar`** — Varre o projeto e reconcilia os arquivos de contexto
(`_memoria/*.md`, `CLAUDE.md`, `identidade/design-guide.md`) com o estado
real do workspace. *Use quando:* a memória ficou defasada, "varre o projeto".

**`/atualizar-sistema`** — Atualiza SÓ o motor (servidor, UI, launchers,
skills, templates) puxando do repositório central, sem tocar em memória,
dados, marca ou identidade. *Use quando:* quiser puxar melhorias do sistema
sem perder nada teu.

**`/novo-projeto`** — Cria pasta de projeto nova com `CLAUDE.md` dedicado,
depois de entrevista curta (cliente, objetivo, entregas). *Use quando:*
"novo cliente", "começar projeto pra X".

**`/mapear-rotinas`** — Entrevista curta sobre o que você repete toda
semana, propõe skills concretas e cria as aprovadas em `.claude/skills/`.
*Use quando:* "o que dá pra automatizar?", "criar skills personalizadas".

### Conteúdo e SEO — vitrine pública

**`/carrossel`** — Cria carrosséis e posts visuais (Instagram, TikTok,
LinkedIn) com a identidade da marca. Gera um HTML por slide (1080×1350
padrão; aceita 4:5, 1:1, 9:16 e 16:9) com copy e legenda prontas. Os PNGs
são renderizados depois, pelo botão **Renderizar** do painel. Suporta texto
puro, foto IA e post único. *Use quando:* "faz um carrossel sobre X".

**`/publicar-tema`** — Orquestra a peça completa a partir de um tema:
artigo de blog + carrossel resumo (via `/carrossel`) + legendas pra
Instagram, Facebook e LinkedIn, tudo amarrado com o carrossel apontando
pro blog. *Use quando:* "publica o tema X", "gera o conteúdo do tema".

**`/aprovar-post`** — Publica um post da fila: flipa o blog de draft pra
published, copia os PNGs pro site, faz commit + push (deploy automático),
espera o deploy e posta o carrossel no Instagram + Facebook via Meta Graph
API. *Use quando:* "aprovar post X". *Precisa:* tokens da Meta configurados.

**`/seo`** — Fluxo completo em 8 passos: pesquisa de demanda, análise de
concorrência, Google Meu Negócio, otimização on-page, estratégia de
conteúdo, Google Ads, checklist de monitoramento e GEO (aparecer em IAs
como ChatGPT, Gemini e Perplexity). *Use quando:* "seo", "quero aparecer
no Google/nas IAs".

**`/responder-avaliacoes`** — Respostas curtas e humanas pras avaliações
do Google Meu Negócio: nome do cliente, agradecimento variado, frase
concreta sobre o serviço. Zero cara de resposta automática. *Use quando:*
"responder avaliação".

### Anúncios pagos — onde o dinheiro entra

**`/anuncio-google`** — Campanha completa de Google Ads a partir de
briefing ou da pesquisa SEO: CSV pronto pro Google Ads Editor com
campanhas Search por cluster de palavra-chave, grupos de anúncio, RSAs,
extensões e negativas. *Use quando:* "criar campanha google ads".

**`/relatorio-ads`** — Relatório semanal de performance (Google Ads +
Meta Ads) a partir de CSVs exportados ou prints: KPIs, top criativos,
alertas (queima de orçamento, CTR baixo, conversão caindo) e recomendações
pra semana seguinte. *Use quando:* "como foram os ads essa semana?".

### Produção — ferramentas de apoio

**`/analisar-dados`** — Lê um arquivo de dados (CSV, Excel, TXT, JSON) e
devolve resumo executivo com insights, tendências e recomendações.
*Use quando:* arrastar um arquivo e perguntar "o que esses dados mostram?".

**`/email-profissional`** — Rascunha email profissional a partir de
contexto livre, calibrando o tom ao destinatário e ao objetivo.
*Use quando:* "escreve um email pra...", "como respondo isso?".

---

### 🎯 Pacote agência — Motor comercial

O funil inteiro, da DM fria ao contrato assinado.

**`/conteudo`** *(privada, fora do repositório)* — Conteúdo de Instagram em
4 formatos (Reels, Stories, carrossel, estático) partindo dos 8 modelos
visuais aprovados, com mapa de dores por nicho. Estrutura dor → benefício,
nunca revela o "como". *Use quando:* "conteúdo pro insta", "roteiro de reels".

**`/prospeccao`** *(privada, fora do repositório)* — Social selling ativo:
jornada do lead em 7 estágios, DMs na voz do dono, banco de objeções e
scripts de WhatsApp por especialidade. *Use quando:* "me responderam, o que
digo?", "aborda o dr X".

**`/diagnostico`** — Varre a presença digital de um lead (Google, site,
Instagram, GMB), cruza com as dores do nicho e gera o diagnóstico gratuito
pronto pra call + notas privadas com o degrau recomendado da esteira.
*Use quando:* "diagnóstico do lead X", "prepara a call com Y".

**`/proposta`** — Proposta comercial personalizada por nicho e degrau,
sempre com os 3 degraus visíveis (entrada, escolhido, âncora) e follow-up
agendado. *Use quando:* "fechamos a call, gera a proposta".

**`/pipeline`** — CRM de leads: follow-ups do dia, quem esfriou, retrato do
funil por estágio, registro de cada movimento. Dados em `_privado/` (nunca
versionados). *Use quando:* "quem eu cobro hoje?", "como tá o funil?".

### 📦 Pacote agência — Entrega

O Método Emérito virando processo, do aceite à entrega final.

**`/onboarding-cliente`** — Fechou? Cria a pasta do cliente com briefing
pré-preenchido (aproveita diagnóstico e call), checklist dos blocos do
método por degrau e mensagem de kickoff. *Use quando:* "cliente novo".

**`/posicionamento`** — O bloco 1: entrevista guiada, análise de
concorrentes locais e narrativa de autoridade (posicionamento em uma frase,
território, pilares, bio e headline prontas). *Use quando:* "posicionamento
do dr X".

**`/kit-conteudo`** — O bloco 4: kit de 8 a 12 peças (60 dias de munição)
na voz do CLIENTE, com calendário de publicação, respeitando o conselho do
nicho. *Use quando:* "arranque de conteúdo do cliente Y".

**`/site-autoridade`** — O bloco 3: site padrão validado (9 seções), copy
derivada da narrativa, SEO local com schema por profissão, checklist de
segurança obrigatório antes de publicar. *Use quando:* "monta o site do dr X".

### 💰 Pacote agência — Novos produtos

As ofertas de recorrência e a expansão de mercado.

**`/relatorio-cliente`** — Relatório mensal de crescimento por cliente
(GMB, Instagram, site, ads) traduzido pra língua de negócio, com plano do
mês seguinte. Roda em lote pra carteira inteira. É o que torna a
recorrência escalável. *Use quando:* "fecha o mês do cliente X".

**`/atendimento-ia`** — O produto de atendimento 24h no WhatsApp: desenha o
fluxo por especialidade (recepção, triagem, agendamento, lembrete,
transbordo humano), implanta a stack e gera o material de venda do módulo.
*Use quando:* "implanta o WhatsApp do dr X".

**`/catalogo-carros`** — Pra lojas de carros: catálogo de veículos com
estoque em planilha ou painel + site conectado (carro vendido some sozinho),
SEO automotivo local e manual do lojista. *Use quando:* "site da loja X".

**`/diagnostico-sistemas`** — Pra empresas médias e grandes: entrevista de
descoberta de processos, mapa de gargalos priorizado por custo e proposta
técnica de integração (CRM, automações) em fases. *Use quando:* "mapeia os
processos da empresa X".

---

## 4. As aplicações do painel

Abrindo `http://localhost:7777`:

**Hoje (dashboard)** — Tela inicial com foco do dia, prioridades (vindas
da `_memoria/estrategia.md`) e ações rápidas.

**Chat** — Conversa com o Claude Code direto do navegador, com streaming
de resposta e upload de anexos. É o motor do sistema com interface visual.

**Memória** — Editor da `_memoria/` no navegador, em 3 painéis: negócio,
tom de voz e estratégia. Editou, salvou, o sistema já pensa diferente.

**Identidade** — Editor do `identidade/design-guide.md` (cores, fontes,
logo, padrão visual). O que estiver aqui vale pra tudo que o sistema gera.

**Skills** — Catálogo visual das 16 skills com modais de execução: vê o
que cada uma faz e dispara dali mesmo.

**Biblioteca** — Tudo que o sistema produziu (`marketing/`, `saidas/`),
com preview de carrosséis em lightbox.

**Editor de slides** — Edição inline de slide individual com proteção
contra reescrita acidental dos irmãos. É aqui que mora o botão
**Renderizar**, que transforma os HTMLs do `/carrossel` em PNGs (Playwright
headless no servidor, runtime em `.mazyui-runtime/`).

**Controles do sistema** — Na topbar: reiniciar o servidor (necessário
depois de editar `local-*`) e desligar o painel.

---

## 5. Estendendo o sistema (sem quebrar update)

Feature nova de UI ou servidor **nunca** vai nos arquivos do motor
(`mazyui-server.mjs`, `mazyui-ui.*`) — o `/atualizar-sistema` sobrescreve
eles e a feature morre. Os canais certos:

- **Endpoint novo** → `local-routes.mjs` (via `register({ helpers, addRoute })`)
- **Painel novo na UI** → `local-ui.js` (via `window.Sabec.registerPanel(def)`)
- **Cores/fontes do painel** → `local-ui.css` (só override cosmético)
- **Marca** → `brand.config.js`

Regras completas e exemplos de código no `CLAUDE.md` (seção "Extensões
locais por cliente"). Editou `local-*`? Reinicia o servidor pelo botão da
topbar.

---

## 6. Mantendo o sistema vivo

| O quê | Skill | Toca em quê |
|---|---|---|
| Atualizar a **memória** (contexto do negócio) | `/atualizar` | `_memoria/`, `CLAUDE.md`, `identidade/` |
| Atualizar o **motor** (servidor, UI, skills) | `/atualizar-sistema` | arquivos de sistema, nunca os teus dados |
| Backup no GitHub | `/salvar` | commit + push de tudo |

O `CLAUDE.md` termina com `---`: tudo que você adicionar **abaixo** desse
separador é teu e sobrevive a qualquer update.

---

## 7. Créditos

O EméritoOS é mantido por Aldo Freitas, construído sobre:

- **[MazyOS](https://github.com/mazzeoia/MazyOS)** — Vagner Mazzeo, o
  sistema original (estrutura, memória, skills).
- **[MazyUI](https://github.com/DiogoSabec/MazyUI)** — Diogo Sabec, o
  painel web local (fork público do MazyOS).
