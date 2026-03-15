import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createTestServer, pairDevice, readJsonl } from './helpers.js';

test('POST /admin/users creates a user and returns userId + token', async (t) => {
  process.env['ADMIN_TOKEN'] = 'test-admin';
  const ctx = await createTestServer();
  t.after(() => ctx.close());

  const res = await ctx.request('/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': 'test-admin' },
    body: JSON.stringify({ name: 'alice' }),
  });

  assert.equal(res.status, 201);
  assert.ok(res.body.userId);
  assert.ok(res.body.userId.startsWith('usr_'));
  assert.ok(res.body.token);
  assert.equal(typeof res.body.token, 'string');
  assert.equal(res.body.token.length, 64);
  assert.equal(res.body.name, 'alice');
  assert.ok(res.body.createdAt);
});

test('GET /admin/users lists users without tokens', async (t) => {
  process.env['ADMIN_TOKEN'] = 'test-admin';
  const ctx = await createTestServer();
  t.after(() => ctx.close());

  await ctx.request('/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': 'test-admin' },
    body: JSON.stringify({ name: 'bob' }),
  });

  const res = await ctx.request('/admin/users', {
    headers: { 'X-Admin-Token': 'test-admin' },
  });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].name, 'bob');
  assert.ok(res.body[0].userId);
  assert.ok(res.body[0].createdAt);
  assert.equal(res.body[0].token, undefined);
});

test('POST /admin/users requires x-admin-token (401 without it)', async (t) => {
  process.env['ADMIN_TOKEN'] = 'test-admin';
  const ctx = await createTestServer();
  t.after(() => ctx.close());

  const res = await ctx.request('/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'charlie' }),
  });

  assert.equal(res.status, 401);
});

test('health sync with user token writes to per-user path', async (t) => {
  process.env['ADMIN_TOKEN'] = 'test-admin';
  const ctx = await createTestServer();
  t.after(() => ctx.close());

  const createRes = await ctx.request('/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': 'test-admin' },
    body: JSON.stringify({ name: 'diana' }),
  });

  const { userId, token } = createRes.body;

  const syncRes = await ctx.request('/api/health-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
    body: JSON.stringify({
      type: 'steps',
      timestamp: '2026-03-15T10:00:00Z',
      data: { count: 5000 },
    }),
  });

  assert.equal(syncRes.status, 200);
  assert.equal(syncRes.body.status, 'inserted');

  // Data written to per-user path
  const userDataFile = path.join(ctx.dataDir, 'users', userId, 'health-data.jsonl');
  const records = await readJsonl(userDataFile);
  assert.equal(records.length, 1);
  assert.equal(records[0].type, 'steps');

  // Legacy path stays empty
  const legacyRecords = await readJsonl(ctx.paths.healthDataFile);
  assert.equal(legacyRecords.length, 0);
});

test('health sync with legacy token writes to legacy path (backward compat)', async (t) => {
  const ctx = await createTestServer();
  t.after(() => ctx.close());

  const token = await pairDevice(ctx.request);

  const syncRes = await ctx.request('/api/health-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
    body: JSON.stringify({
      type: 'heart-rate',
      timestamp: '2026-03-15T11:00:00Z',
      data: { bpm: 72 },
    }),
  });

  assert.equal(syncRes.status, 200);
  assert.equal(syncRes.body.status, 'inserted');

  const records = await readJsonl(ctx.paths.healthDataFile);
  assert.equal(records.length, 1);
  assert.equal(records[0].type, 'heart-rate');
});

test('health sync with invalid token returns 401', async (t) => {
  const ctx = await createTestServer();
  t.after(() => ctx.close());

  const res = await ctx.request('/api/health-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': 'totally-invalid-token' },
    body: JSON.stringify({
      type: 'steps',
      timestamp: '2026-03-15T12:00:00Z',
      data: { count: 100 },
    }),
  });

  assert.equal(res.status, 401);
});
