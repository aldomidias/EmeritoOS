---
name: carrossel
description: >
  Cria carrosséis e posts visuais pra Instagram, TikTok, LinkedIn com a identidade visual da marca.
  Gera um arquivo HTML por slide (1080x1350 por padrão) com a copy e a legenda prontas.
  Os PNGs ficam pra depois — o painel do EméritoOS tem botão "Renderizar" que dispara o Playwright
  headless do servidor; a skill só emite HTML, então termina rápido.
  Suporta carrossel texto puro, carrossel com foto IA (gerada via OpenAI) e post único.
  Use quando o usuário pedir "carrossel", "post", "conteúdo pro instagram", "criar imagem",
  "gerar foto", "post educativo", ou /carrossel.
---

# /carrossel — Carrossel e posts visuais

Skill central de criação de conteúdo visual. Pega um tema → entrega HTMLs estilizados + PNGs prontos pra postar + legenda no padrão da marca.

## Dependências

- **Identidade visual:** `identidade/design-guide.md` — LER ANTES de criar qualquer visual
- **Contexto do negócio:** `_memoria/empresa.md`
- **Tom de voz:** `_memoria/preferencias.md`
- **Renderização PNG:** **não é** responsabilidade dessa skill. O painel do EméritoOS
  (`/api/render-slide` e `/api/render-carrossel`) usa Playwright instalado
  em `.mazyui-runtime/` pra gerar PNGs sob demanda quando o usuário clicar "Renderizar"
- **OpenAI API (opcional):** pra gerar fotos realistas — só se o cliente tiver chave configurada
- **Outputs vão em:** `marketing/conteudo/<tipo>-<tema>-<YYYY-MM-DD>/`

---

## Tipos de conteúdo

Ao receber um pedido, identificar qual tipo se encaixa:

### 1. CARROSSEL TEXTO PURO
- **Quando usar:** posts educacionais, dicas, listas, explicações
- **Estilo:** tipografia clean, cores da marca alternadas, sem fotos

### 2. CARROSSEL COM FOTO
- **Quando usar:** apresentação visual, conteúdo aspiracional, capa com personagem
- **Estilo:** foto como capa com gradient overlay + slides internos no padrão alternado
- **Foto:** pode ser IA (gerada por OpenAI) ou real (passada pelo usuário)

### 3. POST ÚNICO
- **Quando usar:** frase de impacto, dado/estatística, depoimento, bastidores
- **Estilo:** varia conforme o conteúdo (citação, número grande, foto com overlay)

Se o tipo não estiver claro, perguntar:
> "Que tipo de conteúdo? (1) carrossel texto, (2) carrossel com foto, (3) post único"

---

## Formatos / aspect ratios

Cada peça é renderizada num **canvas** de dimensões específicas. O formato afeta o `width`/`height` de cada `.slide` no HTML, o viewport do Playwright e a pasta de saída. Sempre confirmar o formato antes de codar — não dá pra "redimensionar depois" sem retrabalhar layout.

| Nome              | Ratio    | Dimensões (px) | Pasta de saída   | Onde usar                                |
|-------------------|----------|----------------|------------------|------------------------------------------|
| **Feed retrato**  | 4:5      | 1080×1350      | `instagram/`     | IG/FB feed — padrão (maior área visual)  |
| **Feed quadrado** | 1:1      | 1080×1080      | `instagram/`     | IG/FB/LinkedIn feed quando preferir 1:1  |
| **Stories/Reels** | 9:16     | 1080×1920      | `stories/`       | IG/FB Stories, Reels, TikTok             |
| **Horizontal**    | 16:9     | 1920×1080      | `horizontal/`    | LinkedIn imagem larga, YouTube, X        |
| **Pinterest**     | 2:3      | 1080×1620      | `pinterest/`     | Pin padrão Pinterest                     |
| **Vertical leve** | 3:4      | 1080×1440      | `vertical/`      | Entre feed retrato e Pinterest           |
| **Link card**     | 1.91:1   | 1200×628       | `link-card/`     | OG image, FB/LinkedIn link preview       |
| **Clássico**      | 4:3      | 1440×1080      | `classico/`      | Apresentação, slide deck, banner antigo  |

