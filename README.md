# EméritoOS

> O sistema operacional do seu negócio dentro do Claude Code —
> com painel web local incluso.

Você acaba de instalar o EméritoOS. Em alguns minutos, sua empresa vai
ter uma memória própria, uma identidade visual aplicada em tudo que
o sistema gerar, 29 skills prontas — 16 de operação (marketing, SEO,
ads, produção) e 13 do pacote agência (prospecção, diagnóstico, proposta,
pipeline, entrega e recorrência) — e um painel visual em
`http://localhost:7777` pra operar tudo pelo navegador.

Guia completo de uso (cada skill e cada aplicação): **[TUTORIAL.md](TUTORIAL.md)**

Bora voar.

---

## Instalação no VS Code — passo a passo

Feito pra quem nunca instalou nada disso. Uns 15 minutos, uma vez só.

### Passo 1 — Instalar o VS Code

Baixa em [code.visualstudio.com](https://code.visualstudio.com), instala
como qualquer programa (avançar, avançar, concluir).

### Passo 2 — Instalar o Node.js

Baixa a versão **LTS** em [nodejs.org](https://nodejs.org) e instala do
mesmo jeito. É o motor que faz o painel funcionar.

### Passo 3 — Baixar o EméritoOS

Nesta página do GitHub, clica no botão verde **`<> Code`** →
**Download ZIP**. Descompacta o arquivo e move a pasta pra um lugar fixo
(ex: Documentos). Se preferir git: `git clone https://github.com/aldomidias/EmeritoOS.git`

### Passo 4 — Abrir a pasta no VS Code

Abre o VS Code → menu **File (Arquivo)** → **Open Folder (Abrir Pasta)** →
escolhe a pasta do EméritoOS. Se aparecer a pergunta de confiança, clica
em **"Yes, I trust the authors"**.

### Passo 5 — Instalar o Claude Code

No VS Code, abre o terminal integrado: menu **Terminal** → **New Terminal**
(ou atalho `Ctrl + '` no Windows, `Cmd + '` no Mac). Cola e dá Enter:

```
npm install -g @anthropic-ai/claude-code
```

### Passo 6 — Entrar na sua conta Claude

No mesmo terminal, digita:

```
claude
```

Na primeira vez ele abre o navegador pra você entrar na sua conta
(plano Pro ou Max da Anthropic). Faz o login e volta pro VS Code.

### Passo 7 — Ligar o sistema

Ainda dentro do Claude, digita:

```
/instalar
```

O sistema te entrevista sobre o seu negócio (o que faz, como fala, o que
tá em foco) e monta a memória sozinho. Você só responde. Roda uma vez só.

### Passo 8 — Abrir o painel visual (opcional, recomendado)

Na pasta do EméritoOS (fora do VS Code, no Finder/Explorer):

- **Windows:** dois cliques em `Abrir EmeritoOS.bat`
- **macOS:** dois cliques em `Abrir EmeritoOS.command`
  (se o Mac bloquear na primeira vez: abre o terminal do VS Code e roda
  `chmod +x "Abrir EmeritoOS.command"`, depois tenta de novo)

Abre `http://localhost:7777` no navegador: dashboard com foco do dia,
chat com o Claude, editor de memória e identidade, catálogo de skills,
biblioteca de conteúdo e editor de slides.

### Pronto. O dia a dia é assim

Abre o VS Code na pasta → terminal → `claude` → e conversa:

```
/abrir            ← começa o dia (carrega o contexto do negócio)
/carrossel ...    ← pede o que precisar
/salvar           ← guarda tudo no fim
```

O guia completo de cada skill e aplicação tá no [TUTORIAL.md](TUTORIAL.md).

---

Quando o `/instalar` terminar, renomeia a pasta `EméritoOS/` pro nome do teu
negócio (fecha o VS Code, renomeia no Explorer/Finder, abre de novo). A
pasta não fica como "EméritoOS" — ela é o teu negócio agora.

O `/instalar` roda uma vez só. Te entrevista sobre o negócio, monta a
memória e configura o sistema. Depois disso, é só usar.

---

## O sistema

**Núcleo** — o jeito de operar o dia a dia
`/abrir` carrega o contexto antes de cada sessão de trabalho · `/salvar`
faz commit + push no GitHub · `/atualizar` varre o projeto e atualiza
a memória · `/atualizar-sistema` puxa melhorias do motor (servidor, UI,
skills) sem tocar nos teus dados · `/novo-projeto` cria pasta isolada
pra cada cliente ou iniciativa · `/mapear-rotinas` descobre o que você
repete e transforma em skill personalizada.

**Conteúdo e SEO** — vitrine pública da empresa
`/carrossel` cria carrosséis 1080×1350 com identidade da marca (com ou
sem foto IA) · `/publicar-tema` pega um tema e entrega artigo de blog +
carrossel + 3 legendas amarradas · `/seo` roda fluxo completo de 8 passos
(demanda, concorrência, GMB, on-page, conteúdo, ads, monitoramento, GEO)
· `/responder-avaliacoes` escreve respostas humanas pras reviews do
Google · `/aprovar-post` publica blog + Instagram + Facebook num comando.

**Anúncios pagos** — onde o dinheiro entra
`/anuncio-google` monta a campanha inteira em CSV pronto pra importar
no Google Ads Editor · `/relatorio-ads` lê os exports de Google + Meta
e devolve relatório semanal com alertas e recomendações.

**Produção** — ferramentas do dia a dia
`/analisar-dados` lê CSV/XLSX/PDF e gera resumo executivo ·
`/email-profissional` rascunha email a partir de contexto livre.

**Pacote agência** — o funil e a entrega de quem vende posicionamento
`/diagnostico` varre a presença digital do lead e gera o diagnóstico
gratuito pronto pra call · `/proposta` gera a proposta personalizada com
ancoragem · `/pipeline` é o CRM de leads (follow-ups do dia, funil por
estágio) · `/onboarding-cliente` estrutura cada cliente novo · 
`/posicionamento` roda a entrevista e entrega a narrativa de autoridade ·
`/kit-conteudo` gera 60 dias de conteúdo na voz do cliente ·
`/site-autoridade` monta o site padrão validado com SEO local ·
`/relatorio-cliente` fecha o mês da carteira de recorrência ·
`/atendimento-ia` implanta atendimento 24h no WhatsApp do cliente ·
`/catalogo-carros` cria catálogo + site conectado pra lojas ·
`/diagnostico-sistemas` mapeia processos de empresas e propõe integrações.
(As skills `/conteudo` e `/prospeccao`, com scripts e voz reais, existem
só na instalação local — não são versionadas neste repositório.)

---

## A tese

IA não é uma ferramenta que sua empresa usa. É o sistema operacional em
que ela roda.

A diferença não é velocidade. É capacidade nova — uma pessoa com IA
constrói o que antes exigia time inteiro. Cada processo crítico que hoje
roda em open loop (decide → executa → não mede → repete cego) vira
closed loop dentro do EméritoOS (decide → executa → captura → realimenta →
ajusta sozinho).

O sistema não substitui você. Vira parte da sua empresa.

---

## Como o EméritoOS pensa

`_memoria/` é o cérebro. Tudo que importa do seu negócio mora aqui —
quem é a empresa, como ela fala, o que tá em foco essa semana. O Claude
lê isso antes de cada resposta. Quanto melhor a memória, melhor o sistema.

`identidade/` é o rosto. Cores, fontes, logo, padrão visual. Todo
carrossel, slide, peça que o sistema gera respeita isso.

`marketing/`, `saidas/` e `scripts/` são o resultado. O sistema produz,
versiona no GitHub, fica tudo seu.

---

## O painel

O EméritoOS inclui um painel web 100% local (`http://localhost:7777`) —
navegador como interface, Claude Code como motor. Nenhum dado sai da
máquina além das chamadas que o próprio Claude Code já faz.

- **Hoje** — dashboard com foco do dia e prioridades
- **Chat** — Claude Code no navegador, com streaming e anexos
- **Memória / Identidade** — edita o cérebro e o rosto do sistema
- **Skills** — catálogo com modais de execução
- **Biblioteca** — conteúdo produzido, com preview de carrosséis
- **Editor de slides** — edição individual + botão Renderizar (HTML → PNG)

Extensões próprias entram via `local-routes.mjs` / `local-ui.js` /
`local-ui.css`, sem tocar no motor — sobrevivem ao `/atualizar-sistema`.
Detalhes no [TUTORIAL.md](TUTORIAL.md) e no `CLAUDE.md`.

---

## Créditos e origem

O EméritoOS é mantido por **Aldo Freitas**, construído sobre dois
projetos:

- **[MazyOS](https://github.com/mazzeoia/MazyOS)** de Vagner Mazzeo —
  o sistema original: estrutura de memória, identidade e skills.
- **[MazyUI](https://github.com/DiogoSabec/MazyUI)** de Diogo Sabec —
  o painel web local, fork público do MazyOS.

Este repositório é um fork rebatizado desses projetos. Todo o mérito da
arquitetura é dos autores originais.

## Quando precisar

[emerito.com.br](https://emerito.com.br)
