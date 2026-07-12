---
name: diagnostico
description: >
  Gera o diagnóstico gratuito do Método Emérito pra um lead: varre a presença digital
  dele (Google, site, Instagram, GMB), cruza com o mapa de dores do nicho e entrega um
  relatório pronto pra call, fechando com o degrau certo da esteira. Use quando o
  usuário disser "diagnostico do lead X", "analisa a presença do dr Y", "prepara a call
  com Z" ou /diagnostico.
---

# /diagnostico — Diagnóstico gratuito de presença digital

O diagnóstico é a porta de entrada do Método Emérito: o lead entra achando que
vai receber uma análise, e sai entendendo que tem um problema de posicionamento.
Essa skill transforma o que era manual em processo de minutos.

## Entrada

Nome do profissional + nicho + o que tiver: Instagram, site, cidade. Se só
tiver o nome e a cidade, a pesquisa começa pelo Google mesmo (é o que o
paciente/cliente dele faz).

## Dependências

1. `_memoria/empresa.md` e `_memoria/preferencias.md` → contexto e tom
2. `.claude/skills/conteudo/dores-saude.md` ou `dores-outros.md` (se existirem)
   → dores e vocabulário do nicho, restrições do conselho (CFM, OAB etc.)
3. `_privado/ofertas.md` → régua de ofertas pra recomendação final (NUNCA
   citar preço no relatório; preço é assunto de reunião)

## Passos

### 1. Varredura (como o cliente dele pesquisa)
- Google: "<nome> <especialidade> <cidade>" → o que aparece na primeira página?
  Tem site próprio ou só agregadores (Doctoralia, jusbrasil, etc.)?
- Site (se tiver): primeira impressão, clareza da especialidade, prova de
  autoridade, chamada pra ação, mobile
- Instagram: bio (diz o que ele faz e pra quem?), frequência, tipo de conteúdo,
  presença de rosto vs. genérico
- Google Meu Negócio: existe? Fotos, avaliações, respostas às avaliações?

### 2. Cruzamento com o nicho
Ler a seção do nicho no mapa de dores e identificar quais dores a presença
atual dele CONFIRMA (ex: "quem pesquisa não acha nada sério" se o Google só
mostra agregador).

### 3. Relatório
Gerar `saidas/diagnosticos/<slug-do-lead>/diagnostico.md` com:
- **O que encontramos** — retrato honesto, item por item (Google, site, redes, GMB)
- **O que isso custa** — cada achado traduzido em consequência de negócio,
  na língua do nicho (paciente que não chega, cliente que fecha com concorrente)
- **O caminho** — os 4 blocos do método em linguagem de benefício,
  SEM revelar o "como" (nada de ferramenta, técnica ou passo a passo)
- **Próximo passo** — convite pra conversa

### 4. Preparação da call
Junto com o relatório, gerar `notas-call.md` (só pro Aldo, não vai pro lead):
dores confirmadas, degrau da esteira recomendado (com preço, aqui pode),
objeções prováveis do nicho e âncora de upgrade.

## Regras invioláveis

- Sem travessão em NENHUM texto (vírgula, dois-pontos ou parênteses no lugar)
- Relatório abre na dor, fecha no benefício, nunca revela o meio
- Checar restrições do conselho do nicho antes de qualquer recomendação
- Preço não existe em material que o lead vê
