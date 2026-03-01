import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTestServer, readJsonl } from './helpers.js';

test('duplicates-only cleanup removes only duplicates and creates backup', async (t) => {
  process.env.ADMIN_TOKEN = 'admin-token';
  const ctx = await createTestServer();
  t.after(async () => ctx.close());

  const dataFile = ctx.paths.healthDataFile;
  const dupA = { type: 'steps', timestamp: '2026-02-19T10:00:00Z', data: { steps: 10 } };
  const uniq = { type: 'hr', timestamp: '2026-02-19T10:05:00Z', data: { bpm: 70 } };

  await fs.writeFile(dataFile, `${JSON.stringify(dupA)}\n${JSON.stringify(dupA)}\n${JSON.stringify(uniq)}\n`, 'utf8');

  const previewResp = await ctx.request('/admin/cleanup/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': 'admin-token' },
    body: JSON.stringify({ mode: 'duplicates-only' }),
  });
  assert.equal(previewResp.status, 200);
  assert.equal(previewResp.body.matched, 1);

  const execResp = await ctx.request('/admin/cleanup/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': 'admin-token' },
    body: JSON.stringify({ mode: 'duplicates-only', confirm: true }),
  });
  assert.equal(execResp.status, 200);
  assert.equal(execResp.body.removed, 1);
  assert.ok(execResp.body.backupPath);

  const remaining = await readJsonl(dataFile);
  assert.equal(remaining.length, 2);

  const backupExists = await fs.access(execResp.body.backupPath).then(() => true).catch(() => false);
  assert.equal(backupExists, true);
});
