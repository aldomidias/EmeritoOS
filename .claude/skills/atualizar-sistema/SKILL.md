---
name: atualizar-sistema
description: >
  Atualiza APENAS o sistema do MazyUI (server, UI, launchers, skills, templates)
  no diretório do cliente, baixando o último estado do repo central do GitHub
  (DiogoSabec/sabec-os) sem tocar em dados, brand, memória ou identidade do
  cliente. Use quando o usuário rodar `/atualizar-sistema` dentro da pasta de
  um cliente (ex: ~/Documents/Empresas/Vanessa) e quiser puxar melhorias.
---

# /atualizar-sistema — sync do sistema central

Cada cliente do MazyUI é um clone privado com brand próprio, dados próprios
e memória própria. O sistema em si (server, UI, skills, templates) evolui no
repo central `DiogoSabec/sabec-os`. Essa skill puxa essas melhorias pro
cliente sem sobrescrever nada que é dele.

## Pré-checagem

### 1. Confere se é um cliente, não o sabec-os

Roda:

```bash
git remote -v
```

Se a saída mostrar `origin` apontando pra `DiogoSabec/sabec-os` ou
`mazzeoia/MazyOS`, **PARA**:

> "Isso aqui parece ser o repo central do MazyUI, não um cliente.
>  `/atualizar-sistema` é pra rodar dentro da pasta de um cliente
>  (ex: ~/Documents/Empresas/Vanessa). Verifica a pasta atual."

Se for um cliente real (origin é DiogoSabec/clinica-vanessa, ou outro repo
de cliente), pode seguir.

### 2. Confere se tem mudanças não-commitadas

Roda:

```bash
git status --porcelain
```

Se a saída não for vazia:

> "Você tem mudanças não-commitadas. O `/atualizar-sistema` vai mexer em
>  arquivos do sistema e melhor commitar o que tá em aberto antes pra não
>  misturar diff. Quer commitar agora? Posso te ajudar."

Espera o usuário decidir. Não roda commit automático em cima de WIP.

### 3. Confere se o sabec-os central tá acessível

Roda:

```bash
git ls-remote https://github.com/DiogoSabec/sabec-os.git HEAD
```

Se falhar (offline, sem acesso, repo privado sem auth), reporta erro claro:

> "Não consegui acessar o repo central do MazyUI
>  (github.com/DiogoSabec/sabec-os). Verifica conexão e permissões de
>  acesso. Não foi alterado nada."

## Fase 1 — Clone temporário

Cria pasta temp única:

```bash
TIMESTAMP=$(date +%s)
TMP_DIR="/tmp/sabec-os-update-$TIMESTAMP"
git clone --depth 1 https://github.com/DiogoSabec/sabec-os.git "$TMP_DIR"
SABEC_HASH=$(git -C "$TMP_DIR" rev-parse HEAD)
SABEC_HASH_SHORT=$(git -C "$TMP_DIR" rev-parse --short HEAD)
```

Guarda `$SABEC_HASH_SHORT` pro commit message no fim.

## Fase 2 — Checa se cliente já tá na última versão

Olha o último commit do cliente que veio do sistema:

```bash
git log --oneline -n 50 | grep "chore: atualiza sistema do sabec-os" | head -1
```

Se a linha contém o mesmo `$SABEC_HASH_SHORT`, responde:

> "O cliente já está na última versão do MazyUI (`<hash>`). Nada a
>  atualizar."

Limpa o `$TMP_DIR` e encerra.

## Fase 3 — Whitelist e blacklist

### SISTEMA (atualiza)

Arquivos individuais:

- `mazyui-server.mjs`
- `mazyui-ui.html`
- `Abrir MazyUI.command`
- `Abrir MazyUI.bat`
- `.gitignore`

Pastas (full sync — copia tudo, com merge especial pra skills):

- `templates/`
- `mazyui-ui/` — sync com `--delete` (system-owned; cliente não deve colocar arquivos aqui)
- `.claude/skills/`

