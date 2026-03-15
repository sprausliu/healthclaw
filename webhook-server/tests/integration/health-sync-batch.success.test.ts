import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, pairDevice, readJsonl } from './helpers.js';

test('batch endpoint ingests valid records successfully', async (t) => {
  const ctx = await createTestServer();
  t.after(() => ctx.close());

  const token = await pairDevice(ctx.request);

  const res = await ctx.request('/api/health-sync/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
    body: JSON.stringify({
      items: [
        { type: 'steps', timestamp: '2026-02-19T09:00:00Z', data: { count: 1200 } },
        { type: 'heart-rate', timestamp: '2026-02-19T09:01:00Z', data: { bpm: 76 } },
      ],
    }),
  });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    success: true,
    total: 2,
    inserted: 2,
    duplicates: 0,
    failed: 0,
    errors: [],
  });

  const records = await readJsonl(ctx.paths.healthDataFile);
  assert.equal(records.length, 2);
});
