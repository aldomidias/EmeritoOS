---
name: seguranca-web
description: >-
  Checklist de segurança OBRIGATÓRIO para consultar ANTES de projetar e DEPOIS
  de gerar qualquer site, landing page, API, servidor, painel admin ou linha de
  código. Cobre os erros que a IA (vibe coding) costuma introduzir sem avisar:
  segredos/API keys vazados, upload de arquivo inseguro, XSS e injeção de
  scripts (cryptominer), painel admin sem senha, dependências vulneráveis,
  .env/.git/backup expostos, servidor/VPS/Coolify mal configurado, deface em
  massa. Use SEMPRE que for gerar, revisar, dar deploy ou "publicar" código —
  não importa se é site estático simples ou app com backend.
---

# Segurança Web — o guia que a IA sempre tem que seguir

> **Por que esta skill existe (casos reais de clientes do Aldo):**
> 1. Cliente fez site no "vibe coding", **servidor invadido**: injetaram um **JS malicioso** por uma falha e usaram a máquina pra **minerar cripto**.
> 2. Cliente com ~90 páginas no mesmo servidor teve a maioria **trocada por conteúdo pornográfico** de uma vez ("defacement") — bastou **uma brecha**.
> 3. A IA gera código que **parece normal mas tem furos pequenos**. A regra do Aldo: *"ela termina, eu olho, analiso e vejo se não tem nada de errado — sempre acho coisa"*. Esta skill é esse olho.

---

## Como usar (2 momentos)

- **ANTES de escrever código** (ao planejar um site/feature): leia a seção **Regra de ouro** + o **Checklist rápido**. Decida onde ficam segredos, se há upload, se há área logada, o que é público.
- **DEPOIS de gerar / ANTES de dar deploy (`git push`)**: rode o **Checklist rápido** inteiro e os **Comandos de auditoria**. Só publica depois de bater tudo.

**Nunca** faça `git push` / deploy sem passar por aqui. Publicar é irreversível: o que vazou, vazou (fica no histórico do Git, em cache, indexado no Google).

---

## Regra de ouro

**A IA é ótima, mas cega pra risco.** Ela otimiza pra "funcionar", não pra "ser seguro". Um código pode funcionar 100% e ainda assim deixar a porta aberta. Então:

1. **Segredo nunca vai pro código.** Senha, API key, token, string de conexão → sempre em variável de ambiente (`.env`), **nunca** escrito direto no `.js`/`.html`/`.py`.
2. **Todo dado que vem de fora é suspeito** — o que o usuário digita, envia, faz upload ou manda pela URL. Valide antes de usar, escape antes de exibir.
3. **Tudo que é público é público de verdade.** Qualquer arquivo dentro de uma pasta servida na web pode ser aberto por qualquer um que adivinhe a URL. Não jogue nada sensível lá.
4. **Menos é mais seguro.** Menos dependências, menos endpoints abertos, menos "por via das dúvidas deixa liberado". Cada coisa a mais é uma porta a mais.
5. **Se não entendeu o que a IA fez, não publique.** O áudio do Aldo: *"tem hora que ela faz umas loucuras que, se você não entende, vai achar que é normal"*. Peça pra ela explicar linha por linha antes.

---

## ✅ Checklist rápido (rodar antes de todo deploy)

**Segredos**
- [ ] Nenhuma API key, senha, token ou string de conexão escrita direto no código.
- [ ] `.env` está no `.gitignore` e **não** foi commitado (`git log` não mostra ele).
- [ ] Chaves que são secretas de verdade (Stripe/InfinitePay secret, tokens de servidor) rodam **só no backend**, nunca no JS que vai pro navegador.

**Entrada do usuário (o furo do cryptominer)**
- [ ] Nada que o usuário digita é jogado direto no HTML com `innerHTML`/template sem escapar (isso permite injetar `<script>`).
- [ ] Formulários e APIs validam o que recebem (tipo, tamanho, formato) antes de usar/salvar.
- [ ] Se tem banco de dados: usa query parametrizada (`?`), nunca concatena texto do usuário na query.

**Upload de arquivo** (você usa multer — ex.: conversor)
- [ ] Limite de tamanho definido (`limits.fileSize`).
- [ ] Só aceita as extensões/tipos esperados (allowlist), rejeita o resto.
- [ ] Nome do arquivo é **sanitizado** (slug), nunca usa o nome original cru pra montar caminho (senão path traversal: `../../etc/...`).
- [ ] Pasta de upload/saída **não executa** o que recebe (é só arquivo estático, nunca script).

