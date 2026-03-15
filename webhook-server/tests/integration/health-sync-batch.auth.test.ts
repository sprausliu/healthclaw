import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from './helpers.js';

test('batch endpoint rejects unauthenticated requests', async (t) => {
  const ctx = await createTestServer();
  t.after(() => ctx.close());

  const res = await ctx.request('/api/health-sync/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ type: 'steps', timestamp: '2026-02-19T00:00:00Z', data: { count: 1 } }],
    }),
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Missing API token');
});
