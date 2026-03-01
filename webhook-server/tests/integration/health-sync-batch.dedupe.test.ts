import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTestServer, pairDevice } from './helpers.js';

test('batch endpoint reports duplicates for in-batch and replay duplicates', async (t) => {
  const ctx = await createTestServer();
  t.after(async () => ctx.close());

  const token = await pairDevice(ctx.request);
  const batch = {
    items: [
      { type: 'steps', timestamp: '2026-02-19T12:00:00Z', data: { count: 100 } },
      { type: 'steps', timestamp: '2026-02-19T12:05:00Z', data: { count: 110 } },
      { type: 'steps', timestamp: '2026-02-19T12:00:00Z', data: { count: 100 } },
    ],
  };

  const first = await ctx.request('/api/health-sync/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
    body: JSON.stringify(batch),
  });

  assert.equal(first.status, 200);
  assert.deepEqual(
    { inserted: first.body.inserted, duplicates: first.body.duplicates, failed: first.body.failed },
    { inserted: 2, duplicates: 1, failed: 0 }
  );

  const replay = await ctx.request('/api/health-sync/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
    body: JSON.stringify(batch),
  });

  assert.equal(replay.status, 200);
  assert.deepEqual(
    { inserted: replay.body.inserted, duplicates: replay.body.duplicates, failed: replay.body.failed },
    { inserted: 0, duplicates: 3, failed: 0 }
  );

  const lines = (await fs.readFile(ctx.paths.healthDataFile, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);
});
