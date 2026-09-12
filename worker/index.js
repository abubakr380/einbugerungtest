import { cleanDocument, emptyDocument, mergeDocuments, normalizeUsername } from '../progress-model.js';

const MAX_BYTES = 256 * 1024;
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
    if (origin && !allowed.includes(origin)) return Response.json({ error: 'Origin not allowed' }, { status: 403, headers });
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (body, status = 200) => Response.json(body, { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      try { await env.DB.prepare('SELECT 1 FROM profiles LIMIT 1').first(); return reply({ ok: true }); }
      catch { return reply({ error: 'Storage unavailable' }, 503); }
    }
    const match = /^\/api\/progress\/([^/]+)$/.exec(url.pathname);
    if (!match) return reply({ error: 'Not found' }, 404);
    if (!['GET', 'PUT'].includes(request.method)) return reply({ error: 'Method not allowed' }, 405);
    let name, incoming;
    try {
      name = normalizeUsername(decodeURIComponent(match[1]));
      if (request.method === 'PUT') {
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply({ error: 'JSON required' }, 415);
        if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return reply({ error: 'Profile too large' }, 413);
        const reader = request.body?.getReader();
        if (!reader) return reply({ error: 'Missing body' }, 400);
        const chunks = []; let size = 0;
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.length;
          if (size > MAX_BYTES) { await reader.cancel(); return reply({ error: 'Profile too large' }, 413); }
          chunks.push(value);
        }
        const body = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
        incoming = cleanDocument(JSON.parse(new TextDecoder().decode(body)));
      }
    } catch { return reply({ error: 'Invalid username or progress' }, 400); }
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name)))].map(n => n.toString(16).padStart(2, '0')).join('');
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const row = await env.DB.prepare('SELECT data, revision FROM profiles WHERE profile_key = ?').bind(hash).first();
        const current = row ? cleanDocument(JSON.parse(row.data)) : emptyDocument();
        if (request.method === 'GET') return reply({ progress: current });
        const progress = mergeDocuments(current, incoming), data = JSON.stringify(progress);
        if (new TextEncoder().encode(data).length > MAX_BYTES) return reply({ error: 'Profile too large' }, 413);
        // Unchanged retries and foreground refreshes consume no writes.
        if (row && data === row.data) return reply({ progress });
        const result = row
          ? await env.DB.prepare('UPDATE profiles SET data = ?, revision = revision + 1, updated_at = ? WHERE profile_key = ? AND revision = ?').bind(data, new Date().toISOString(), hash, row.revision).run()
          : await env.DB.prepare('INSERT OR IGNORE INTO profiles (profile_key, data, revision, updated_at) VALUES (?, ?, 1, ?)').bind(hash, data, new Date().toISOString()).run();
        if (result.meta.changes) return reply({ progress });
      }
      return reply({ error: 'Busy; retry sync' }, 409);
    } catch { return reply({ error: 'Storage unavailable; keep local progress and retry' }, 503); }
  }
};
