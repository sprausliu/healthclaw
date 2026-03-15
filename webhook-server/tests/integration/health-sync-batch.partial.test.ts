import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, pairDevice, readJsonl } from './helpers.js';

test('batch endpoint returns partial success for invalid subset', async (t) => {
  const ctx = await createTestServer();
  t.after(() => ctx.close());

  const token = await pairDevice(ctx.request);

  const res = await ctx.request('/api/health-sync/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
    body: JSON.stringify({
      items: [
        { type: 'steps', timestamp: '2026-02-19T09:00:00Z', data: { count: 100 } },
        { type: 'steps', timestamp: 'not-a-date', data: { count: 101 } },
        { type: 'sleep', timestamp: '2026-02-19T10:00:00Z', data: { duration: 123 } },
      ],
    }),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, false);
  assert.equal(res.body.total, 3);
  assert.equal(res.body.inserted, 2);
  assert.equal(res.body.failed, 1);
  assert.equal(res.body.errors.length, 1);
  assert.equal(res.body.errors[0].index, 1);
  assert.equal(res.body.errors[0].code, 'INVALID_TIMESTAMP');

  const records = await readJsonl(ctx.paths.healthDataFile);
  assert.equal(records.length, 2);
});