**Default:** `4:5` (Feed retrato). Se o usuário não disser nada, usar esse — é o que mais converte no feed do Instagram.

**Pedido com múltiplos formatos.** Se o usuário pedir "carrossel pro feed e pro stories", gerar **dois conjuntos** de PNGs (cada um na pasta correspondente). O mais seguro é um arquivo HTML por formato (`carrossel-feed.html`, `carrossel-stories.html`) — controla layout sem brigar com media queries.

### Regra de consistência entre formatos (CRÍTICA)

Quando o usuário pedir múltiplos formatos, **o PRIMEIRO formato listado é o MESTRE**. Todos os outros derivam dele, não são versões independentes.

Quando o prompt vier no padrão da UI (`Formato principal: ...` + `Gerar também em: ...`), o "principal" é o mestre. Quando o usuário listar livremente ("carrossel pro feed, stories e LinkedIn"), o primeiro mencionado é o mestre.

**O que precisa ser idêntico entre todas as versões:**
- **Mesma copy palavra por palavra** — título de capa, textos internos, CTA final, eyebrow/kicker. Não reescrever pra "caber melhor" no formato diferente; ajustar o layout, não o texto.
- **Mesma quantidade e ordem de slides** — slide 1 do feed = slide 1 do stories = mesmo conteúdo.
- **Mesmas fotos** (se carrossel tipo 2) — a foto IA gerada vale pra todos os formatos. Não regerar foto pra cada aspect ratio.
- **Mesma paleta, mesma fonte, mesmos elementos visuais** (régua, stamps, page counter, logo)
- **Mesmo layout nomeado por slide** (CAPA, SOLO, DUO, NÚMERO, CITAÇÃO, CTA FINAL) — se o slide 3 é NÚMERO no feed, é NÚMERO no stories também.

**O que MUDA entre formatos (só o necessário pra caber):**
- Dimensões do `.slide` (width/height) e do viewport do Playwright
- Tamanhos de fonte de acordo com a tabela "Adaptação de layout por formato" acima
- Padding/spacing (ex.: 9:16 ganha padding vertical maior, 1:1 perde)
- Zona segura inferior (~250px) só no 9:16
- Em 16:9 e 1.91:1: se o layout original tem foto+texto empilhados, virar side-by-side
- Décor secundário (stamp, watermark grande) pode encolher ou sumir em formatos apertados (1:1, 1.91:1) — mas o conteúdo central é o mesmo

**Fluxo de execução com múltiplos formatos:**
1. Escrever a copy UMA VEZ no Passo 2, validar com checkpoint, e usar exatamente essa copy em todos os HTMLs.
2. Gerar foto(s) UMA VEZ no Passo 3 (se aplicável) — reutilizar os mesmos arquivos `foto-*.png` em todos os HTMLs.
3. Criar o HTML do **formato mestre primeiro, sequencialmente e com cuidado**: estrutura cada slide, escolhe layouts nomeados, valida hierarquia tipográfica, renderiza e revisa. Esse passo NÃO paraleliza — é onde o estilo da peça é decidido.
4. **Disparar agentes em paralelo pros formatos derivados.** Depois que o mestre estiver renderizado e validado, lançar UM agente por formato adicional **numa única mensagem com múltiplas chamadas do Agent tool em paralelo** (subagent_type `general-purpose`). Cada agente recebe: caminho do HTML mestre, formato alvo (dimensões + nome da pasta), regras de adaptação da tabela "Adaptação de layout por formato", a copy aprovada, e a instrução de copiar+adaptar o HTML mestre, escrever `carrossel-<formato>.html` na mesma pasta, e renderizar os PNGs na subpasta correspondente. Os agentes NÃO reescrevem copy nem regeram foto — só adaptam dimensões, fonts, padding e décor.
5. Aguardar todos os agentes terminarem e mostrar pro usuário só depois que tudo estiver renderizado.

