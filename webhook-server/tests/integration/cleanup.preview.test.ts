import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTestServer } from './helpers.js';

test('cleanup preview is non-destructive', async (t) => {
  process.env.ADMIN_TOKEN = 'admin-token';
  const ctx = await createTestServer();
  t.after(async () => ctx.close());

  const dataFile = ctx.paths.healthDataFile;
  const item = { type: 'steps', timestamp: '2026-02-19T09:00:00Z', data: { steps: 1000 } };
  await fs.writeFile(dataFile, `${JSON.stringify(item)}\n${JSON.stringify(item)}\n`, 'utf8');

  const before = await fs.readFile(dataFile, 'utf8');
  const resp = await ctx.request('/admin/cleanup/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': 'admin-token' },
    body: JSON.stringify({ mode: 'duplicates-only' }),
  });

  assert.equal(resp.status, 200);
  assert.equal(resp.body.preview, true);
  assert.equal(resp.body.matched, 1);

  const after = await fs.readFile(dataFile, 'utf8');
  assert.equal(after, before);
});