Arquivos com merge especial (regras abaixo):

- `package.json`
- `CLAUDE.md`

### SKILLS_DEV_ONLY (nunca propagam pros clientes)

Skills que vivem no `sabec-os` central mas são de desenvolvimento do
sistema, não de operação do cliente:

```bash
SKILLS_DEV_ONLY=("sincronizar")
```

Essas pastas existem em `.claude/skills/` do central mas são ignoradas
em todo passo do sync (Fase 4 não compara, Fase 6.2 não copia, Fase 4
manifest não inclui). Quando um cliente já tem uma delas por causa de
sync antigo, a Fase 6.2 trata como órfã e remove.

### CLIENTE (não toca)

NUNCA copia nem sobrescreve:

- `brand.config.js` — cada cliente tem o próprio
- `_memoria/*` — dados do cliente
- `identidade/*` — cores, fontes, logo, brand book
- `REFERENCIAS/` — docs do cliente
- `marketing/`, `saidas/`, `dados/`, `pacientes/`, `clientes/` — conteúdo
  gerado e dados operacionais
- `local-routes.mjs` — extensão de servidor do cliente (rotas custom)
- `local-ui.js` — extensão de UI do cliente (painéis custom)
- `local-ui.css` — overrides de tema/paleta (carregado pelo `mazyui-ui.html`)
- `.ui-fork` — marker (ver abaixo)
- `*.code-workspace`
- `package-lock.json`
- `node_modules/`
- `.git/`
- `_inbox/`, `_arquivo/` (se existirem)

**Importante:** `local-routes.mjs`, `local-ui.js` e `local-ui.css` são
o contrato de extensão do MazyUI. Cliente coloca rotas, painéis e
overrides de tema nesses arquivos pra que `mazyui-server.mjs` e
`mazyui-ui.*` (os arquivos do sistema) possam ser atualizados livremente
sem perder customizações. Se você for editar `mazyui-server.mjs` ou
`mazyui-ui.html` "só pra adicionar uma coisinha" — pare. Mova pra
`local-*` antes que o próximo sync apague.

### UI-fork (cliente com UI customizada por dentro)

Caso especial: cliente que customizou arquivos de UI do sistema direto
(fora do contrato `local-*`) e não pode mais receber atualizações
desses arquivos. Pra marcar, o cliente cria um arquivo `.ui-fork` na
raiz. Se ele existir, o sync **pula completamente**:

- `mazyui-ui.html`
- A pasta inteira `mazyui-ui/` (todos os módulos, vendor, styles)

Todo o resto (server, skills, templates, CLAUDE.md, launchers) flui normal.

Detecção:

```bash
UI_FORK=0
[ -f ./.ui-fork ] && UI_FORK=1
```

Em todas as fases (4, 5, 6.1, 6.2, 6.5), tratar `mazyui-ui.html` e
`mazyui-ui/` como "ignorados" quando `UI_FORK=1`. Mostrar no resumo da
Fase 5:

```
  UI-fork detectado (.ui-fork) — pulando mazyui-ui.html e mazyui-ui/
```

**Sair do fork:** pra um cliente voltar a receber atualizações normais
de UI, o processo é:

1. Apagar `.ui-fork` da raiz.
2. Deletar manualmente os arquivos legacy `mazyui-ui.css` e `mazyui-ui.js`
   da raiz (se ainda existirem de antes do refactor modular).
3. Rodar `/atualizar-sistema` → o sync materializa `mazyui-ui/` (pasta
   modular) + `mazyui-ui.html` atualizado no cliente.

## Fase 4 — Detecta mudanças

Pra cada arquivo/pasta da whitelist, compara temp vs cliente e classifica:

- **modificado** — existe nos dois, conteúdo difere
- **novo** — existe no temp, não existe no cliente
- **removido** — existe no cliente, foi removido do sabec-os (só
  notifica, NÃO remove automaticamente — pode ser skill customizada do
  cliente)

Forma de comparar (pra arquivos individuais):

