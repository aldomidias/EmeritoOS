// ============================================================
// MazyUI painel — servidor local
//   - Serve a UI estática
//   - Lê/grava os arquivos do workspace
//   - Spawna o Claude Code (instalado localmente em .mazyui-runtime)
//     com streaming JSON e devolve via SSE
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { brand } from './brand.config.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.join(ROOT, '.mazyui-runtime');
const PORT = Number(process.env.MAZYUI_PORT || 7777);
const IS_WIN = process.platform === 'win32';

// ============================================================
// Brand: substitui placeholders {{BRAND_*}} no HTML antes de servir
// ============================================================
function renderBrand(html) {
  return html
    .replaceAll('{{BRAND_NAME}}',      brand.name)
    .replaceAll('{{BRAND_TITLE}}',     brand.title)
    .replaceAll('{{BRAND_AUTHORS}}',   brand.authors)
    .replaceAll('{{BRAND_MARK_HTML}}', brand.markHtml)
    .replaceAll('{{BRAND_WELCOME}}',   brand.welcome);
}

// ============================================================
// Bootstrap: garante o Claude Code instalado localmente
// ============================================================
function resolveClaudeEntry() {
  const pkgDir = path.join(RUNTIME_DIR, 'node_modules', '@anthropic-ai', 'claude-code');
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  let binRel = null;
  if (typeof pkg.bin === 'string') binRel = pkg.bin;
  else if (pkg.bin && pkg.bin.claude) binRel = pkg.bin.claude;
  if (!binRel) return null;
  const entry = path.join(pkgDir, binRel);
  return fs.existsSync(entry) ? entry : null;
}

async function ensureClaudeCode() {
  let entry = resolveClaudeEntry();
  if (entry) return entry;

  console.log('[mazyui] Primeira execução — instalando Claude Code localmente…');
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const pkgPath = path.join(RUNTIME_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({
      name: 'mazyui-runtime',
      private: true,
      version: '0.0.1',
    }, null, 2));
  }
  await new Promise((resolve, reject) => {
    const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
    const proc = spawn(npmCmd, [
      'install',
      '@anthropic-ai/claude-code',
      '--no-audit', '--no-fund', '--loglevel=error',
    ], { cwd: RUNTIME_DIR, stdio: 'inherit', shell: IS_WIN });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error('npm install falhou: ' + code)));
    proc.on('error', reject);
  });
  entry = resolveClaudeEntry();
  if (!entry) throw new Error('Claude Code instalou mas o entry JS não foi encontrado em ' + RUNTIME_DIR);
  console.log('[mazyui] Pronto.');
  return entry;
}

// ============================================================
// Sistema de arquivos — leitura/escrita segura dentro do workspace
// ============================================================
function safeResolve(rel) {
  const abs = path.resolve(ROOT, rel || '');
  if (!abs.startsWith(ROOT)) throw new Error('Path fora do workspace');
  return abs;
}

function readSafe(rel) {
  try { return fs.readFileSync(safeResolve(rel), 'utf8'); }
  catch { return ''; }
}

const FORMAT_DIRS = ['instagram', 'quadrado', 'stories', 'horizontal', 'vertical', 'pinterest', 'classico', 'link-card'];

// Dimensões padrão por pasta de formato. Usado pelo renderizador HTML→PNG
// quando o cliente não passar width/height explicitamente.
const FORMAT_DIMS = {
  instagram: { width: 1080, height: 1350 },  // 4:5 — feed retrato (padrão)
  quadrado:  { width: 1080, height: 1080 },  // 1:1
  stories:   { width: 1080, height: 1920 },  // 9:16
  horizontal:{ width: 1920, height: 1080 },  // 16:9
  vertical:  { width: 1080, height: 1440 },  // 3:4
  pinterest: { width: 1080, height: 1620 },  // 2:3
  classico:  { width: 1440, height: 1080 },  // 4:3
  'link-card': { width: 1200, height: 628 },  // 1.91:1
};

// Lista um diretório e retorna os arquivos que casam com um regex, ordenados.
function listFiles(dir, rx) {
  try { return fs.readdirSync(dir).filter(f => rx.test(f)).sort(); }
  catch { return []; }
}

// Combina HTML + PNG do mesmo slide num único path. Lightbox prefere HTML
// (rápido pra editar), gallery prefere PNG (cover estável). Indexamos por
// "slug" do arquivo (sem extensão e sem zero-padding ruidoso).
// PNGs renderizados ficam em `<dir>/imagens/<W>x<H>/slide-*.png` (formato
// novo) ou direto em `<dir>/slide-*.png` (legado, antes da reorganização).
// Varremos ambos e devolvemos o path *relativo a `dir`* já com o subdir.
function listRenderedPngs(dir) {
  const out = [];
  // Legado: PNGs soltos no mesmo dir
  for (const f of listFiles(dir, /^slide-.*\.png$/i)) out.push(f);
  // Novo: imagens/<size>/slide-*.png
  const imgsDir = path.join(dir, 'imagens');
  if (fs.existsSync(imgsDir)) {
    try {
      for (const sizeDir of fs.readdirSync(imgsDir)) {
        const sd = path.join(imgsDir, sizeDir);
        try {
          if (!fs.statSync(sd).isDirectory()) continue;
        } catch { continue; }
        for (const f of listFiles(sd, /^slide-.*\.png$/i)) {
          out.push(`imagens/${sizeDir}/${f}`);
        }
      }
    } catch {}
  }
  return out;
}

