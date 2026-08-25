import { DID_PATTERN, urlsIn } from './verification.mjs';

export function validateHistoricalRecord(value) {
  if (!value || typeof value !== 'object') throw new Error('A record object is required.');
  const sequence = Number(value.sequence ?? value.seq);
  const recordedAt = value.recordedAt ?? value.ts;
  const did = value.did ?? value.from;
  const nonce = value.nonce;
  const text = value.text;
  if (value.room !== 'technocore') throw new Error('Only the technocore room can be imported.');
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error('A positive sequence number is required.');
  if (!DID_PATTERN.test(did)) throw new Error('A valid signed did:key is required.');
  if (nonce === undefined || nonce === null || String(nonce).length === 0) throw new Error('A signed record nonce is required.');
  if (typeof text !== 'string' || text.length === 0) throw new Error('The original signed record text is required.');
  if (Number.isNaN(new Date(recordedAt).valueOf())) throw new Error('A valid record timestamp is required.');
  if (urlsIn(text).length === 0) throw new Error('The signed record text must contain a public contribution URL.');
  return { room: 'technocore', sequence, recordedAt, did, nonce: String(nonce), text };
}
