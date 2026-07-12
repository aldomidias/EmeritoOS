---
name: relatorio-cliente
description: >
  Gera o relatório mensal de crescimento de um cliente da recorrência: evolução no
  Google (GMB e busca), Instagram, site e anúncios, com leitura executiva e o plano do
  mês seguinte. Use quando o usuário disser "relatório do dr X", "fecha o mês do
  cliente Y", "relatórios da recorrência" ou /relatorio-cliente.
---

# /relatorio-cliente — O motor da recorrência

A oferta de Crescimento mensal só escala se o relatório não for gargalo.
Essa skill fecha o mês de um cliente em minutos: dados → leitura → plano.

## Entrada

Slug do cliente + os dados do mês, no que existir:
- Exports/prints de GMB (visualizações, ligações, rotas), Instagram
  (alcance, seguidores, posts), Google Analytics/Search Console, Ads
- Soltar os arquivos em `clientes/<slug>/relatorios/<AAAA-MM>/dados/`
- O que não tiver export, a skill pergunta os 3 números que importam e segue

## Estrutura do relatório (na língua do cliente, não de marketeiro)

1. **O mês em uma frase** — a manchete (ex: "você apareceu pra 2x mais
   gente no Google que em janeiro")
2. **Os números que importam** — 4 a 6 KPIs com comparação ao mês anterior,
   sempre traduzidos em negócio (ligações, direções traçadas, WhatsApp
   iniciado, agendamento), não em métrica de vaidade
3. **O que fizemos** — entregas do mês em lista curta
4. **O que aprendemos** — 2 a 3 leituras (que conteúdo puxou, que canal trouxe)
5. **Plano do próximo mês** — 3 a 5 ações concretas com o porquê
6. **Alerta honesto** (quando houver) — o que caiu e o que vamos fazer

## Saída

- `clientes/<slug>/relatorios/<AAAA-MM>/relatorio.md` + versão HTML na
  identidade do cliente (imprimível/enviável por WhatsApp)
- Mensagem curta de envio no tom do Aldo
- Atualizar `clientes/<slug>/CHECKLIST.md` com o plano do mês aprovado

## Rodar em lote

`/relatorio-cliente todos` fecha o mês da carteira inteira: itera as pastas
de `clientes/` que têm recorrência ativa (marcada no CHECKLIST.md), gera os
relatórios pendentes e lista o que falta de dado pra cada um.

## Regras invioláveis

- Honestidade nos números: mês ruim se reporta com plano, não se esconde
- Comparação sempre com o mês anterior E com o início do contrato (a curva longa)
- Zero jargão: "impressões" vira "quantas vezes você apareceu"
- Sem travessão
- Dados de cliente ficam em `clientes/` (privado, fora do git)