function combineSlideList(dir) {
  const htmls = listFiles(dir, /^slide-.*\.html$/i);
  const pngs = listRenderedPngs(dir);
  const bySlug = new Map();
  const stem = (f) => path.basename(f).replace(/\.[^.]+$/, '');
  for (const f of htmls) {
    const slug = stem(f);
    if (!bySlug.has(slug)) bySlug.set(slug, {});
    bySlug.get(slug).html = f;
  }
  for (const f of pngs) {
    const slug = stem(f);
    if (!bySlug.has(slug)) bySlug.set(slug, {});
    // Se houver múltiplos PNGs (vários tamanhos), mantém o primeiro (menor
    // path lexicograficamente = soltos no dir > imagens/.../). Ordem
    // determinística é bom; cover sempre o mesmo.
    if (!bySlug.get(slug).png) bySlug.get(slug).png = f;
  }
  return [...bySlug.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, x]) => ({ slug, html: x.html || null, png: x.png || null }));
}

function scanLibrary() {
  const dir = path.join(ROOT, 'marketing', 'conteudo');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => {
      try { return fs.statSync(path.join(dir, name)).isDirectory(); }
      catch { return false; }
    })
    .map(name => {
      const itemDir = path.join(dir, name);
      const formats = {};
      for (const fmt of FORMAT_DIRS) {
        const fmtDir = path.join(itemDir, fmt);
        if (!fs.existsSync(fmtDir)) continue;
        const rel = path.relative(ROOT, fmtDir).replace(/\\/g, '/');
        const list = combineSlideList(fmtDir);
        if (!list.length) continue;
        // Para o front: 1) slides = lista de paths "preferidos" (HTML se existe,
        // senão PNG) — alimenta o lightbox. 2) slidesPng = só os PNGs (alimenta
        // o cover/gallery). 3) slidesHtml = só os HTMLs (alimenta o render).
        const slides = list.map(s => `${rel}/${s.html || s.png}`);
        const slidesPng = list.filter(s => s.png).map(s => `${rel}/${s.png}`);
        const slidesHtml = list.filter(s => s.html).map(s => `${rel}/${s.html}`);
        formats[fmt] = { slides, slidesPng, slidesHtml, folder: rel };
      }
      const relItem = path.relative(ROOT, itemDir).replace(/\\/g, '/');
      const rootList = combineSlideList(itemDir);
      const primaryFmt = formats.instagram ? 'instagram' : Object.keys(formats)[0] || null;
      let slides, slidesPng, slidesHtml, folder;
      if (primaryFmt) {
        ({ slides, slidesPng, slidesHtml, folder } = formats[primaryFmt]);
      } else {
        slides = rootList.map(s => `${relItem}/${s.html || s.png}`);
        slidesPng = rootList.filter(s => s.png).map(s => `${relItem}/${s.png}`);
        slidesHtml = rootList.filter(s => s.html).map(s => `${relItem}/${s.html}`);
        folder = relItem;
      }
      const captionPath = `${relItem}/legenda.md`;
      const captionLinkedinPath = `${relItem}/legenda-linkedin.md`;
      const readMaybe = (rel) => {
        try {
          const abs = path.join(ROOT, rel);
          return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
        } catch { return null; }
      };
      const caption = readMaybe(captionPath);
      const captionLinkedin = readMaybe(captionLinkedinPath);
      // HTML único multi-slide na raiz do item (ex: carrossel-feed.html).
      // É um modelo alternativo ao slide-*.html: um único arquivo com várias
      // seções .slide que o front renderiza num iframe rolável.
      let htmlSrc = null;
      try {
        const rootFiles = fs.readdirSync(itemDir);
        const feedHtmls = rootFiles.filter(f =>
          /\.html?$/i.test(f) && !/^slide-/i.test(f) &&
          fs.statSync(path.join(itemDir, f)).isFile()
        );
        if (feedHtmls.length === 1) htmlSrc = `${relItem}/${feedHtmls[0]}`;
      } catch {}
      return {
        name, folder, slides, slidesPng, slidesHtml, formats,
        itemFolder: relItem, htmlSrc,
        captionPath, caption,
        captionLinkedinPath, captionLinkedin,
      };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

// ============================================================
// HTTP helpers
// ============================================================
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', c => data += c);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function text(res, status, body, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': ct,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.md':   'text/plain; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf':  'application/pdf',
  '.txt':  'text/plain; charset=utf-8',
};

// ============================================================
// Handlers
// ============================================================
function handleState(req, res) {
  const logoAbs = path.join(ROOT, 'identidade', 'logo.svg');
  let logo = null;
  if (fs.existsSync(logoAbs)) {
    try {
      const st = fs.statSync(logoAbs);
      logo = { path: 'identidade/logo.svg', size: st.size, mtime: st.mtimeMs };
    } catch {}
  }
  const state = {
    folderName: path.basename(ROOT),
    memory: {
      empresa:      readSafe('_memoria/empresa.md'),
      preferencias: readSafe('_memoria/preferencias.md'),
      estrategia:   readSafe('_memoria/estrategia.md'),
    },
    identidade: readSafe('identidade/design-guide.md'),
    library: scanLibrary(),
    logo,
  };
  json(res, 200, state);
}

async function handleSave(req, res) {
  try {
    const body = await readBody(req);
    const { path: rel, content } = JSON.parse(body);
    if (!rel || typeof content !== 'string') {
      return json(res, 400, { error: 'path e content obrigatórios' });
    }
    const abs = safeResolve(rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    json(res, 200, { ok: true });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}

async function handleDeleteFile(req, res) {
  try {
    const { path: rel } = JSON.parse(await readBody(req));
    if (!rel) return json(res, 400, { error: 'path obrigatório' });
    const abs = safeResolve(rel);
    if (!fs.existsSync(abs)) return json(res, 404, { error: 'arquivo não existe' });
    const st = fs.statSync(abs);
    if (!st.isFile()) return json(res, 400, { error: 'só remove arquivos' });
    fs.unlinkSync(abs);
    json(res, 200, { ok: true });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}

// Reescreve src/href/url(...) relativos pra /api/file?path=... pra que
// HTML servido via /api/file (ex: preview em iframe) consiga carregar
// assets relativos como ../../../identidade/SVG/logo.svg.
function rewriteHtmlAssetUrls(html, relPath) {
  const baseDir = path.posix.dirname(relPath.split(path.sep).join('/'));
  const isAbsolute = (v) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#|data:)/i.test(v);
  const toApiUrl = (val) => {
    const resolved = path.posix.normalize(path.posix.join(baseDir, val));
    if (resolved.startsWith('..')) return val; // fora do workspace, deixa estourar 404
    return `/api/file?path=${encodeURIComponent(resolved)}`;
  };
  return html
    .replace(/\b(src|href)=(["'])([^"']+)\2/gi, (m, attr, q, val) => {
      if (isAbsolute(val)) return m;
      return `${attr}=${q}${toApiUrl(val)}${q}`;
    })
    .replace(/\burl\(\s*(["']?)([^)"']+)\1\s*\)/gi, (m, q, val) => {
      if (isAbsolute(val)) return m;
      return `url(${q}${toApiUrl(val)}${q})`;
    });
}

function handleFile(req, res, url) {
  try {
    const rel = url.searchParams.get('path');
    if (!rel) return text(res, 400, 'falta path');
    const abs = safeResolve(rel);
    if (!fs.existsSync(abs)) return text(res, 404, 'não encontrado');
    const ext = path.extname(abs).toLowerCase();
    if (ext === '.html' || ext === '.htm') {
      const raw = fs.readFileSync(abs, 'utf8');
      const rewritten = rewriteHtmlAssetUrls(raw, rel);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      return res.end(rewritten);
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    text(res, 500, String(e.message || e));
  }
}

let CLAUDE_ENTRY = null;
const activeRuns = new Map();   // runId -> child process

async function handleRun(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch { return json(res, 400, { error: 'JSON inválido' }); }
  const { prompt, runId, continueSession, model, sessionId, resumeSession } = body;
  if (!prompt || !runId) return json(res, 400, { error: 'prompt e runId obrigatórios' });

  // Valida UUID v4-ish (aceita qualquer UUID canônico 8-4-4-4-12 hex). Inválido vira null.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const safeSessionId = (typeof sessionId === 'string' && UUID_RE.test(sessionId)) ? sessionId : null;
  const safeResume = (typeof resumeSession === 'string' && UUID_RE.test(resumeSession)) ? resumeSession : null;

  if (!CLAUDE_ENTRY) {
    try { CLAUDE_ENTRY = await ensureClaudeCode(); }
    catch (e) { return json(res, 500, { error: 'Setup falhou: ' + e.message }); }
  }

  // SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => {
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
  };

  send('boot', { ok: true });

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--permission-mode', 'bypassPermissions',
  ];
  // Isolamento de sessões: cada thread de conversa (chat ou slide-edit) tem
  // um UUID próprio. --resume continua a thread, --session-id força um id
  // fresco. Sem nenhum dos dois, cai pra --continue (legacy / sem id).
  // resumeSession tem precedência: continuar uma thread existente.
  if (safeResume) {
    args.push('--resume', safeResume);
  } else if (safeSessionId) {
    args.push('--session-id', safeSessionId);
  } else if (continueSession) {
    args.push('--continue');
  }
  if (model && /^[a-z0-9._-]+$/i.test(model)) args.push('--model', model);
  // Sem shell — shell:true no Windows reconstrói o comando via cmd.exe e
  // quebra args com newline. Spawnar o entry direto (seja .exe nativo ou
  // arquivo JS) preserva os args como estão.
  const isExe = /\.exe$/i.test(CLAUDE_ENTRY);
  const cmd = isExe ? CLAUDE_ENTRY : process.execPath;
  const finalArgs = isExe ? args : [CLAUDE_ENTRY, ...args];
  const proc = spawn(cmd, finalArgs, {
    cwd: ROOT,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  activeRuns.set(runId, proc);

  let stdoutBuf = '';
  proc.stdout.on('data', chunk => {
    stdoutBuf += chunk.toString('utf8');
    let nl;
    while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (line) send('event', line);
    }
  });
  proc.stderr.on('data', chunk => {
    send('stderr', chunk.toString('utf8'));
  });
  proc.on('close', code => {
    if (stdoutBuf.trim()) send('event', stdoutBuf.trim());
    send('done', { exitCode: code });
    res.end();
    activeRuns.delete(runId);
  });
  proc.on('error', err => {
    send('stderr', 'Erro spawning Claude: ' + err.message);
    send('done', { exitCode: -1 });
    res.end();
    activeRuns.delete(runId);
  });

  req.on('close', () => {
    if (!proc.killed) proc.kill();
    activeRuns.delete(runId);
  });
}

async function handleCancel(req, res) {
  try {
    const { runId } = JSON.parse(await readBody(req));
    const proc = activeRuns.get(runId);
    if (proc && !proc.killed) {
      proc.kill();
      activeRuns.delete(runId);
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: 'run não encontrado' });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}

function handleShutdown(req, res) {
  json(res, 200, { ok: true });
  setTimeout(() => process.exit(0), 200);
}

function handleRestart(req, res) {
  // Dispara um cmd/sh em background que aguarda 2s (tempo do processo atual
  // sair + liberar a porta) e então sobe um novo `node mazyui-server.mjs`.
  // Em seguida mata o processo atual.
  try {
    const serverFile = path.join(ROOT, 'mazyui-server.mjs');
    if (IS_WIN) {
      // `start "" /min cmd /c ...` desanexa de vez do processo pai
      const cmdLine = `start "" /min cmd /c "timeout /t 2 /nobreak >nul & cd /d "${ROOT}" & node "${serverFile}""`;
      spawn('cmd.exe', ['/c', cmdLine], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref();
    } else {
      const shellCmd = `sleep 2 && cd "${ROOT}" && node "${serverFile}"`;
      spawn('sh', ['-c', shellCmd], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    }
    json(res, 200, { ok: true });
    setTimeout(() => process.exit(0), 200);
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}

// ============================================================
// Snapshot / restore — protege slides irmãos de edição acidental
// ============================================================
const SNAPSHOT_ROOT = path.join(RUNTIME_DIR, 'slide-snapshots');
// Slides que entraram em edição nesta sessão do servidor. Restore nunca
// sobrescreve esses, mesmo que tenham mudado em relação ao snapshot — a
// mudança veio de outra run paralela (intencional), não de scribbling.
const intentionallyEditedSlides = new Set();

// Filtra siblings pela extensão do arquivo alvo: edição de PNG snapshota
// só PNGs irmãos; edição de HTML snapshota só HTMLs (PNG vai ser
// regenerado pelo render endpoint, então não precisa proteger).
function siblingExtRegex(targetPath) {
  return /\.html?$/i.test(targetPath) ? /\.html?$/i : /\.png$/i;
}

async function handleSnapshotSiblings(req, res) {
  try {
    const { targetPath, runId } = JSON.parse(await readBody(req));
    if (!targetPath || !runId) return json(res, 400, { error: 'targetPath e runId obrigatórios' });
    const absTarget = safeResolve(targetPath);
    const folder = path.dirname(absTarget);
    const targetName = path.basename(absTarget);
    if (!fs.existsSync(folder)) return json(res, 404, { error: 'pasta não existe' });
    intentionallyEditedSlides.add(absTarget);
    const snapDir = path.join(SNAPSHOT_ROOT, runId.replace(/[^a-zA-Z0-9_-]/g, '_'));
    fs.mkdirSync(snapDir, { recursive: true });
    const rx = siblingExtRegex(targetPath);
    const siblings = fs.readdirSync(folder)
      .filter(f => rx.test(f) && f !== targetName);
    for (const f of siblings) {
      fs.copyFileSync(path.join(folder, f), path.join(snapDir, f));
    }
    json(res, 200, { ok: true, count: siblings.length });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}

async function handleRestoreSiblings(req, res) {
  try {
    const { targetPath, runId } = JSON.parse(await readBody(req));
    if (!targetPath || !runId) return json(res, 400, { error: 'targetPath e runId obrigatórios' });
    const absTarget = safeResolve(targetPath);
    const folder = path.dirname(absTarget);
    const snapDir = path.join(SNAPSHOT_ROOT, runId.replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (!fs.existsSync(snapDir)) return json(res, 200, { ok: true, restored: 0 });
    let restored = 0;
    const restoredFiles = [];
    const skipped = [];
    for (const f of fs.readdirSync(snapDir)) {
      const snap = path.join(snapDir, f);
      const live = path.join(folder, f);
      // Se esse irmão está sendo (ou foi) editado intencionalmente em outra
      // run, não sobrescreve — a mudança no disco é legítima.
      if (intentionallyEditedSlides.has(live)) {
        skipped.push(f);
        continue;
      }
      if (!fs.existsSync(live)) {
        fs.copyFileSync(snap, live);
        restored++;
        restoredFiles.push(f);
        continue;
      }
      const snapBuf = fs.readFileSync(snap);
      const liveBuf = fs.readFileSync(live);
      if (!snapBuf.equals(liveBuf)) {
        fs.writeFileSync(live, snapBuf);
        restored++;
        restoredFiles.push(f);
      }
    }
    fs.rmSync(snapDir, { recursive: true, force: true });
    json(res, 200, { ok: true, restored, files: restoredFiles, skipped });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}

async function handleOpenFolder(req, res) {
  try {
    const { path: rel } = JSON.parse(await readBody(req));
    if (!rel) return json(res, 400, { error: 'path obrigatório' });
    const abs = safeResolve(rel);
    if (!fs.existsSync(abs)) return json(res, 404, { error: 'pasta não encontrada' });
    const stat = fs.statSync(abs);
    const target = stat.isDirectory() ? abs : path.dirname(abs);
    let cmd, args;
    if (IS_WIN) { cmd = 'explorer.exe'; args = [target]; }
    else if (process.platform === 'darwin') { cmd = 'open'; args = [target]; }
    else { cmd = 'xdg-open'; args = [target]; }
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    json(res, 200, { ok: true });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}

const UPLOAD_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};
const UPLOAD_MAX_BYTES = 20 * 1024 * 1024; // 20MB por imagem

function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error(`payload excede ${Math.round(maxBytes / 1024 / 1024)}MB`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ============================================================
// Renderização HTML → PNG (Playwright lazy install)
//
// O fluxo do /carrossel agora emite um arquivo .html por slide. Editar
// HTML é instantâneo (DOM-level), mas pra publicar precisamos do PNG
// na proporção certa. O usuário clica "Renderizar PNG" e o servidor
// abre o HTML num Chromium headless e tira screenshot.
//
// Playwright + Chromium custam ~170MB. Instalamos lazy dentro de
// `.mazyui-runtime/` na primeira chamada — pra quem nunca usar essa
// feature o custo é zero.
// ============================================================
let PLAYWRIGHT = null; // módulo carregado depois do install
let PLAYWRIGHT_BROWSER = null; // instância singleton de chromium

function resolvePlaywrightModule() {
  const modPath = path.join(RUNTIME_DIR, 'node_modules', 'playwright');
  try {
    if (fs.existsSync(path.join(modPath, 'package.json'))) {
      return path.join(modPath, 'index.js');
    }
  } catch {}
  return null;
}

async function ensurePlaywright() {
  if (PLAYWRIGHT) return PLAYWRIGHT;
  let entry = resolvePlaywrightModule();
  if (!entry) {
    console.log('[mazyui] Primeira renderização — instalando Playwright + Chromium em .mazyui-runtime …');
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    const pkgPath = path.join(RUNTIME_DIR, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      fs.writeFileSync(pkgPath, JSON.stringify({
        name: 'mazyui-runtime', private: true, version: '0.0.1',
      }, null, 2));
    }
    await new Promise((resolve, reject) => {
      const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
      const proc = spawn(npmCmd, [
        'install', 'playwright',
        '--no-audit', '--no-fund', '--loglevel=error',
      ], { cwd: RUNTIME_DIR, stdio: 'inherit', shell: IS_WIN });
      proc.on('close', code => code === 0 ? resolve() : reject(new Error('npm install playwright falhou: ' + code)));
      proc.on('error', reject);
    });
    // Baixa o binário do Chromium (Playwright só baixa quando rodado o
    // script de install, que `npm install playwright` já dispara). Por
    // segurança chamamos `playwright install chromium` explicitamente.
    await new Promise((resolve, reject) => {
      const pwBin = path.join(RUNTIME_DIR, 'node_modules', '.bin', IS_WIN ? 'playwright.cmd' : 'playwright');
      if (!fs.existsSync(pwBin)) return resolve();
      const proc = spawn(pwBin, ['install', 'chromium', '--with-deps'], {
        cwd: RUNTIME_DIR,
        stdio: 'inherit',
        env: { ...process.env },
        shell: IS_WIN,
      });
      // --with-deps pode falhar em hosts sem sudo; tentamos sem deps no fallback
      proc.on('close', code => {
        if (code === 0) return resolve();
        const proc2 = spawn(pwBin, ['install', 'chromium'], {
          cwd: RUNTIME_DIR, stdio: 'inherit', env: { ...process.env }, shell: IS_WIN,
        });
        proc2.on('close', c => c === 0 ? resolve() : reject(new Error('playwright install chromium falhou: ' + c)));
        proc2.on('error', reject);
      });
      proc.on('error', reject);
    });
    entry = resolvePlaywrightModule();
    if (!entry) throw new Error('Playwright instalou mas o módulo não foi encontrado em ' + RUNTIME_DIR);
    console.log('[mazyui] Playwright pronto.');
  }
  // Playwright é CJS — quando importado via ESM, os browsers (chromium,
  // firefox, …) ficam em `.default`. Normalizamos pra ter `chromium` sempre.
  const mod = await import(new URL('file://' + entry).href);
  PLAYWRIGHT = mod.chromium ? mod : (mod.default || mod);
  return PLAYWRIGHT;
}

async function getBrowser() {
  if (PLAYWRIGHT_BROWSER && PLAYWRIGHT_BROWSER.isConnected()) return PLAYWRIGHT_BROWSER;
  const pw = await ensurePlaywright();
  PLAYWRIGHT_BROWSER = await pw.chromium.launch({ headless: true });
  return PLAYWRIGHT_BROWSER;
}

// Descobre as dimensões certas pro screenshot olhando primeiro o HTML
// (`.slide { width: X; height: Y }`), depois a pasta pai (`instagram/`,
// `stories/`, …), depois cai no default 1080×1350.
function inferDims(htmlAbs, htmlSource, override) {
  if (override && override.width && override.height) {
    return { width: Number(override.width), height: Number(override.height) };
  }
  // Tenta extrair do CSS inline: `.slide { width: 1080px; height: 1350px }`
  const m = /\.slide\s*\{[^}]*?width\s*:\s*(\d+)px[^}]*?height\s*:\s*(\d+)px/i.exec(htmlSource || '');
  if (m) return { width: +m[1], height: +m[2] };
  // Tenta achar pelo nome da pasta pai
  const parent = path.basename(path.dirname(htmlAbs));
  if (FORMAT_DIMS[parent]) return FORMAT_DIMS[parent];
  return { width: 1080, height: 1350 };
}

async function renderHtmlToPng(htmlAbs, pngAbs, dimsOverride) {
  const html = fs.readFileSync(htmlAbs, 'utf8');
  const { width, height } = inferDims(htmlAbs, html, dimsOverride);

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  try {
    // file:// dá ao HTML acesso a fotos relativas (foto-*.png) sem proxy.
    await page.goto('file://' + htmlAbs, { waitUntil: 'networkidle' });
    // Espera fontes carregarem — sem isso o screenshot pode pegar fallback.
    try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
    // Se houver um `.slide` raiz, screenshota ele; senão, screenshota viewport.
    const elem = await page.$('.slide');
    if (elem) {
      await elem.screenshot({ path: pngAbs, type: 'png', omitBackground: false });
    } else {
      await page.screenshot({ path: pngAbs, type: 'png', fullPage: false, clip: { x:0, y:0, width, height } });
    }
  } finally {
    await ctx.close();
  }
  return { width, height };
}

// Resolve o destino do PNG: `<dirDoHtml>/imagens/<W>x<H>/<slide>.png`. Cria
// as pastas se faltarem. Inferimos dims a partir do próprio HTML (override
// vence se vier do cliente).
function pngTargetForHtml(htmlAbs, dims) {
  const dir = path.dirname(htmlAbs);
  const base = path.basename(htmlAbs).replace(/\.html?$/i, '.png');
  const sizeDir = `${dims.width}x${dims.height}`;
  const target = path.join(dir, 'imagens', sizeDir, base);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return target;
}

async function handleRenderSlide(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const { htmlPath, width, height } = body || {};
    if (!htmlPath) return json(res, 400, { error: 'htmlPath obrigatório' });
    if (!/\.html?$/i.test(htmlPath)) return json(res, 400, { error: 'htmlPath precisa ser .html' });
    const htmlAbs = safeResolve(htmlPath);
    if (!fs.existsSync(htmlAbs)) return json(res, 404, { error: 'HTML não encontrado' });
    const htmlSrc = fs.readFileSync(htmlAbs, 'utf8');
    const dims = inferDims(htmlAbs, htmlSrc, { width, height });
    const pngAbs = pngTargetForHtml(htmlAbs, dims);
    const t0 = Date.now();
    await renderHtmlToPng(htmlAbs, pngAbs, dims);
    const pngRel = path.relative(ROOT, pngAbs).replace(/\\/g, '/');
    json(res, 200, { ok: true, pngPath: pngRel, ms: Date.now() - t0, ...dims });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}

// Renderiza todos os slide-*.html de um item (ou de um formato específico)
// e devolve progresso via SSE. O cliente abre como EventSource — não usamos
// fetch streaming porque o front já tem helpers SSE.
async function handleRenderCarrossel(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch { return json(res, 400, { error: 'JSON inválido' }); }
  const { folder, name } = body || {};
  if (!folder && !name) return json(res, 400, { error: 'folder ou name obrigatório' });

  // Resolve qual pasta varrer. Se `folder` vier (ex: marketing/.../instagram),
  // varremos só ela. Se vier `name`, varremos a pasta do item e todos os
  // subdiretórios de formato.
  const targets = [];
  try {
    if (folder) {
      const abs = safeResolve(folder);
      if (!fs.existsSync(abs)) return json(res, 404, { error: 'pasta não encontrada' });
      targets.push(abs);
    } else {
      const itemAbs = safeResolve(path.posix.join('marketing/conteudo', name));
      if (!fs.existsSync(itemAbs)) return json(res, 404, { error: 'item não encontrado' });
      for (const fmt of FORMAT_DIRS) {
        const fa = path.join(itemAbs, fmt);
        if (fs.existsSync(fa)) targets.push(fa);
      }
      // Se nenhum subdir de formato, tenta a raiz do item.
      if (!targets.length) targets.push(itemAbs);
    }
  } catch (e) {
    return json(res, 400, { error: String(e.message || e) });
  }

  // Coleta todos os HTMLs antes de começar (pra contagem total exata).
  const jobs = [];
  for (const dir of targets) {
    for (const f of listFiles(dir, /^slide-.*\.html$/i)) {
      jobs.push(path.join(dir, f));
    }
  }

  // SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => {
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
  };
  send('boot', { total: jobs.length });

  let done = 0;
  let failed = 0;
  for (const htmlAbs of jobs) {
    const htmlRel = path.relative(ROOT, htmlAbs).replace(/\\/g, '/');
    try {
      const htmlSrc = fs.readFileSync(htmlAbs, 'utf8');
      const dims = inferDims(htmlAbs, htmlSrc, null);
      const pngAbs = pngTargetForHtml(htmlAbs, dims);
      const t0 = Date.now();
      await renderHtmlToPng(htmlAbs, pngAbs, dims);
      done++;
      const pngRel = path.relative(ROOT, pngAbs).replace(/\\/g, '/');
      send('progress', { done, total: jobs.length, htmlPath: htmlRel, pngPath: pngRel, ms: Date.now() - t0 });
    } catch (e) {
      failed++;
      send('error', { htmlPath: htmlRel, message: String(e.message || e) });
    }
  }
  send('done', { rendered: done, failed, total: jobs.length });
  res.end();
}

async function handleUpload(req, res) {
  try {
    const raw = await readRawBody(req, UPLOAD_MAX_BYTES + 1024 * 1024);
    let body;
    try { body = JSON.parse(raw.toString('utf8')); }
    catch { return json(res, 400, { error: 'JSON inválido' }); }

    const { name, dataUrl } = body;
    if (!dataUrl || typeof dataUrl !== 'string') {
      return json(res, 400, { error: 'dataUrl obrigatório' });
    }
    const m = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return json(res, 400, { error: 'dataUrl inválido' });
    const mime = m[1].toLowerCase();
    const ext = UPLOAD_EXT[mime];
    if (!ext) return json(res, 400, { error: 'tipo não suportado: ' + mime });

    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > UPLOAD_MAX_BYTES) {
      return json(res, 413, { error: 'imagem maior que 20MB' });
    }

    const uploadsDir = path.join(ROOT, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const baseRaw = (typeof name === 'string' ? name : '').replace(/\.[^.]+$/, '');
    const safeBase = baseRaw
      .normalize('NFKD').replace(/\p{M}/gu, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'img';
    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const rand = Math.random().toString(36).slice(2, 8);
    const filename = `${ts}_${rand}_${safeBase}${ext}`;
    const abs = path.join(uploadsDir, filename);
    fs.writeFileSync(abs, buf);

    const rel = `uploads/${filename}`;
    json(res, 200, { ok: true, path: rel, size: buf.length, mime });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}

// ============================================================
// Roteamento — tabela única que internas e extensões populam
// Match por (método, path) exato ou por prefixo wildcard (path termina em
// "/*"). Primeira ocorrência ganha; internas registradas antes não podem
// ser sobrescritas pela extensão local.
// ============================================================
const routes = [];

function addRoute(method, p, handler) {
  if (typeof method !== 'string' || typeof p !== 'string' || typeof handler !== 'function') {
    throw new Error('addRoute(method, path, handler): tipos inválidos');
  }
  const wildcard = p.endsWith('/*');
  const prefix   = wildcard ? p.slice(0, -1) : null; // '/mazyui-ui/' para '/mazyui-ui/*'
  routes.push({ method: method.toUpperCase(), path: p, prefix, wildcard, handler });
}

function handleRoot(req, res) {
  const file = path.join(ROOT, 'mazyui-ui.html');
  if (!fs.existsSync(file)) return text(res, 404, 'mazyui-ui.html não encontrado');
  const html = renderBrand(fs.readFileSync(file, 'utf8'));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

// ── Legacy endpoints: aposentados na Onda 2 (modular-ui-litHtml) ──────────
// A UI foi modularizada em /mazyui-ui/. Estes paths não existem mais.
const LEGACY_GONE_BODY =
  '410 Gone — Este endpoint foi descontinuado. A UI foi modularizada em /mazyui-ui/. Recarregue a página com Ctrl+Shift+R.';

function handleLegacyGone(req, res) {
  res.writeHead(410, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(LEGACY_GONE_BODY);
}

// ── Handler estático para /mazyui-ui/* ─────────────────────────────────────
// Serve arquivos sob ROOT/mazyui-ui/ sem aplicar renderBrand (a UI modular
// não usa placeholders {{BRAND_*}} — cada módulo busca /api/state quando
// precisa de dados da marca).
function handleUiStatic(req, res, url) {
  try {
    // Remove o prefixo '/mazyui-ui/' para obter o subpath relativo
    const subpath = url.pathname.slice('/mazyui-ui/'.length);
    // Rejeita path vazio ou com segmentos suspeitos antes de resolver
    if (!subpath) return text(res, 404, 'Não encontrado');
    const abs = path.resolve(ROOT, 'mazyui-ui', subpath);
    // Validação de path traversal: abs deve estar dentro de ROOT/mazyui-ui/
    const uiRoot = path.resolve(ROOT, 'mazyui-ui');
    if (!abs.startsWith(uiRoot + path.sep) && abs !== uiRoot) {
      return text(res, 403, '403 Forbidden');
    }
    if (!fs.existsSync(abs)) return text(res, 404, 'Não encontrado');
    const st = fs.statSync(abs);
    if (!st.isFile()) return text(res, 404, 'Não encontrado');
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    text(res, 500, String(e.message || e));
  }
}

// Servido com onerror silencioso pelo <script> da UI — 404 quando o cliente
// não tem extensão; conteúdo do arquivo quando tem.
function handleLocalUi(req, res) {
  const file = path.join(ROOT, 'local-ui.js');
  if (!fs.existsSync(file)) return text(res, 404, 'sem local-ui.js');
  res.writeHead(200, {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
}

addRoute('GET',  '/',                    handleRoot);
addRoute('GET',  '/index.html',          handleRoot);
addRoute('GET',  '/mazyui-ui/*',          handleUiStatic);   // modular UI (Onda 2)
addRoute('GET',  '/mazyui-ui.css',        handleLegacyGone); // 410 — descontinuado
addRoute('GET',  '/mazyui-ui.js',         handleLegacyGone); // 410 — descontinuado
addRoute('GET',  '/local-ui.js',         handleLocalUi);
addRoute('GET',  '/api/state',           handleState);
addRoute('POST', '/api/save',            handleSave);
addRoute('POST', '/api/delete-file',     handleDeleteFile);
addRoute('GET',  '/api/file',            (req, res, url) => handleFile(req, res, url));
addRoute('POST', '/api/run',             handleRun);
addRoute('POST', '/api/cancel',          handleCancel);
addRoute('POST', '/api/shutdown',        handleShutdown);
addRoute('POST', '/api/restart',         handleRestart);
addRoute('POST', '/api/open-folder',     handleOpenFolder);
addRoute('POST', '/api/upload',          handleUpload);
addRoute('POST', '/api/snapshot-siblings', handleSnapshotSiblings);
addRoute('POST', '/api/restore-siblings',  handleRestoreSiblings);
addRoute('POST', '/api/render-slide',      handleRenderSlide);
addRoute('POST', '/api/render-carrossel',  handleRenderCarrossel);

// ============================================================
// Hook de extensão: carrega ./local-routes.mjs se existir
// ============================================================
async function loadLocalRoutes() {
  const localPath = path.join(ROOT, 'local-routes.mjs');
  if (!fs.existsSync(localPath)) return;
  try {
    // file:// URL pra import dinâmico funcionar bem em windows também
    const mod = await import(new URL('file://' + localPath).href);
    if (typeof mod.register !== 'function') {
      console.warn('[mazyui] local-routes.mjs existe mas não exporta register({...}). Ignorando.');
      return;
    }
    mod.register({
      ROOT,
      helpers: { json, text, readBody, safeResolve, readSafe },
      addRoute,
    });
    console.log('[mazyui] local-routes.mjs carregado.');
  } catch (e) {
    console.error('[mazyui] Erro carregando local-routes.mjs — extensão ignorada:', e.message);
  }
}

// ============================================================
// Server
// ============================================================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const method = req.method;

  try {
    for (const r of routes) {
      if (r.method !== method) continue;
      const match = r.wildcard
        ? (p === r.prefix.slice(0, -1) || p.startsWith(r.prefix))
        : r.path === p;
      if (match) return r.handler(req, res, url);
    }
    text(res, 404, 'Não encontrado');
  } catch (e) {
    text(res, 500, 'Erro: ' + (e.message || e));
  }
});

await loadLocalRoutes();

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ${brand.consoleLabel}`);
  console.log(`  → http://localhost:${PORT}\n`);
});

process.on('SIGINT', () => {
  for (const proc of activeRuns.values()) {
    try { proc.kill(); } catch {}
  }
  process.exit(0);
});