```bash
diff -q "$TMP_DIR/mazyui-server.mjs" ./mazyui-server.mjs
```

Pra pastas, usa `diff -rq` e parseia.

### Regra especial: skills customizadas + remoção de órfãs

A Fase 6.2 mantém um manifesto em
`.claude/skills/.system-manifest.json` listando as skills que vieram do
central na última sync. Isso permite distinguir "skill customizada do
cliente" (nunca esteve no manifesto) de "skill que veio do central"
(está no manifesto):

```json
{ "skills": ["abrir", "atualizar", "carrossel", ...] }
```

Pra `.claude/skills/<nome>/`:

- Está em `SKILLS_DEV_ONLY` → **ignora** em qualquer fase (não compara,
  não copia, não inclui no manifesto). Se existe no cliente, Fase 6.2
  remove como órfã.
- Existe **só no cliente** e **não está no manifesto** → **preserva**
  (skill custom do cliente, ex: criada por `/mapear-rotinas`)
- Existe **só no cliente** e **está no manifesto anterior** → **órfã**
  (veio do central numa sync passada, foi removida do central). Fase
  6.2 remove.
- Existe **só no sabec-os** → **adiciona** (skill nova do sistema)
- Existe **nos dois** → marca como "modificada" se conteúdo difere e
  copia direto (cliente é encorajado a não customizar skills do
  sistema — pra customizar, copia pra `.claude/skills/<nome>-custom/`)

Edge case: se `.system-manifest.json` não existe (primeira sync após
upgrade), assume manifesto = lista atual do central. Não remove órfã
nessa primeira passada — só registra o estado. Próximas syncs já
removem normalmente.

## Fase 5 — Resumo das mudanças

Mostra o resumo pro usuário:

```
sistema sabec-os: <hash atual no cliente> → <SABEC_HASH_SHORT> (último)

mudanças:
  modificados (N): mazyui-server.mjs, mazyui-ui.html, .claude/skills/carrossel/SKILL.md
  novos (M):       .claude/skills/<nova-skill>/SKILL.md, templates/<x>
  removidos (K):   templates/<y>  (não vou remover — só aviso)

  package.json:  vai atualizar type/devDependencies, preservar name
  CLAUDE.md:     vai atualizar parte genérica, preservar bloco do cliente

quer ver detalhes (diff arquivo por arquivo)? [s/n]
```

Se [s], mostra `diff` colorido por arquivo. Sugestão:

```bash
diff -u "<cliente-path>" "$TMP_DIR/<path>" | head -100
```

Depois pergunta:

> "Aplicar? [s/n]"

## Fase 6 — Aplicação

Só roda se o usuário disser [s].

### 6.1 — Arquivos individuais

```bash
cp "$TMP_DIR/mazyui-server.mjs" ./mazyui-server.mjs
if [ ! -f ./.ui-fork ]; then
  cp "$TMP_DIR/mazyui-ui.html" ./mazyui-ui.html
else
  echo "  ⊘ .ui-fork detectado — mazyui-ui.html e mazyui-ui/ preservados"
fi
cp "$TMP_DIR/Abrir MazyUI.command" "./Abrir MazyUI.command"
cp "$TMP_DIR/Abrir MazyUI.bat" "./Abrir MazyUI.bat"
cp "$TMP_DIR/.gitignore" ./.gitignore
```

Se algum arquivo do sistema foi editado manualmente no cliente (conflito
detectado na Fase 4 — o conteúdo do cliente diferia mas não tinha origem
upstream antes), AVISA antes de sobrescrever:

> "O arquivo `<x>` foi modificado manualmente no cliente. Sobrescrever
>  com a versão do sabec-os? Detalhe do diff: [...] [s/n]"

### 6.2 — Pastas (templates/, mazyui-ui/, .claude/skills/)

Pra `templates/`: pode usar `rsync` com `--delete` cuidadoso, ou apenas
copiar over. Solução simples:

```bash
rsync -a --delete "$TMP_DIR/templates/" ./templates/
```