**Quando NÃO paralelizar:**
- Quando há só um formato (não tem o que paralelizar).
- Quando o mestre ainda não foi aprovado/renderizado — agentes precisam do mestre como base.
- Quando o usuário pediu explicitamente pra revisar formato por formato antes do próximo.

Se notar durante a execução que um slide específico não cabe em um formato sem cortar copy, **não corte a copy**: ajuste o layout (encolher fonte do título, reduzir padding, etc.). Se realmente não couber de jeito nenhum, avisar o usuário antes de comprometer a consistência.

### Adaptação de layout por formato

- **4:5 (padrão):** layouts originais funcionam sem ajuste — título de capa 90-100px, internos 60-72px
- **1:1:** menos altura útil. Reduzir título de capa pra 70-80px, encurtar copy. Stamps e décor secundário podem sumir. Padding vertical 70-90px
- **9:16:** muito espaço vertical. Empilhar mais elementos com folga (eyebrow + título + régua + subtítulo + @handle). Título pode crescer pra 110-130px. Padding lateral 80-100px, padding vertical 140-180px. **Reservar zona segura inferior (~250px)** pra não ficar atrás do UI do Instagram (botões "Enviar mensagem", barra de progresso, etc.)
- **16:9:** horizontal. Favorecer layouts `SOLO` (imagem 50% + texto 50%) ou compositions side-by-side. Título 80-100px. Menos slides — geralmente 3-5, não 7-10. Capa + 2-3 internos + CTA é o padrão; carrossel longo em 16:9 raramente faz sentido (LinkedIn corta)
- **2:3 (Pinterest):** quase tão vertical quanto 9:16 mas com proporção típica de pin. Título 90-110px, padding lateral 60-80px, padding vertical 80-120px. Sem zona segura específica — Pinterest mostra a peça inteira no feed
- **3:4:** intermediário entre 4:5 e 1:1. Usar como fallback "neutro" quando o usuário não souber. Título 80-90px na capa, padding 60-80px
- **1.91:1 (link card):** muito horizontal e raso. Geralmente UM slide só (OG image, capa de blog). Título 70-90px alinhado à esquerda + logo + URL. Não usar como carrossel — perde sentido
- **4:3:** horizontal moderado. Bom pra slide deck/apresentação. Título 80-100px, layouts SOLO/DUO ainda funcionam mas com menos folga lateral que 16:9

### CSS de cada `.slide`

```css
.slide { width: 1080px; height: 1350px; }  /* 4:5  — feed retrato */
/* .slide { width: 1080px; height: 1080px; } */  /* 1:1  — feed quadrado */
/* .slide { width: 1080px; height: 1920px; } */  /* 9:16 — stories/reels */
/* .slide { width: 1920px; height: 1080px; } */  /* 16:9 — horizontal */
/* .slide { width: 1080px; height: 1620px; } */  /* 2:3  — pinterest */
/* .slide { width: 1080px; height: 1440px; } */  /* 3:4  — vertical leve */
/* .slide { width: 1200px; height: 628px; }  */  /* 1.91:1 — link card */
/* .slide { width: 1440px; height: 1080px; } */  /* 4:3  — clássico */
```

### `render.js` por formato

```js
// 1 formato:
const SLIDE_W = 1080, SLIDE_H = 1350; // ajustar pro formato escolhido
await page.setViewportSize({ width: SLIDE_W, height: SLIDE_H });
// screenshot por slide com clip { x:0, y:0, width: SLIDE_W, height: SLIDE_H }

// Múltiplos formatos: iterar por
// [{ w:1080, h:1350, dir:'instagram', html:'carrossel-feed.html' },
//  { w:1080, h:1920, dir:'stories',   html:'carrossel-stories.html' }]
```

---

## Estilo visual base

O EméritoOS tem um estilo próprio — editorial, calmo, premium. Sem clip-art, sem emoji decorativo, sem gradiente arco-íris, sem template genérico de IA. `identidade/design-guide.md` sobrescreve esses padrões; quando o design-guide for vago ou estiver em branco, usar o que tá aqui (não parar pra pedir `/instalar` — o `/carrossel` funciona com defaults bons).

