---
name: proposta
description: >
  Gera a proposta comercial personalizada da Emérito pra um lead que passou pela call:
  calibrada por nicho e degrau da esteira, com ancoragem do pacote acima e a regra de
  nunca sair sem oferecer um degrau. Use quando o usuário disser "proposta pro dr X",
  "manda a proposta", "fechamos a call, gera a proposta" ou /proposta.
---

# /proposta — Proposta comercial personalizada

Padroniza o fechamento: toda proposta sai com a mesma qualidade, calibrada
pro nicho e pra dor confirmada na call, aplicando sozinha a regra de ouro
da esteira.

## Entrada

Nome do lead + nicho + degrau escolhido na call (1 a 5). Se existir
diagnóstico prévio em `saidas/diagnosticos/<slug>/`, LER — a proposta cita
os achados dele (personalização real, não template).

## Dependências

1. `_privado/ofertas.md` → régua de ofertas, preços e mapa dor → oferta
2. `_memoria/empresa.md` e `_memoria/preferencias.md` → contexto e tom
3. Modelo visual: se existir `templates/proposta/` usar como base; senão,
   gerar HTML limpo seguindo `identidade/design-guide.md`

## Estrutura da proposta (a que fecha)

1. **Abertura personalizada** — retoma a dor exata que o lead falou na call,
   com as palavras dele
2. **O diagnóstico em 3 achados** — os pontos mais fortes do diagnóstico
   (o que o Google mostra hoje, o que a imagem atual comunica)
3. **O caminho** — os blocos do método correspondentes ao degrau escolhido,
   descritos por BENEFÍCIO (nunca por ferramenta ou técnica)
4. **Investimento** — o degrau escolhido, com o degrau acima apresentado
   como ancoragem ("a maioria dos <nicho> escolhe...") e o abaixo como
   alternativa de entrada
5. **Próximos passos** — o que acontece nas primeiras 48h após o aceite
6. **Validade** — proposta com data de expiração (7 dias padrão)

## Saída

`saidas/propostas/<slug-do-lead>/proposta.html` (+ versão .md pra WhatsApp:
resumo curto com link ou PDF). Registrar no pipeline (se a skill /pipeline
estiver em uso) que a proposta foi enviada, com data.

## Regras invioláveis

- Sem travessão em nenhum texto
- Benefício sempre, "como" jamais (método é entregue a cliente, não a lead)
- NUNCA enviar proposta sem os 3 degraus visíveis (entrada, escolhido, âncora)
- Follow-up: agendar cobrança em 3 dias úteis se não houver resposta
  (usar `comercial/follow-ups-pos-reuniao.md` do workspace Emérito se existir)
- Checar restrições do conselho do nicho no texto (CFM, OAB etc.)