**Área logada / painel admin**
- [ ] Painel admin, dashboard ou qualquer rota de "gestão" **exige login** — não basta ser uma URL "secreta".
- [ ] Senha guardada com hash (bcrypt/argon2), nunca em texto puro.
- [ ] Endpoint de API que altera/apaga dados checa se a pessoa tem permissão (não confia só no frontend esconder o botão).

**Exposição de arquivos**
- [ ] `.env`, `.git/`, backups (`.zip`, `.sql`, `.bak`), `node_modules` não são acessíveis pela web.
- [ ] Pastas servidas como estático (`express.static`) só contêm o que pode ser público.

**Dependências**
- [ ] `npm audit` rodado; sem vulnerabilidade **high/critical** sem tratar.
- [ ] Nenhum pacote estranho/desconhecido entrou junto (conferir o que a IA adicionou no `package.json`).

**Servidor / deploy (Coolify + VPS)**
- [ ] HTTPS ligado (Coolify/Traefik já resolve — confirmar que a rota está em `https://`).
- [ ] Variáveis de ambiente configuradas **no Coolify**, não no repositório.
- [ ] Headers de segurança básicos ligados (ver seção Servidor).

---

## Vetores explicados (o "porquê" de cada item)

### 1. Segredos vazados
**O risco:** API key no código → qualquer um que vê o site (ou o repositório) usa sua conta. Com secret de pagamento, gera cobrança; com token de servidor, invade.
**Como a IA erra:** ela cola a chave "pra funcionar rápido" direto no arquivo, ou põe a chave secreta no JS do navegador.
**Blindagem:**
- Segredo vai em `.env` (backend) → no Coolify, cadastrar em *Environment Variables*.
- Regra: se a chave tem "secret"/"private" no nome, **só backend**. Se é "publishable"/"public", pode ir no front.
- Se já vazou uma chave: **revogue e gere outra** — não adianta só apagar do código, o histórico do Git guarda.

### 2. XSS / injeção de script — **o caso do cryptominer**
**O risco:** o site pega um texto do usuário (comentário, nome, campo de busca, dado da URL) e joga no HTML sem tratar. Se o texto for `<script>...</script>`, o navegador **executa**. Foi assim que injetaram o minerador de cripto: uma brecha deixou rodar JS de fora.
**Como a IA erra:** usa `elemento.innerHTML = textoDoUsuario` ou monta HTML com template string interpolando dado do usuário.
**Blindagem:**
- Pra exibir texto do usuário use `textContent` (não `innerHTML`).
- Se precisa de HTML, escape antes (`&lt;` no lugar de `<`) ou use uma lib de sanitização.
- Ligue **CSP** (Content-Security-Policy) — impede o navegador de rodar script de origem não autorizada, mata cryptominer injetado.

### 3. Injeção de SQL / comando
**O risco:** texto do usuário vira parte de uma query ou de um comando de sistema → o atacante lê/apaga o banco inteiro ou roda comando no servidor.
**Blindagem:** query **parametrizada** sempre (`WHERE id = ?`), nunca `"WHERE id = " + req.body.id`. Nunca passe input do usuário pra `exec`/`spawn`/shell.

### 4. Upload de arquivo (você usa isso)
**O risco:** aceitar qualquer arquivo → alguém sobe um script e depois abre pela URL pra executar no servidor; ou usa o nome `../../` pra escrever fora da pasta (path traversal); ou lota o disco com arquivo gigante.
**Blindagem (padrão do conversor, replicar):**
- `limits: { fileSize: ... }` sempre.
- Allowlist de extensão/MIME; rejeita o resto.
- **Renomeie** o arquivo (slug + carimbo de tempo), nunca use `originalname` cru no caminho.
- Pasta de saída é estático puro — nunca sirva ela como código executável.

### 5. Painel admin / autenticação — **o caso do defacement**
**O risco:** ~90 páginas trocadas por conteúdo pornô = alguém teve acesso de escrita ao servidor. Costuma ser: painel sem senha, senha fraca/padrão, credencial vazada, ou API de "salvar página" aberta sem checar login.
**Blindagem:**
- Toda rota que **cria/edita/apaga** exige autenticação **no backend** (não confie que "só o admin sabe a URL").
- Senhas com hash forte (bcrypt/argon2). Nada de senha `123`/`admin`.
- Sessão/token com expiração. Logout que realmente invalida.
- 2FA no que der (painel do Coolify, Cloudflare, Hostinger, GitHub).