### Tipografia padrão

- **Fonte:** Inter (Google Fonts), pesos 400/500/600/700/800/900
- **Título de capa:** 90-100px, weight 900, line-height 0.98, letter-spacing **-0.04em**
- **H2 (slides internos):** 60-72px, weight 800, line-height 1.04, letter-spacing **-0.035em**
- **Corpo:** 20-24px, weight 500, line-height 1.5
- **Eyebrow/kicker:** 13-16px, weight 700-800, **UPPERCASE**, letter-spacing **0.22-0.32em**, cor de destaque
- **Page counter (canto sup. dir.):** 14-16px, weight 500-600, letter-spacing 0.18em, cor muted
- **Meta/handle (@):** 15-18px, weight 600

Regra do tipo: títulos grandes com kerning **apertado** (-0.035em), eyebrows pequenos com kerning **aberto** (0.22em+). Esse contraste é o coração do estilo.

### Cores padrão (quando design-guide for vago)

Paleta sóbria: fundo dark + off-white + **UMA** cor de destaque. Nunca quatro cores brigando.

- Fundo escuro: `#0E1116` ou `#1A1A1A`
- Fundo claro alternativo: `#F5ECD7` (cream) ou `#FAFAF7`
- Texto sobre escuro: `#FAFAF7`
- Texto sobre claro: `#1A1A1A` (h2) e `#444` (corpo)
- Destaque: cor da marca (uma só)

### Elementos visuais recorrentes

- **Régua fina** (3-4px de altura, 60-80px de largura, cor de destaque) entre kicker e h2 ou como divisor
- **Logo top-left + page counter top-right** em todos os slides
- **Border-top 1px** `rgba(255,255,255,0.12)` separando rodapé do conteúdo (em slides escuros)
- **Stamps circulares** (200x200, border 3px translúcida, rotate -10deg) pra selos/datas/dados
- **Tags/pills** uppercase, padding generoso, kerning 0.2em, pra rotular categoria do slide
- Padding base: 70-100px nas laterais

### Layouts nomeados

Vocabulário de layout — cada slide tem um nome. Variar entre eles pra criar ritmo:

- **CAPA** — eyebrow + título grande + subtítulo + @handle. Fundo: foto com gradient overlay (`rgba(12,10,9,0.55)` → `rgba(12,10,9,0.85)`) OU sólido (escuro/claro/destaque)
- **SOLO** — split horizontal: foto à esquerda 50% + texto à direita 50% (kicker + h2 + régua + parágrafo)
- **DUO** — texto em cima (kicker + h2 + régua + p) + 2 fotos lado a lado embaixo (ou 1 foto larga)
- **NÚMERO** — numeral gigante (200-320px, weight 800, cor de destaque) como elemento gráfico + h2 + parágrafo de apoio
- **CITAÇÃO** — aspas grandes em watermark + frase em h2 + atribuição
- **CTA FINAL** — fundo na cor de destaque, logo centralizado, headline curta, botão/CTA, telefone/@handle

**Ritmo de slide a slide:** alternar fundo escuro ↔ claro ↔ destaque. Nunca dois slides seguidos com o mesmo fundo.

---

## Padrão do carrossel

**Estrutura base (5 a 10 slides):**
- **Slide 1:** layout `CAPA`
- **Slides internos:** usar 2-3 layouts diferentes entre `SOLO` / `DUO` / `NÚMERO` / `CITAÇÃO`
- **Slide final:** layout `CTA FINAL`

Antes de criar HTML: ler `identidade/design-guide.md`. Se estiver em branco, usar o "Estilo visual base" acima como default.

### Sequência de capas no feed (planejamento de grade)

Antes de definir a capa, considerar a **última capa publicada** pra alternar:
- claro → próxima é foto/escuro
- foto/escuro → próxima é cor da marca
- cor da marca → próxima é claro
- nunca duas capas iguais em sequência

