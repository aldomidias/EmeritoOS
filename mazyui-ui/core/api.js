// Onda 1.C — API server (fetch + SSE)
// Implementação portada de mazyui-ui.js:334-373 (REST) + :2834 (streamRun).

export async function apiState() {
  const r = await fetch('/api/state');
  if (!r.ok) throw new Error('falhou /api/state');
  return await r.json();
}

export async function apiSave(path, content) {
  const r = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!r.ok) throw new Error('falhou /api/save');
  return await r.json();
}

export async function apiShutdown() {
  try { await fetch('/api/shutdown', { method: 'POST' }); } catch {}
}

export async function apiRestart() {
  try { await fetch('/api/restart', { method: 'POST' }); } catch {}
}

export async function apiCancel(runId) {
  try {
    await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId }),
    });
  } catch {}
}

export async function openFolder(folder) {
  if (!folder) {
    // toast not available here without circular dep — caller handles UI
    return;
  }
  try {
    const r = await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folder }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || 'Não consegui abrir a pasta.');
    }
  } catch (err) {
    throw err;
  }
}

export function fileUrl(path) {
  return `/api/file?path=${encodeURIComponent(path)}`;
}

export async function streamRun(prompt, runId, onEvent, opts = {}) {
  const { sessionId = null, resumeSession = null, model = null } = opts;
  const r = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, runId, sessionId, resumeSession, model }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    let payload;
    try { payload = txt ? JSON.parse(txt) : null; } catch { payload = txt; }
    const msg = payload && typeof payload === 'object' && payload.error
      ? payload.error : `HTTP ${r.status}`;
    throw new Error(msg);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const blocks = buf.split('\n\n');
    buf = blocks.pop(); // último bloco pode estar incompleto
    for (const block of blocks) {
      const lines = block.split('\n');
      let event = 'message', data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data = line.slice(5).trim();
      }
      onEvent({ event, data });
    }
  }
}

// Genérico usado pelo ctx.api.call dos painéis.
// Semântica byte-a-byte de mazyui-ui.js:279-295.
export async function apiCall(method, path, body) {
  const opts = { method: (method || 'GET').toUpperCase(), headers: {} };
  if (body !== undefined && body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  const txt = await r.text();
  let payload;
  try { payload = txt ? JSON.parse(txt) : null; } catch { payload = txt; }
  if (!r.ok) {
    const msg = payload && typeof payload === 'object' && payload.error
      ? payload.error : `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return payload;
}
