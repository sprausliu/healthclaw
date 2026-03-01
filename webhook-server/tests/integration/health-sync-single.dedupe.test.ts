import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTestServer, pairDevice } from './helpers.js';

test('single endpoint returns inserted then duplicate for replayed payload', async (t) => {
  const ctx = await createTestServer();
  t.after(async () => ctx.close());

  const token = await pairDevice(ctx.request);
  const payload = {
    type: 'steps',
    timestamp: '2026-02-19T12:00:00Z',
    data: { count: 1200 },
  };

  const first = await ctx.request('/api/health-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'inserted');

  const second = await ctx.request('/api/health-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
    body: JSON.stringify(payload),
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.status, 'duplicate');

  const lines = (await fs.readFile(ctx.paths.healthDataFile, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
});