Se o usuário não souber qual foi a última, perguntar.

### Linguagem (regra crítica)

Seguir `_memoria/preferencias.md`. Em geral: frases naturais, sem jargão de marketing, sem corporativês. O público real raramente fala "ticket médio", "performance", "B2B". Falar como ele fala.

### Legenda — sempre gerar junto

Ao terminar de renderizar os PNGs, gerar **automaticamente** a legenda do post e salvar em `legenda.md` na mesma pasta. **Não esperar o usuário pedir.** Estrutura padrão:

1. Hook (pergunta ou afirmação)
2. Contexto (1-2 frases sobre o conteúdo)
3. CTA pra arrastar ("Arraste pro lado e confere")
4. Bloco de oferta (diferenciais da empresa, contato)
5. Hashtags (10-15 — público + nicho + local se aplicável)

---

## Workflow

### Passo 1 — Entender e planejar

1. Ler `_memoria/preferencias.md` e `_memoria/empresa.md`
2. Ler `identidade/design-guide.md` pra cores, fontes e logo
3. Identificar o tipo de conteúdo (1, 2 ou 3)
4. Identificar o(s) formato(s) — ver tabela "Formatos / aspect ratios". Default `4:5` se nada for dito
5. Definir o tema e o ângulo

### Passo 2 — Texto

Escrever o conteúdo seguindo as regras de tom:

**Pra carrossel (5-10 slides):**
- Slide 1 (Capa): título impactante, máx 8 palavras. Oferecer 3 opções
- Slides internos: um insight por slide, frases naturais, sem bullet points
- Slide final: CTA + logo

**Pra post único:**
- Frase principal em destaque
- Contexto de apoio (se necessário)
- CTA sutil

**CHECKPOINT:** Mostrar o texto completo. Esperar aprovação antes do visual.

### Passo 3 — Gerar fotos (se tipo 2)

Só se o usuário pediu carrossel com foto IA.

1. Montar prompt em inglês (a API funciona melhor em inglês)
2. Padrão genérico de prompt:

```
Professional [TIPO] photography of [ASSUNTO],
[DETALHES], [AMBIENTE/CONTEXTO],
[ESTILO DE LUZ] lighting, shallow depth of field,
shot from [ÂNGULO], [ESTILO/ESTÉTICA],
editorial quality
```

3. Gerar via script (se `scripts/gerar-imagem.js` existir):
```bash
node --env-file=.env scripts/gerar-imagem.js "PROMPT" "marketing/conteudo/<pasta>/foto-<nome>.png"
```

Se não tiver o script ainda, instruir o usuário a configurar `OPENAI_API_KEY` no `.env` e criar o script (ou usar outra ferramenta de geração de imagem).

4. Mostrar a foto pro usuário antes de continuar.

**CHECKPOINT:** Foto aprovada → seguir. Se não, ajustar prompt e regenerar.

### Passo 4 — Criar visuais (HTML por slide)

**Princípio:** cada slide vira **um arquivo HTML independente** (`slide-01.html`, `slide-02.html`, …) dentro da pasta do formato (`instagram/`, `stories/`, etc). Isso faz a UI carregar/atualizar o preview em milissegundos (DOM-level, sem regenerar PNG) e dá ao botão "Editar slide" do lightbox um alvo trivial (mexer só num arquivo).

PNG NÃO é responsabilidade dessa skill — o painel do EméritoOS tem um botão "Renderizar PNG" que dispara `/api/render-slide` (Playwright headless já instalado em `.mazyui-runtime/`). A skill foca em emitir HTML válido e bonito.

