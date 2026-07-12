---
name: kit-conteudo
description: >
  Gera o arranque de conteúdo do Método Emérito pra um cliente: kit de 8 a 12 peças
  (60 dias de munição) com calendário de publicação, usando a narrativa de posicionamento
  do cliente e o mapa de dores do nicho dele. Use quando o usuário disser "kit do dr X",
  "arranque de conteúdo", "as 12 peças do cliente Y" ou /kit-conteudo.
---

# /kit-conteudo — O bloco 4 do Método (arranque de conteúdo)

Cliente sai do projeto com 60 dias de munição pronta. O que levava dias de
produção sai numa sessão de trabalho.

## Entrada

Slug do cliente. Pré-requisitos (parar e avisar se faltarem):
1. `clientes/<slug>/posicionamento/narrativa.md` → a fonte da verdade (via /posicionamento)
2. `clientes/<slug>/identidade/design-guide.md` → visual do cliente (se não
   existir, usar tipografia neutra premium e avisar)
3. Mapa de dores do nicho (`.claude/skills/conteudo/dores-*.md` se existir)

## O kit (8 a 12 peças, mix padrão)

| Qtd | Formato | Papel |
|---|---|---|
| 3–4 | Carrossel | Autoridade: educa na dor do público DELE, fecha no benefício |
| 2–3 | Roteiro de Reels | Alcance: rosto, gancho nos 3 primeiros segundos |
| 2 | Post estático | Posicionamento: statement, frase de território |
| 1–2 | Sequência de Stories | Conexão: bastidor, rotina, prova social |
| 1 | Post de apresentação | O post fixado: quem ele é, pra quem, como chegar |

Cada peça sai completa: copy final + legenda + hashtags do nicho + nota de
produção (o que gravar/fotografar, quando for o caso).

### Diferença crucial vs. /conteudo

O /conteudo cria pro Aldo (vender a Emérito). O /kit-conteudo cria pro
CLIENTE (atrair paciente/cliente final dele). A estrutura dor → benefício
continua, mas a dor é a do público final: o paciente que adia a consulta,
o empresário com o contrato mal feito. E aqui o "como" PODE aparecer no
nível educativo (o médico educa sobre saúde), respeitando o conselho.

## Passos

1. Ler narrativa + dores do nicho → propor os temas das peças (lista curta,
   1 linha por peça) e validar com o Aldo ANTES de produzir
2. Produzir as peças aprovadas em `clientes/<slug>/conteudo/kit-01/<NN>-<formato>-<tema>/`
3. Gerar `calendario.md`: 60 dias, 2 posts/semana, ordem pensada (apresentação
   primeiro, autoridade e conexão alternando)
4. Marcar o bloco 4 no CHECKLIST.md do cliente

## Regras invioláveis

- Conselho do nicho SEMPRE (CFM: sem antes/depois, sem promessa de resultado,
  sem valor de consulta; OAB: sem captação direta; conferir por nicho)
- Voz do CLIENTE (da narrativa), não a voz do Aldo
- Sem travessão
- Visual: partir dos modelos aprovados quando o cliente não tiver identidade
  fechada (`.claude/skills/conteudo/modelos/`, adaptando cores/fontes ao design-guide dele)
