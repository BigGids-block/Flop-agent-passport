import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = process.cwd();
const API_BASE = 'https://technocore.chat';
const DID_PATTERN = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;
const cache = new Map();
const CACHE_MS = 60_000;
const types = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readRoom(room) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${API_BASE}/r/${room}?format=json&limit=200`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Technocore returned ${response.status}`);
    const payload = await response.json();
    return (payload.messages || []).map((message) => ({ ...message, room }));
  } finally { clearTimeout(timeout); }
}

async function activityFor(did) {
  const cached = cache.get(did);
  if (cached && Date.now() - cached.created < CACHE_MS) return cached.data;
  const messages = (await Promise.all(['lobby', 'technocore'].map(readRoom))).flat();
  const signedMessages = messages.filter((message) => message.from === did);
  const contributions = signedMessages.filter((message) => message.room === 'technocore' && /https?:\/\/\S+/i.test(message.text));
  const rooms = new Set(signedMessages.map((message) => message.room));
  const contributionText = `${contributions.length} ${contributions.length === 1 ? 'CONTRIBUTION' : 'CONTRIBUTIONS'}`;
  const data = {
    activity: contributions.length ? contributionText : `${signedMessages.length} SIGNED MESSAGES`,
    firstSeen: signedMessages.map((message) => message.ts).sort()[0] || null,
    lookup: contributions.length ? 'ACTIVITY FOUND' : signedMessages.length ? 'SIGNED ACTIVITY' : 'NO ACTIVITY',
    status: contributions.length ? 'VERIFIED PUBLIC CONTRIBUTION' : signedMessages.length ? 'SIGNED ACTIVITY FOUND' : 'NO SIGNED ACTIVITY FOUND',
    summary: contributions.length
      ? `${contributionText.toLowerCase()} announced from ${rooms.size} Technocore ${rooms.size === 1 ? 'room' : 'rooms'}.`
      : signedMessages.length ? `Signed activity found in ${rooms.size} Technocore ${rooms.size === 1 ? 'room' : 'rooms'}.` : 'No public signed activity was found in the checked rooms.',
  };
  cache.set(did, { created: Date.now(), data });
  return data;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/activity') {
    const did = url.searchParams.get('did') || '';
    if (!DID_PATTERN.test(did)) return send(res, 400, { error: 'A valid did:key is required.' });
    try { return send(res, 200, await activityFor(did)); }
    catch { return send(res, 502, { error: 'Technocore activity is temporarily unavailable.' }); }
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const path = normalize(join(ROOT, requested));
  if (!path.startsWith(ROOT)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  try {
    const file = await stat(path);
    if (!file.isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    createReadStream(path).pipe(res);
  } catch { send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
}).listen(PORT, HOST, () => console.log(`Agent Passport running at http://localhost:${PORT}`));