1. **Formato mestre primeiro (sequencial, com cuidado).** Pra cada slide do mestre, criar um arquivo `marketing/conteudo/<pasta>/<formato>/slide-NN.html` (`slide-01.html`, `slide-02.html`, ...). Cada HTML é **autocontido**: inline CSS, Google Fonts via `<link>` no head (única dependência externa), referência a fotos por path relativo (`../foto-x.png` ou `foto-x.png` se a foto estiver dentro da pasta do formato). Aplicar:
   - Dimensões do `.slide` conforme o formato escolhido (ver "Formatos / aspect ratios"). O elemento raiz **precisa** ser `<div class="slide" style="width:Xpx;height:Ypx;…">` — o renderizador detecta `.slide` e screenshota ele.
   - Cores e tipografia de `identidade/design-guide.md`
   - Mínimo 2 layouts diferentes ao longo do carrossel (não repetir o mesmo em todos os slides)
   - Logo top-left + slide-counter top-right em todos os slides
   - Slide final: logo + CTA, fundo na cor principal
   - Em 9:16, deixar zona segura inferior (~250px) livre de copy/CTA crítico

   Estrutura recomendada de cada arquivo:

   ```html
   <!doctype html>
   <html lang="pt-BR">
   <head>
     <meta charset="utf-8">
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
     <style>
       html, body { margin:0; padding:0; background:#fff; }
       .slide { width:1080px; height:1350px; box-sizing:border-box;
         font-family:'Inter',system-ui,sans-serif; position:relative;
         overflow:hidden; }
       /* ... estilos do slide ... */
     </style>
   </head>
   <body>
     <div class="slide" style="background:#0E1116; color:#FAFAF7;">
       <!-- conteúdo do slide -->
     </div>
   </body>
   </html>
   ```

   **Por que um arquivo por slide?**
   - Editar um slide pela UI mexe num único arquivo (snapshot/restore protege os irmãos).
   - Renderizar um slide é instantâneo (`/api/render-slide` carrega só esse HTML).
   - A UI pode mostrar HTMLs lado a lado sem precisar parsear um arquivo gigante.
   - Quebra menos quando o Claude faz uma edição parcial (não tem como pegar `</body>` errado).

2. **Opcional — `carrossel.html` combinado.** Pode (mas não precisa) gerar também um arquivo `carrossel.html` na raiz da pasta do item, agregando todos os slides com `<div class="slide">` em sequência (útil pra preview rápido fora do painel). Se gerar, é cópia visual — fonte de verdade são os `slide-NN.html` individuais.

   Renderizar e validar o mestre antes de tocar nos derivados.

1.b. **Formatos derivados em paralelo (se houver mais de um formato).** Numa única mensagem, disparar várias chamadas do `Agent` tool (subagent_type `general-purpose`) — uma por formato adicional. Briefing por agente:
   - Caminhos dos HTMLs mestre já validados (ler todos os `slide-NN.html` da pasta do formato mestre com `Read`)
   - Formato alvo: nome, dimensões em px, pasta de saída
   - Trechos relevantes de "Adaptação de layout por formato" pra esse aspect ratio
   - Copy aprovada literal (não reescrever)
   - Lista de fotos a reutilizar (não regerar)
   - Tarefas: (a) escrever um arquivo `slide-NN.html` por slide na pasta `<pasta-do-formato>/` (ex: `stories/slide-01.html`), partindo do mestre correspondente; (b) ajustar `.slide` width/height, fontes, padding e décor conforme a tabela; (c) retornar lista de arquivos criados. **NÃO gerar PNG** — a UI faz isso via botão "Renderizar tudo" quando o usuário pedir.
   - Restrições: não alterar copy, não regerar foto IA, não mudar a ordem nem a quantidade de slides, não trocar layout nomeado de nenhum slide.

   Esperar todos os agentes terminarem antes do passo 3.

   **Pra incluir foto IA no HTML:**
   ```html
   <div class="slide" style="
     background-image: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.7)), url('foto-xxx.png');
     background-size: cover;
     background-position: center;
   ">
     <div class="content">
       <h2>Texto sobre a foto</h2>
     </div>
   </div>
   ```

