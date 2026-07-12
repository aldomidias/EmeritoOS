---
name: diagnostico-sistemas
description: >
  Para empresas médias e grandes: roteiro de descoberta que mapeia processos e gargalos
  (comercial em planilha, financeiro em outro sistema, nada conversa), desenha a
  arquitetura de integração (CRM, automações, controles) e gera a proposta técnica.
  Use quando o usuário disser "diagnóstico da empresa X", "mapeia os processos",
  "proposta de integração/CRM" ou /diagnostico-sistemas.
---

# /diagnostico-sistemas — Da bagunça de sistemas à proposta técnica

O mesmo movimento do diagnóstico gratuito do médico, versão empresa:
primeiro entender os processos, depois propor a solução. Nunca o contrário.

## Modo 1: `/diagnostico-sistemas entrevistar <empresa>` — a descoberta

Roteiro da reunião de descoberta (gerar as perguntas ANTES, adaptadas ao
setor da empresa):

1. **O mapa de hoje** — quais sistemas/planilhas existem, quem usa cada um,
   o que entra e sai de cada um (desenhar o fluxo real, não o ideal)
2. **Onde dói** — retrabalho (digitar 2x), informação que se perde entre
   áreas, relatório que leva dias, decisão sem número
3. **O processo crítico** — a jornada que mais importa (lead → venda →
   entrega → cobrança) passo a passo, com os buracos marcados
4. **Gente e resistência** — quem opera, nível técnico, o que já tentaram
   e por que falhou (a resposta define a solução viável)
5. **Restrições** — orçamento de ferramenta/mês, LGPD, sistemas que NÃO
   podem ser trocados (ERP contratado, sistema do franqueador)

Saída: `clientes/<slug>/diagnostico/mapa-atual.md` com o desenho do estado
atual e a lista de gargalos priorizada por custo (tempo × frequência × erro).

## Modo 2: `/diagnostico-sistemas propor <empresa>` — a arquitetura

A partir do mapa, gerar `proposta-tecnica.md` + versão HTML apresentável:

1. **Diagnóstico em 3 achados** — os gargalos que mais custam, em R$ e horas
2. **Arquitetura proposta** — o desenho do estado futuro: qual sistema é a
   fonte da verdade de cada dado, o que se integra com o quê, o que morre
3. **Fases de implantação** — nunca big bang: fase 1 ataca o gargalo mais
   caro em semanas (prova valor), fases seguintes expandem
4. **Stack sugerida** — preferir o que a empresa já paga; completar com
   ferramentas de mercado (CRM, n8n/Make pra automação) e desenvolvimento
   sob medida só onde ferramenta pronta não resolve
5. **Investimento** — implantação por fase + acompanhamento mensal
   (a recorrência também existe aqui)

## Regras invioláveis

- Processo antes de ferramenta: proposta que começa por "vamos comprar o
  CRM X" está errada por construção
- Fase 1 SEMPRE entrega valor visível em até 30 dias
- LGPD desde o desenho (dado pessoal mapeado, acesso por papel)
- Na apresentação comercial vale a regra Emérito: benefício sim, "como"
  detalhado só depois de fechar (a arquitetura completa é a entrega)
- Dados da empresa em `clientes/` (privado, fora do git)
