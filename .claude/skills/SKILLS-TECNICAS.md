# Skills técnicas do EméritoOS

Pacote de skills de segurança, UI/UX e criação de interfaces instalado em
2026-07-12. Todas foram auditadas antes da instalação (leitura do SKILL.md
e varredura dos scripts por chamadas de rede, exec e código ofuscado —
nada suspeito encontrado).

## Segurança

| Skill | O que faz | Origem (commit) |
|---|---|---|
| `seguranca-web` | Checklist obrigatório Emérito antes/depois de gerar qualquer site, API ou painel | própria (movida de `~/.claude/skills`) |
| `owasp-security` | OWASP Top 10:2025, ASVS 5.0, LLM Top 10 e Agentic AI security; quirks de 20+ linguagens | [agamm/claude-code-owasp](https://github.com/agamm/claude-code-owasp) (f5dfa3d) |

## UI/UX e design

| Skill | O que faz | Origem (commit) |
|---|---|---|
| `frontend-design` | Direção de arte pra interfaces distintivas, sem cara de template | [anthropics/skills](https://github.com/anthropics/skills) (9d2f1ae) |
| `ui-ux-pro-max` | Base pesquisável: 50+ estilos, 161 paletas, 57 pares de fontes, 99 diretrizes de UX, 10 stacks | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (3da52ff) |
| `web-design-guidelines` | Auditoria de UI: 100+ regras de acessibilidade, performance e UX | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (f8a72b9) |
| `theme-factory` | 10 temas prontos (cores + fontes) aplicáveis a landing pages, docs e slides | [anthropics/skills](https://github.com/anthropics/skills) (9d2f1ae) |

## Criação de interfaces e assets

| Skill | O que faz | Origem (commit) |
|---|---|---|
| `react-best-practices` | 70 regras de performance React/Next.js da engenharia da Vercel | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (f8a72b9) |
| `webapp-testing` | Testa sites locais com Playwright: screenshots, logs, verificação de fluxo | [anthropics/skills](https://github.com/anthropics/skills) (9d2f1ae) |
| `canvas-design` | Arte estática em PNG/PDF com filosofia de design (posters, carrosséis) — inclui fontes | [anthropics/skills](https://github.com/anthropics/skills) (9d2f1ae) |
| `banner-design` | Banners pra social media, ads e heroes de site em 13 estilos | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (3da52ff) |

## Documentos e produtividade

| Skill | O que faz | Origem (commit) |
|---|---|---|
| `pdf` | Cria, preenche e manipula PDFs (propostas, diagnósticos, relatórios) | [anthropics/skills](https://github.com/anthropics/skills) (9d2f1ae) |
| `docx` | Documentos Word com formatação, comentários e controle de alterações | [anthropics/skills](https://github.com/anthropics/skills) (9d2f1ae) |
| `xlsx` | Planilhas Excel com fórmulas e validação (dados de cliente, relatórios de ads) | [anthropics/skills](https://github.com/anthropics/skills) (9d2f1ae) |
| `pptx` | Apresentações PowerPoint (propostas comerciais, diagnósticos em call) | [anthropics/skills](https://github.com/anthropics/skills) (9d2f1ae) |
| `skill-creator` | Cria, melhora e testa skills novas — formaliza o fluxo de criação de skills do EméritoOS | [anthropics/skills](https://github.com/anthropics/skills) (9d2f1ae) |

## Como se combinam no fluxo da Emérito

1. **Projetar** — `ui-ux-pro-max` escolhe estilo/paleta/fonte pro nicho; `frontend-design` dá a direção de arte.
2. **Construir** — `react-best-practices` (se React/Next) e `theme-factory` na produção.
3. **Auditar** — `web-design-guidelines` (acessibilidade/UX) + `seguranca-web` e `owasp-security` (segurança) antes de publicar.
4. **Verificar** — `webapp-testing` roda o site local e confirma que tudo funciona.
5. **Assets** — `canvas-design` e `banner-design` pra carrosséis, posts e banners.

## Licenças

- Skills da Anthropic: licença própria (`LICENSE.txt` dentro de cada pasta — mantido).
- Vercel e ui-ux-pro-max: MIT.
- agamm/claude-code-owasp: MIT.

## Atualização

Pra atualizar uma skill de terceiro, clone o repo de origem e substitua a
pasta correspondente, anotando o novo commit aqui. **Sempre audite o
conteúdo antes** (scripts novos, chamadas de rede) — pesquisa da Snyk
mostrou que ~37% das skills de comunidade têm alguma falha de segurança.
