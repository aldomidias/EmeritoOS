---
name: pipeline
description: >
  CRM de leads da prospecção: mostra o funil, diz quem esfriou, qual o follow-up do dia
  e registra cada movimento (DM enviada, call marcada, proposta na mesa). Use quando o
  usuário disser "pipeline", "como tá o funil", "quem eu cobro hoje", "follow-ups de
  hoje", "registra que o lead X respondeu" ou /pipeline.
---

# /pipeline — Funil de leads vivo

Nada esfria por esquecimento. Cada lead tem estágio, próxima ação e data;
essa skill lê, atualiza e cobra.

## Onde moram os dados (PRIVADO, nunca versionar)

- `_privado/pipeline.md` → o funil (uma linha por lead)
- `_privado/leads/<slug>.md` → histórico de conversa de cada lead

Se o Aldo já mantém pipeline em outro lugar (ex: `../prospeccao/pipeline.md`
no workspace aldoMídias), perguntar UMA vez qual usar e registrar a escolha
em `_memoria/empresa.md`. Nunca manter dois pipelines.

## Formato do pipeline.md

| Lead | Nicho | Estágio | Próxima ação | Data | Fonte |
|---|---|---|---|---|---|

Estágios (jornada da /prospeccao): 1-mapeado · 2-abordado · 3-respondeu ·
4-qualificado · 5-call marcada · 6-proposta enviada · 7-fechado (ou perdido/motivo).

## O que a skill faz

### `/pipeline` (sem argumento) — o painel do dia
1. **Follow-ups vencidos** — leads com data de próxima ação até hoje, mais urgente primeiro
2. **Esfriando** — leads sem movimento há mais de 5 dias (3 dias se estágio ≥ 5)
3. **Retrato do funil** — contagem por estágio + taxa de conversão call → fechamento
4. Pra cada item, sugerir a ação: qual DM/mensagem mandar (redigir via /prospeccao)

### `/pipeline <lead> <o que aconteceu>` — registrar movimento
Atualizar a linha do lead (estágio, próxima ação, data) e acrescentar o
evento no histórico `_privado/leads/<slug>.md` com data. Movimento que
avança estágio ≥ 5 merece parabéns curto, sem firula.

### Regras de cadência (padrão, ajustável em `_memoria/`)
- Lead abordado sem resposta → re-abordar em 4 dias, máx. 2 vezes, depois pausar 30 dias
- Proposta enviada → follow-up em 3 dias úteis
- Call marcada → confirmar 1 dia antes
- Perdido NUNCA se apaga: registra motivo e volta pra nutrição de conteúdo

## Integração com as outras skills

- `/prospeccao` redige as DMs; o /pipeline diz PRA QUEM e QUANDO
- `/diagnostico` e `/proposta` registram automaticamente seus eventos aqui
- No painel web, este funil pode virar um painel visual via `local-ui.js`
  (pedir "cria o painel do pipeline" pra gerar)

## Regras invioláveis

- Dados de lead são privados: moram só em `_privado/` (gitignored)
- Sem travessão nas mensagens gerada
- Nunca sair de negociação sem oferecer um degrau da esteira (`_privado/ofertas.md`)
