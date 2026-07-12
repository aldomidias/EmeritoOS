---
name: onboarding-cliente
description: >
  Fechou contrato? Cria a estrutura completa do cliente novo: pasta padrão, checklist
  dos 4 blocos do Método Emérito, briefing de posicionamento pré-preenchido com o que
  já se sabe da call e mensagem de kickoff. Use quando o usuário disser "fechou",
  "cliente novo", "onboarding do dr X", "começa o projeto do Y" ou /onboarding-cliente.
---

# /onboarding-cliente — Do aceite ao projeto rodando

Todo cliente novo começa organizado do mesmo jeito. O que a call e o
diagnóstico já descobriram não se pergunta de novo.

## Entrada

Nome do cliente + nicho + degrau fechado (1 a 5). Puxar automaticamente o
que existir: `saidas/diagnosticos/<slug>/`, `saidas/propostas/<slug>/` e o
histórico em `_privado/leads/<slug>.md`.

## O que a skill cria

```
clientes/<slug>/                     ← gitignored (dado de cliente é privado)
├── BRIEFING.md          ← pré-preenchido com diagnóstico + call; lacunas marcadas [PERGUNTAR]
├── CHECKLIST.md         ← os blocos do método correspondentes ao degrau fechado
├── kickoff.md           ← mensagem de boas-vindas pro WhatsApp do cliente
├── posicionamento/      ← saída do /posicionamento
├── identidade/          ← design guide próprio do cliente
├── site/                ← saída do /site-autoridade
└── conteudo/            ← saída do /kit-conteudo
```

### CHECKLIST.md por degrau

- **Degrau 1 (site avulso):** briefing → site → perfis otimizados → entrega
- **Degrau 2 (Posicionamento 9k):** bloco 1 diagnóstico e posicionamento →
  bloco 2 identidade e narrativa → bloco 3 site + perfis → bloco 4 kit de
  conteúdo (8 a 12 peças / 60 dias)
- **Degrau 3 (Completo 15k):** tudo do 2 + autonomia com IA + anúncios +
  acompanhamento mensal
- Cada item com responsável (Aldo / cliente) e prazo relativo (D+2, D+7...)

### kickoff.md

Mensagem curta no tom do Aldo: o que acontece nas primeiras 48h, o que
precisamos do cliente (fotos, CRM/registro profissional, acessos), e o
primeiro compromisso agendado. Sem travessão, sem juridiquês.

## Depois de criar

1. Atualizar o /pipeline: lead → estágio 7 (fechado), com degrau e data
2. Perguntar se agenda a entrevista de posicionamento (dispara o /posicionamento)
3. Lembrar o Aldo do combinado de recorrência: cliente do degrau 2 ou 3 é
   candidato ao Crescimento mensal quando o projeto terminar

## Regras invioláveis

- `clientes/` inteira é privada (verificar que está no .gitignore; se não estiver, adicionar)
- Prazos do checklist são compromisso: quem cobra é o /abrir (resumo do dia)
- Restrições do conselho do nicho valem pra TODA peça do projeto