Pra `mazyui-ui/`: system-owned, usa `--delete` pra garantir que módulos
removidos do central não fiquem no cliente:

```bash
if [ ! -f ./.ui-fork ]; then
  rsync -a --delete "$TMP_DIR/mazyui-ui/" ./mazyui-ui/
fi
```

Pra `.claude/skills/`: NÃO usa `--delete` global (pra preservar skills
customizadas do cliente). Lógica em 4 passos:

```bash
MANIFEST="./.claude/skills/.system-manifest.json"
SKILLS_DEV_ONLY=("sincronizar")

# (1) lê manifesto anterior; vazio se não existe (primeira passada após upgrade)
if [ -f "$MANIFEST" ]; then
  PREV_SKILLS=$(node -e "const m=require('$PWD/${MANIFEST#./}');console.log((m.skills||[]).join(' '))")
  FIRST_PASS=0
else
  PREV_SKILLS=""
  FIRST_PASS=1
fi

# (2) skills atuais do central (excluindo SKILLS_DEV_ONLY)
CENTRAL_SKILLS=()
for dir in "$TMP_DIR/.claude/skills/"*/; do
  skill_name=$(basename "$dir")
  is_dev=0
  for d in "${SKILLS_DEV_ONLY[@]}"; do
    [ "$d" = "$skill_name" ] && is_dev=1 && break
  done
  [ $is_dev -eq 1 ] && continue
  CENTRAL_SKILLS+=("$skill_name")
done

# (3) copia cada skill do central (exceto SKILLS_DEV_ONLY)
for skill_name in "${CENTRAL_SKILLS[@]}"; do
  rsync -a "$TMP_DIR/.claude/skills/$skill_name/" "./.claude/skills/$skill_name/"
done

# (4) remove órfãs: skills no cliente que estavam no manifesto anterior
#     E não estão mais no central. Também remove qualquer skill que
#     esteja em SKILLS_DEV_ONLY (mesmo se nunca esteve no manifesto —
#     pode ter vindo de sync antigo sem blacklist).
if [ $FIRST_PASS -eq 0 ]; then
  for skill_name in $PREV_SKILLS; do
    in_central=0
    for c in "${CENTRAL_SKILLS[@]}"; do
      [ "$c" = "$skill_name" ] && in_central=1 && break
    done
    if [ $in_central -eq 0 ] && [ -d "./.claude/skills/$skill_name" ]; then
      echo "  removendo órfã: $skill_name"
      rm -rf "./.claude/skills/$skill_name"
    fi
  done
fi

# Sempre limpa skills SKILLS_DEV_ONLY que ficaram no cliente
for d in "${SKILLS_DEV_ONLY[@]}"; do
  if [ -d "./.claude/skills/$d" ]; then
    echo "  removendo dev-only que vazou: $d"
    rm -rf "./.claude/skills/$d"
  fi
done

# (5) escreve manifesto atualizado
node -e "
const fs=require('fs');
fs.writeFileSync('$MANIFEST', JSON.stringify({skills:'${CENTRAL_SKILLS[*]}'.split(' ').filter(Boolean).sort()},null,2)+'\n');
"
```

Resumo das mudanças exibidas ao usuário inclui órfãs removidas, no
formato:

```
  removidas (J): sincronizar (dev-only), seo (não existe mais no central)
```

### 6.3 — package.json (merge)

Preserva o `name` do cliente, atualiza o resto. Usa `node` pra fazer um
merge limpo:

```bash
node -e "
const fs = require('fs');
const cliente = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const sistema = JSON.parse(fs.readFileSync('$TMP_DIR/package.json', 'utf8'));
sistema.name = cliente.name;
// preserva version do cliente se existir (cliente pode ter sua própria)
if (cliente.version) sistema.version = cliente.version;
fs.writeFileSync('./package.json', JSON.stringify(sistema, null, 2) + '\n');
"
```

### 6.4 — CLAUDE.md (merge com separador)