### 6. Exposição de arquivos sensíveis
**O risco:** `seusite.com/.env`, `/.git/`, `/backup.zip` abrem no navegador → entrega senhas e código-fonte de bandeja.
**Blindagem:**
- `.gitignore` com `.env`, `node_modules`, `*.zip/*.sql/*.bak`, `.DS_Store`.
- `express.static` aponta só pra pasta pública (`public/`), nunca pra raiz do projeto.
- No conversor: a pasta `/saidas` é pública — não guarde nada sigiloso de cliente lá.

### 7. Dependências vulneráveis / pacote malicioso
**O risco:** um pacote npm com falha (ou falso, typosquatting) entra na sua árvore e traz backdoor.
**Blindagem:**
- `npm audit` antes de publicar; tratar high/critical.
- Conferir **cada** pacote novo que a IA adicionou — nome certo, popularidade, faz sentido pro projeto.
- `package-lock.json` commitado (trava versões).

### 8. Servidor / VPS / Coolify
- HTTPS obrigatório (Traefik do Coolify emite Let's Encrypt — confirmar que a rota subiu em https).
- Env vars **no Coolify**, não no Git.
- SSH da VPS só com chave (já é o caso: alias `aldovps`), senha desligada, e **nunca** commitar `~/.ssh/config`.
- Firewall: só abrir portas usadas (80/443). Cloudflare na frente (já tem) ajuda contra ataque.
- Manter Coolify, sistema e imagens Docker atualizados.
- Headers de segurança (com `helmet` no Express, ou config no Traefik/Nginx):
  `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY` (anti-clickjacking), `Strict-Transport-Security`.

### 9. Rate limiting / abuso
**O risco:** API sem limite → alguém chama 10.000x, derruba o servidor (DoS) ou testa senhas em massa (brute force).
**Blindagem:** `express-rate-limit` nos endpoints, principalmente login e uploads. Cloudflare também limita.

---

## 🚩 Red flags — a IA fez isso? Pare e revise

- Colou uma API key/senha **dentro** de um `.js`/`.html`/`.py`.
- Usou `innerHTML` / `dangerouslySetInnerHTML` com algo que veio do usuário.
- Montou query de banco com `+` concatenando input do usuário.
- Adicionou um pacote que você nunca ouviu falar "pra resolver".
- Criou rota `/admin`, `/api/salvar`, `/api/delete` **sem** checar login.
- `express.static` apontando pra `__dirname` (raiz) em vez de `public/`.
- CORS `origin: '*'` numa API que mexe com dados/sessão.
- Deixou `console.log` cuspindo token/senha/dado de cliente.
- Desativou verificação ("`rejectUnauthorized: false`", "ignore TLS") "pra funcionar".
- Um trecho que você **não entende** — peça explicação antes de aceitar.

---

## 🆘 Se já foi invadido (site trocado, minerador, etc.)

1. **Tire do ar / isole** — pausar o app no Coolify pra parar o dano e o consumo.
2. **Troque TODAS as senhas e chaves** — SSH, Coolify, Cloudflare, Hostinger, GitHub, tokens de API, banco. Assuma que tudo vazou.
3. **Ache a porta de entrada** — `git log` recente, arquivos modificados sem explicação, JS estranho injetado no HTML, processo desconhecido comendo CPU (`top`/`htop` na VPS).
4. **Restaure de um backup limpo** — anterior à invasão. Não confie no que está no servidor infectado.
5. **Corrija a falha** antes de subir de novo — senão volta a acontecer.
6. **Cloudflare**: cheque regras de firewall/WAF, ative "Under Attack" se estiver sob ataque.

---

## Comandos de auditoria rápidos

```bash
# Procurar segredos escritos no código (rodar na raiz do projeto)
grep -rInE "api[_-]?key|secret|password|token|senha|bearer|sk_live|sk_test" \
  --include=*.{js,ts,html,json,env,py} . 2>/dev/null | grep -v node_modules

# Confirmar que .env NÃO está sendo versionado
git check-ignore .env || echo "⚠️  .env NÃO está no .gitignore!"
git log --all --oneline -- '*.env' && echo "⚠️  .env já foi commitado — revogar chaves!"

# Vulnerabilidades em dependências
npm audit --omit=dev

# Ver o que a IA adicionou de pacote
git diff HEAD~1 package.json

# Achar uso perigoso de innerHTML / eval
grep -rn "innerHTML\|outerHTML\|eval(\|document.write" --include=*.js --include=*.html . | grep -v node_modules
```

---

## Resumo em 1 frase

**Segredo fora do código, todo input do usuário é suspeito, nada sensível em pasta pública, painel sempre com senha, e sempre revisar o que a IA gerou antes de publicar.**
