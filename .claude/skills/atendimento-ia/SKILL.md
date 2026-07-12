---
name: atendimento-ia
description: >
  Projeta e implanta o atendimento com IA no WhatsApp de um cliente: resposta imediata
  24h, agendamento, confirmação e lembrete de consulta, com fluxos calibrados por
  especialidade. A dor mais forte do nicho médico virando produto. Use quando o usuário
  disser "atendimento IA do dr X", "implanta o WhatsApp do cliente", "fluxo de
  agendamento" ou /atendimento-ia.
---

# /atendimento-ia — O produto 5 da esteira

O paciente que chama às 23h e não é respondido marca com outro. A falta por
esquecimento custa a agenda. Essa skill empacota a solução: desenho do
fluxo, implantação e material de venda.

## Posição na esteira (decisão registrada)

Vender como MÓDULO dos pacotes + recorrência, não como vitrine própria
(vender avulso vira conversa de ferramenta, e a Emérito vende resultado).
Preços e enquadramento em `_privado/ofertas.md`.

## Modos de uso

### `/atendimento-ia desenhar <cliente>` — o fluxo da especialidade
Gera `clientes/<slug>/atendimento-ia/fluxo.md` com a máquina de estados:

1. **Recepção** — resposta imediata, tom do cliente (da narrativa), horário
   comercial e fora dele
2. **Triagem** — o que o contato quer: agendar / dúvida / urgência /
   convênio / preço (cada especialidade tem seus caminhos: dentista tem
   urgência de dor, psicólogo tem acolhimento, advogado tem triagem de caso)
3. **Agendamento** — oferta de horários, coleta mínima de dados (LGPD:
   só o necessário), confirmação na hora
4. **Confirmação e lembrete** — D-1 e D-0 (manhã), com reagendamento em
   1 toque; falta sem aviso entra em fluxo de recuperação
5. **Corrimão humano** — TODA conversa tem saída pra atendente; urgência
   médica/jurídica transborda IMEDIATAMENTE pra humano com alerta
6. **Fora de escopo** — o que a IA NUNCA responde nessa especialidade
   (diagnóstico, prescrição, conselho jurídico do caso, valores de honorário
   quando o conselho restringe)

### `/atendimento-ia implantar <cliente>` — a execução
Escolher a stack conforme o caso (o Aldo já tem base no `sistemaManyChat`):
ManyChat/n8n/Evolution API + Claude via API pra respostas. Gerar os
prompts do agente (persona, limites, transbordo), tabela de horários e
mensagens de confirmação/lembrete prontas. Checklist de go-live: número
dedicado, opt-in do paciente, teste dos 6 caminhos, monitoramento da
primeira semana.

### `/atendimento-ia vender` — material comercial do módulo
Um pager (HTML na identidade Emérito) com a dor → benefício da
especialidade do lead, SEM preço e SEM revelar a stack. Alimenta /proposta.

## Regras invioláveis

- LGPD: dado de paciente/cliente é sensível; coletar o mínimo, informar o
  uso, nunca versionar em git
- Conselhos: IA não diagnostica, não prescreve, não advoga; disclaimers
  por especialidade no fluxo
- Transbordo humano sempre disponível e óbvio
- Material de venda nunca cita ferramenta (regra do "como")
