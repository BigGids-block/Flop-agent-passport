import { getStore } from '@netlify/blobs';
import { archiveKey, urlsIn } from '../../lib/verification.mjs';
import { validateHistoricalRecord } from '../../lib/historical-record.mjs';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const token = process.env.HISTORICAL_IMPORT_TOKEN;
  if (!token) return json({ error: 'Historical import is not configured.' }, 503);
  if (request.headers.get('authorization') !== `Bearer ${token}`) return json({ error: 'Unauthorized.' }, 401);
  try {
    const record = validateHistoricalRecord(await request.json());
    const store = getStore('technocore-contribution-records');
    const urls = urlsIn(record.text);
    for (const url of urls) await store.set(archiveKey(record.did, url), JSON.stringify(record));
    console.info('historical Technocore record imported', JSON.stringify({ room: record.room, sequence: record.sequence, did: record.did, urls }));
    return json({ imported: true, room: record.room, sequence: record.sequence, did: record.did, urls });
  } catch (error) {
    return json({ error: error.message || 'The historical record could not be imported.' }, 400);
  }
};
