import { verifiedRecords } from './verified-records.mjs';
const API_BASE = 'https://technocore.chat';
export const DID_PATTERN = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;
const cache = new Map(); const CACHE_MS = 60_000;
export function normalizePublicUrl(value) { const parsed = new URL(value.trim()); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('A public http(s) URL is required.'); parsed.hash = ''; parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'; return parsed.toString(); }
function urlsIn(text) { return (text.match(/https?:\/\/[^\s<>"']+/gi) || []).map((url) => url.replace(/[),.;!?\]]+$/, '')).flatMap((url) => { try { return [normalizePublicUrl(url)]; } catch { return []; } }); }
function matchingRecord(record, did, url) { return record.room === 'technocore' && record.did === did && record.nonce != null && urlsIn(record.text || record.url || '').includes(url); }
function archivedRecordFor(did, url) { return verifiedRecords.find((record) => matchingRecord(record, did, url)) || null; }
async function recentRecords() { const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000); try { const response = await fetch(`${API_BASE}/r/technocore?format=json&limit=200`, { headers: { Accept: 'application/json' }, signal: controller.signal }); if (!response.ok) throw new Error(`Technocore returned ${response.status}`); const payload = await response.json(); return (payload.messages || []).map((message) => ({ ...message, room: 'technocore', did: message.from, sequence: message.seq, recordedAt: message.ts })); } finally { clearTimeout(timeout); } }
function publicRecord(record, source) { return { room: record.room, sequence: record.sequence, recordedAt: record.recordedAt, did: record.did, url: urlsIn(record.text || record.url || '')[0] || record.url, source }; }
export async function verifyContribution(did, rawUrl) {
  if (!DID_PATTERN.test(did)) throw new Error('A valid did:key is required.'); const url = normalizePublicUrl(rawUrl); const cacheKey = `${did}|${url}`; const cached = cache.get(cacheKey); if (cached && Date.now() - cached.created < CACHE_MS) return cached.data;
  let matched = archivedRecordFor(did, url); let source = 'project archive';
  if (!matched) { try { matched = (await recentRecords()).find((record) => matchingRecord(record, did, url)) || null; source = 'live Technocore feed'; } catch { const data = { verified: false, lookup: 'CHECK UNAVAILABLE', summary: 'The live Technocore record check is temporarily unavailable. Please try again.' }; cache.set(cacheKey, { created: Date.now(), data }); return data; } }
  const data = matched ? { verified: true, lookup: 'RECORD FOUND', record: publicRecord(matched, source) } : { verified: false, lookup: 'NO MATCH FOUND', summary: 'No matching signed Technocore contribution record was found for this DID and link.' }; cache.set(cacheKey, { created: Date.now(), data }); return data;
}
