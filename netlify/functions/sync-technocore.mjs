import { getStore } from '@netlify/blobs';
import { DID_PATTERN, archiveKey, recentRecords, urlsIn } from '../../lib/verification.mjs';

export default async () => {
  const store = getStore('technocore-contribution-records');
  const room = await recentRecords();
  let stored = 0;
  for (const record of room.messages) {
    if (!DID_PATTERN.test(record.did) || record.nonce == null) continue;
    for (const url of urlsIn(record.text)) {
      await store.set(archiveKey(record.did, url), JSON.stringify(record));
      stored += 1;
    }
  }
  console.info('technocore contribution sync', JSON.stringify({ room: 'technocore', firstSequence: room.firstSequence, lastSequence: room.lastSequence, stored }));
  return new Response(null, { status: 204 });
};

export const config = { schedule: '* * * * *' };