Convenção: o `CLAUDE.md` do sabec-os termina com uma linha `---` (três
hífens) como marcador de fim do bloco genérico. O cliente acrescenta o
bloco customizado abaixo desse separador (`/instalar` faz isso).

Lógica de merge:

1. Lê `CLAUDE.md` do sabec-os (`$TMP_DIR/CLAUDE.md`).
2. Lê `CLAUDE.md` do cliente.
3. No cliente, encontra a **última** linha `---` que aparece isolada
   (linha contendo só `---`).
4. Tudo depois dessa última linha é o "bloco do cliente" — preservar.
5. Resultado = conteúdo do sabec-os + bloco do cliente.

Edge case: se o sabec-os `CLAUDE.md` não termina com `---`, adiciona
`\n---\n\n` antes de prepender o bloco do cliente.

Edge case: se o cliente não tem nenhum `---` no `CLAUDE.md` (instalação
antiga), trata o `CLAUDE.md` atual do cliente como bloco genérico
(sobrescrevível), avisa e sobrescreve com o do sabec-os, depois
pergunta:

> "Esse cliente não tem bloco customizado de `CLAUDE.md` (sem `---`
>  separador). Vou sobrescrever com o do sabec-os. Se você tinha
>  customizações, elas estão no git histórico — posso restaurar.
>  Tudo certo? [s/n]"

Implementação com Node:

```bash
node -e "
const fs = require('fs');
let sistema = fs.readFileSync('$TMP_DIR/CLAUDE.md', 'utf8');
const cliente = fs.readFileSync('./CLAUDE.md', 'utf8');

// pega bloco do cliente (tudo após o último '---' isolado)
const lines = cliente.split('\n');
let sepIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === '---') { sepIdx = i; break; }
}
const blocoCliente = sepIdx >= 0 ? lines.slice(sepIdx).join('\n') : '';

// garante que sistema termina com '---' isolado
if (!/\n---\s*$/.test(sistema.trimEnd())) {
  sistema = sistema.trimEnd() + '\n\n---\n';
}

const merged = blocoCliente
  ? sistema.trimEnd() + '\n\n' + blocoCliente.replace(/^---\n?/, '---\n')
  : sistema;

fs.writeFileSync('./CLAUDE.md', merged.endsWith('\n') ? merged : merged + '\n');
"
```

## Fase 6.5 — Verificação pós-sync

Antes de commitar, confere duas invariantes:

### 1. Arquivos de sistema bateram com o central

```bash
SYS_FILES=(mazyui-server.mjs)
if [ ! -f ./.ui-fork ]; then
  SYS_FILES+=(mazyui-ui.html)
fi
for f in "${SYS_FILES[@]}"; do
  diff -q "$TMP_DIR/$f" "./$f" && \
    echo "  ✓ $f = central" || echo "  ✗ $f DIVERGE"
done
# verifica pasta mazyui-ui/ (só se não for ui-fork)
if [ ! -f ./.ui-fork ]; then
  diff -rq "$TMP_DIR/mazyui-ui/" ./mazyui-ui/ && \
    echo "  ✓ mazyui-ui/ = central" || echo "  ✗ mazyui-ui/ DIVERGE"
fi
```

Se algum diverge, é bug do sync — reporta e não commita. Quando
`.ui-fork` está presente, `mazyui-ui.html` e `mazyui-ui/` são
propositalmente divergentes e ficam fora dessa verificação.

### 2. `local-routes.mjs` e `local-ui.js` continuam intactos

Antes da Fase 6 começar, salva o hash:

```bash
LOCAL_ROUTES_HASH_BEFORE=$(test -f ./local-routes.mjs && shasum -a 256 ./local-routes.mjs | awk '{print $1}' || echo "ausente")
LOCAL_UI_HASH_BEFORE=$(test -f ./local-ui.js && shasum -a 256 ./local-ui.js | awk '{print $1}' || echo "ausente")
```

Depois da Fase 6:

```bash
LOCAL_ROUTES_HASH_AFTER=$(test -f ./local-routes.mjs && shasum -a 256 ./local-routes.mjs | awk '{print $1}' || echo "ausente")
LOCAL_UI_HASH_AFTER=$(test -f ./local-ui.js && shasum -a 256 ./local-ui.js | awk '{print $1}' || echo "ausente")

[ "$LOCAL_ROUTES_HASH_BEFORE" = "$LOCAL_ROUTES_HASH_AFTER" ] && \
  echo "  ✓ local-routes.mjs intacto" || echo "  ✗ local-routes.mjs MUDOU — BUG no sync"
[ "$LOCAL_UI_HASH_BEFORE" = "$LOCAL_UI_HASH_AFTER" ] && \
  echo "  ✓ local-ui.js intacto" || echo "  ✗ local-ui.js MUDOU — BUG no sync"
```

Se algum hash mudou, é bug do sync — reporta, NÃO commita, e instrui o
usuário a fazer `git checkout -- local-routes.mjs local-ui.js` pra
recuperar.

## Fase 6.6 — Limpeza de órfãos legacy UI

Se `.ui-fork` NÃO existe no cliente E o `$TMP_DIR` (central) NÃO contém
mais `mazyui-ui.css` ou `mazyui-ui.js`, remover esses arquivos do cliente
(são resquícios do layout monolítico anterior ao refactor modular):

```bash
if [ ! -f ./.ui-fork ]; then
  if [ ! -f "$TMP_DIR/mazyui-ui.css" ] && [ -f ./mazyui-ui.css ]; then
    rm ./mazyui-ui.css
    echo "  removendo órfão legacy: mazyui-ui.css"
  fi
  if [ ! -f "$TMP_DIR/mazyui-ui.js" ] && [ -f ./mazyui-ui.js ]; then
    rm ./mazyui-ui.js
    echo "  removendo órfão legacy: mazyui-ui.js"
  fi
fi
```

Clientes com `.ui-fork` presente mantêm os arquivos legacy
indefinidamente — responsabilidade deles. Não remover nesses casos.

## Fase 7 — Commit

```bash
git add -A
git commit -m "chore: atualiza sistema do sabec-os $SABEC_HASH_SHORT"
```

Reporta sucesso:

> "Sistema atualizado pra `<SABEC_HASH_SHORT>`. Diff commitado.
>  Pra publicar: `git push`."

## Fase 8 — Limpeza

```bash
rm -rf "$TMP_DIR"
```

Sempre roda — mesmo se o usuário cancelou na Fase 5.

## Edge cases

- **Cliente offline**: erro na Fase Pré-checagem #3, nada é alterado
- **Sabec-os privado, sem auth**: mesma coisa, erro claro
- **Cliente sem .claude/skills/**: cria o diretório antes de sincronizar
- **Cliente sem templates/**: idem
- **Arquivo `Abrir MazyUI.command` perdeu o bit de executável após
  cópia**: roda `chmod +x "Abrir MazyUI.command"` no fim da Fase 6.1
- **Usuário cancela no meio**: não rola rollback (não foi commitado
  ainda). Próxima rodada vai detectar e oferecer de novo

## Regras

- Nunca toca em `brand.config.js`, `_memoria/`, `identidade/`,
  `REFERENCIAS/`, `marketing/`, `saidas/`, `dados/`, `pacientes/`,
  `clientes/`, `local-routes.mjs`, `local-ui.js`
- Não roda `git commit` automático em cima de mudanças não-relacionadas
  do cliente (a Pré-checagem #2 já bloqueia)
- Remove skills órfãs (que estavam no manifesto da última sync e
  sumiram do central) e skills em SKILLS_DEV_ONLY. Skill customizada
  do cliente (nunca esteve no manifesto) é preservada
- Não remove outros arquivos do cliente que sumiram do sabec-os — só
  avisa
- Sempre limpa `/tmp/sabec-os-update-*` no fim, mesmo em cancelamento
- Não atualiza `package-lock.json` — quem precisar roda `npm install`
- Toda saída direta, sem floreio, em português brasileiro
