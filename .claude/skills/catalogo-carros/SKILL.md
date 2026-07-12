---
name: catalogo-carros
description: >
  Monta pra uma loja de carros o catálogo de veículos + site conectado: o lojista
  cadastra o estoque (planilha ou painel), o site puxa automaticamente; carro vendido
  some, carro novo entra sem programador. Use quando o usuário disser "catálogo da
  loja X", "site da loja de carros", "estoque conectado" ou /catalogo-carros.
---

# /catalogo-carros — Estoque vivo, site sempre atual

O produto replicável pra lojas de carros: a segunda loja sai em dias porque
o molde é esse aqui. Se existir um molde já construído (ex: projeto
`loja-carros` em Clientes-todos), partir dele; senão, gerar do zero e
AVISAR o Aldo que este projeto vira o molde de referência.

## A arquitetura (simples de operar, barata de manter)

1. **Fonte do estoque** — um dos dois, na ordem de preferência:
   - Planilha Google Sheets (o lojista já sabe usar): uma linha por carro
   - Painel admin próprio (quando a loja for maior) COM LOGIN, nunca rota escondida
2. **Ficha do veículo** — campos padrão: marca, modelo, versão, ano/modelo,
   km, câmbio, combustível, cor, preço, opcionais, fotos (mín. 8), status
   (disponível/reservado/vendido), destaque (s/n)
3. **Site conectado** — build estático regenerado a partir da fonte
   (webhook ou cron): home com destaques, listagem com filtros (marca,
   faixa de preço, ano, câmbio), página por veículo com galeria + botão
   WhatsApp já com a mensagem do carro preenchida
4. **SEO automotivo local** — title por veículo ("<Modelo> <ano> em
   <cidade>"), schema.org/Vehicle + AutoDealer, sitemap regenerado a cada
   build (estoque É o conteúdo SEO da loja)

## Passos

1. Briefing curto: nome, praça, volume de estoque, quem atualiza, identidade
2. Montar a fonte de estoque com 3 carros de exemplo e o manual de 1 página
   pro lojista ("como cadastrar um carro", com prints)
3. Gerar o site em `clientes/<slug>/site/` na identidade da loja
4. Conectar fonte → site e testar o ciclo completo: cadastrar carro de teste,
   ver no site, marcar vendido, sumir do site
5. **Checklist `seguranca-web` antes de publicar** (painel COM senha, upload
   de foto com limite e allowlist, credenciais fora do código)
6. Entregar: URL + manual + vídeo curto de 2min do fluxo de cadastro

## Regras invioláveis

- O lojista atualiza sozinho: se precisar chamar programador pra trocar
  preço, a entrega falhou
- Foto ruim derruba a loja inteira: manual inclui o padrão de foto (luz,
  ângulos, fundo)
- WhatsApp com mensagem pré-preenchida por carro (lead já chega qualificado)
- Preço sempre visível no site (mercado de carro sem preço espanta)
- Dados da loja em `clientes/` (privado, fora do git)
