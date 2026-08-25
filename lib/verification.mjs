const API_BASE = 'https://technocore.chat';
export const DID_PATTERN = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;
const cache = new Map(); const CACHE_MS = 60_000;
export function normalizePublicUrl(value) { const parsed = new URL(value.trim()); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('A public http(s) URL is required.'); parsed.hash = ''; parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'; return parsed.toString(); }
export function urlsIn(text) {
  const markdownUrls = [...text.matchAll(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gi)].map((match) => match[1]);
  const plainText = text.replace(/\[[^\]]*\]\(https?:\/\/[^\s)]+\)/gi, '');
  const plainUrls = plainText.match(/https?:\/\/[^\s<>"']+/gi) || [];
  return [...new Set([...markdownUrls, ...plainUrls]
    .map((url) => url.replace(/[),.;!?\]]+$/, ''))
    .flatMap((url) => { try { return [normalizePublicUrl(url)]; } catch { return []; } }))];
}
function matchingRecord(record, did, url) { return record.room === 'technocore' && record.did === did && record.nonce != null && urlsIn(record.text || record.url || '').includes(url); }
export async function recentRecords() { const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000); try { const response = await fetch(`${API_BASE}/r/technocore?format=json&limit=200`, { headers: { Accept: 'application/json' }, signal: controller.signal }); if (!response.ok) throw new Error(`Technocore returned ${response.status}`); const payload = await response.json(); return { firstSequence: payload.first_seq ?? null, lastSequence: payload.last_seq ?? null, messages: (payload.messages || []).map((message) => ({ ...message, room: 'technocore', did: message.from, sequence: message.seq, recordedAt: message.ts })) }; } finally { clearTimeout(timeout); } }
function publicRecord(record, source) { return { room: record.room, sequence: record.sequence, recordedAt: record.recordedAt, did: record.did, url: urlsIn(record.text || record.url || '')[0] || record.url, source }; }
export function archiveKey(did, url) { return `records/${encodeURIComponent(did)}/${encodeURIComponent(url)}`; }

export async function verifyContribution(did, rawUrl, archive = null) {
  if (!DID_PATTERN.test(did)) throw new Error('A valid did:key is required.'); const url = normalizePublicUrl(rawUrl); const cacheKey = `${did}|${url}`; const cached = cache.get(cacheKey); if (cached && Date.now() - cached.created < CACHE_MS) return cached.data;
  if (archive) {
    const archived = await archive.get(did, url);
    if (archived && matchingRecord(archived, did, url)) {
      const data = { verified: true, lookup: 'RECORD FOUND', record: publicRecord(archived, 'durable contribution archive') };
      cache.set(cacheKey, { created: Date.now(), data });
      return data;
    }
  }
  let room;
  try { room = await recentRecords(); } catch { const data = { verified: false, lookup: 'CHECK UNAVAILABLE', summary: 'The live Technocore record check is temporarily unavailable. Please try again.' }; cache.set(cacheKey, { created: Date.now(), data }); return data; }
  const matched = room.messages.find((record) => matchingRecord(record, did, url)) || null;
  const diagnostics = { endpoint: `${API_BASE}/r/technocore?format=json&limit=200`, room: 'technocore', firstSequence: room.firstSequence, lastSequence: room.lastSequence, returnedMessages: room.messages.length, matchingDidMessages: room.messages.filter((record) => record.did === did).length };
  console.info('technocore contribution lookup', JSON.stringify({ ...diagnostics, did, url, matchedSequence: matched?.sequence ?? null }));
  if (matched && archive) {
    try { await archive.put(matched, url); } catch (error) { console.error('technocore archive write failed', error); }
  }
  const data = matched ? { verified: true, lookup: 'RECORD FOUND', record: publicRecord(matched, 'live Technocore feed'), diagnostics } : { verified: false, lookup: 'NO MATCH FOUND', summary: 'No matching signed Technocore contribution record was found in the retained live Technocore feed.', diagnostics }; cache.set(cacheKey, { created: Date.now(), data }); return data;
}
