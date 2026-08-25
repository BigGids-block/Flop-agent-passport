const API_BASE = 'https://technocore.chat';
const DID_PATTERN = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;
const cache = new Map();
const CACHE_MS = 60_000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function readRoom(room) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${API_BASE}/r/${room}?format=json&limit=200`, {
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
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

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const did = new URL(request.url).searchParams.get('did') || '';
  if (!DID_PATTERN.test(did)) return json({ error: 'A valid did:key is required.' }, 400);
  try { return json(await activityFor(did)); }
  catch { return json({ error: 'Technocore activity is temporarily unavailable.' }, 502); }
};
