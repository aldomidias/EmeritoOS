---
name: site-autoridade
description: >
  Monta o site de autoridade de um cliente (a entrega padrão da Emérito): estrutura
  validada de páginas, copy derivada da narrativa de posicionamento, SEO local e
  checklist de segurança antes de publicar. Use quando o usuário disser "site do dr X",
  "site de autoridade", "monta o site do cliente Y" ou /site-autoridade.
---

# /site-autoridade — O bloco 3 do Método (presença digital)

O site que faz quem pesquisa o nome do profissional encontrar algo à altura
da competência dele. Entregue em dias, não meses.

## Entrada

Slug do cliente. Pré-requisitos:
1. `clientes/<slug>/posicionamento/narrativa.md` → headline, território, pilares
2. `clientes/<slug>/identidade/design-guide.md` → cores, fontes, logo
3. `clientes/<slug>/BRIEFING.md` → fotos, endereço, contato, registro profissional

## Estrutura validada (one-page + páginas de apoio)

1. **Hero** — headline do posicionamento + foto profissional + CTA (agendar/WhatsApp)
2. **Autoridade** — os pilares da narrativa como prova concreta (formação,
   experiência, método), sem autoelogios vazios
3. **Pra quem** — o cliente ideal se reconhece; o resto se filtra
4. **Como funciona** — a jornada de atendimento em 3–4 passos (benefício, não técnica)
5. **Prova social** — depoimentos DENTRO do que o conselho permite
6. **Sobre** — a trajetória contada como narrativa, não currículo
7. **FAQ** — as perguntas que ele mais ouve (colhidas no briefing), boas pra SEO
8. **Contato/agendamento** — WhatsApp direto + mapa + horários
9. Rodapé: registro profissional visível (CRM/OAB/CRP), política de privacidade

## Passos

1. Gerar o site estático (HTML/CSS/JS puro ou o stack que o projeto do
   cliente já usa) em `clientes/<slug>/site/`
2. **SEO local:** title/description com especialidade + cidade, schema.org
   (Physician/Attorney/LocalBusiness conforme nicho), OpenGraph, sitemap,
   Google Search Console na entrega
3. **Perfis conectados:** bio do Instagram e descrição do GMB alinhadas ao
   site (textos prontos na entrega, vindos da narrativa)
4. **Antes de publicar — OBRIGATÓRIO:** rodar o checklist da skill
   `seguranca-web` (global): sem segredo no código, formulários validados,
   sem arquivo sensível em pasta pública, HTTPS
5. Deploy no padrão da Emérito (Netlify/Vercel/Coolify conforme o caso) e
   registro da URL no CHECKLIST.md

## Regras invioláveis

- Conselho profissional manda no conteúdo: sem promessa de resultado, sem
  antes/depois (CFM), sem captação indevida (OAB); registro sempre visível
- Copy deriva da narrativa: o site fala como o CLIENTE, não como a Emérito
- Mobile primeiro: o paciente/cliente pesquisa no celular
- Performance: imagens otimizadas, sem framework pesado em site institucional
- Sem travessão nos textos