2. **Renderização de PNG é responsabilidade do painel.** Não criar `render.js` nessa pasta nem rodar Playwright. Quando o usuário abrir o post no painel e clicar "Renderizar tudo" (ou "Renderizar slide"), o servidor (`/api/render-slide` / `/api/render-carrossel`) chama o Playwright pré-instalado em `.mazyui-runtime/`. Isso descarrega o trabalho lento da skill — o `/carrossel` termina quando os HTMLs estão prontos.

   Se o usuário pedir explicitamente os PNGs gerados pela skill (sem abrir o painel), pode chamar o endpoint via `curl`:
   ```bash
   curl -s -X POST http://localhost:7777/api/render-carrossel \
     -H 'Content-Type: application/json' \
     -d '{"name":"<nome-do-item>"}'
   ```

3. Mostrar slide 1, 2 e o CTA final pro usuário (pode ser via abrir os HTMLs, ou avisar que estão prontos pra preview no painel). Se aprovado, mostrar os intermediários.

### Passo 5 — Salvar e organizar

```
marketing/conteudo/<tipo>-<tema>-<YYYY-MM-DD>/
  texto.md                       ← texto aprovado + legenda
  foto-<nome>.png                ← fotos geradas por IA (se houver)
  carrossel.html                 ← opcional: combinado de preview
  instagram/                     ← 4:5 (1080×1350) — formato mestre default
    slide-01.html                ← fonte de verdade, editável pela UI
    slide-01.png                 ← gerado on-demand pelo botão "Renderizar"
    slide-02.html
    slide-02.png
    …
  stories/                       ← 9:16 (1080×1920) — se pedido
    slide-01.html
    slide-01.png
    …
  horizontal/                    ← 16:9 (1920×1080) — se pedido
    slide-01.html
    slide-01.png
    …
  legenda.md                     ← legenda Insta+FB
  legenda-linkedin.md            ← (se pedido, mais formal)
```

Os arquivos `.png` aparecem só depois que o usuário clica "Renderizar" no painel (ou roda o endpoint via `curl`). Antes disso a UI mostra o slide diretamente do HTML, num iframe — então o preview já é editável e visível sem PNG.

### Passo 6 — Conexão com blog (opcional)

Depois de criar o conteúdo visual, perguntar:

> "Esse conteúdo dá pra virar artigo no blog também. Quer que eu crie a versão blog pra SEO?"

Se sim, chamar `/publicar-tema` com o mesmo tema.

---

## Regras

- Sempre ler `identidade/design-guide.md` antes de criar qualquer visual
- Formato default é **4:5 (1080×1350)** — feed retrato. Outros formatos só quando o usuário pedir (1:1, 9:16, 16:9). Ver tabela "Formatos / aspect ratios" pra dimensões, pasta de saída e regras de adaptação de layout
- **Múltiplos formatos = mesma peça em proporções diferentes.** O primeiro formato (principal) é o mestre: copy, fotos, slides e layout nomeado de cada slide são idênticos entre todos. Só dimensões, fontes e padding mudam pra caber. Ver "Regra de consistência entre formatos"
- **Múltiplos formatos = paralelizar os derivados.** Mestre é feito sequencialmente, com cuidado, e validado. Só depois disparar agentes em paralelo (uma única mensagem com várias chamadas do `Agent` tool, subagent_type `general-purpose`) — um agente por formato adicional, recebendo o HTML mestre + regras de adaptação. Cada agente escreve só os `slide-NN.html` na pasta correspondente — **nunca PNGs**, renderização é responsabilidade do painel. Esperar todos terminarem antes de mostrar pro usuário.
- Linguagem segue `_memoria/preferencias.md` estritamente
- Sempre considerar a sequência de capa no feed antes de definir capa nova
- Sempre gerar legenda automaticamente ao final, salvando em `legenda.md`
- Fotos IA: sempre pedir aprovação antes de usar no carrossel
- Fotos IA: prompts em inglês
- Fotos IA: nunca gerar fotos de pessoas/rostos identificáveis
- HTMLs: **um arquivo por slide** (`<pasta-do-formato>/slide-NN.html`), autocontido, inline CSS. Elemento raiz `<div class="slide" style="width:Xpx;height:Ypx">…</div>`. PNGs são gerados sob demanda pelo painel — a skill **não roda Playwright**.
- Não repetir layout entre slides — usar variação visual
