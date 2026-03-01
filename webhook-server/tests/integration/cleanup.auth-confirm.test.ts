import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from './helpers.js';

test('cleanup execute requires admin token and confirm=true', async (t) => {
  process.env.ADMIN_TOKEN = 'admin-token';
  const ctx = await createTestServer();
  t.after(async () => ctx.close());

  const noAuth = await ctx.request('/admin/cleanup/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'duplicates-only', confirm: true }),
  });
  assert.equal(noAuth.status, 401);

  const noConfirm = await ctx.request('/admin/cleanup/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': 'admin-token' },
    body: JSON.stringify({ mode: 'duplicates-only' }),
  });
  assert.equal(noConfirm.status, 400);
});
