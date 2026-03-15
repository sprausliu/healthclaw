import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, pairDevice } from './helpers.js';

test('POST /api/health-sync: missing required field returns 400', async (t) => {
  const { request, close } = await createTestServer();
  t.after(() => close());
  const apiToken = await pairDevice(request);

  // Missing 'data' field
  const res = await request('/api/health-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': apiToken,
    },
    body: JSON.stringify({
      type: 'steps',
      timestamp: '2026-02-24T10:00:00Z',
      // Missing 'data'
    }),
  });

  assert.equal(res.status, 400);
  assert.ok(res.body.errors);
  assert.ok(res.body.errors.fieldErrors.data);
});

test('POST /api/health-sync/batch: missing required field returns 400', async (t) => {
  const { request, close } = await createTestServer();
  t.after(() => close());
  const apiToken = await pairDevice(request);

  // Missing 'items' field
  const res = await request('/api/health-sync/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': apiToken,
    },
    body: JSON.stringify({
      clientRequestId: 'test-123',
      // Missing 'items'
    }),
  });

  assert.equal(res.status, 400);
  assert.ok(res.body.errors);
  assert.ok(res.body.errors.fieldErrors.items);
});

test('POST /api/pair: missing deviceInfo returns 200 (optional field)', async (t) => {
  const { request, close } = await createTestServer();
  t.after(() => close());

  const generated = await request('/admin/generate-pairing', { method: 'POST' });
  const pairToken = generated.body.pairingToken;

  // deviceInfo is optional, should succeed
  const res = await request(`/api/pair?token=${pairToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.success);
  assert.ok(res.body.permanentToken);
});

test('POST /api/health-sync: invalid timestamp format returns 400', async (t) => {
  const { request, close } = await createTestServer();
  t.after(() => close());
  const apiToken = await pairDevice(request);

  const res = await request('/api/health-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': apiToken,
    },
    body: JSON.stringify({
      type: 'steps',
      timestamp: 'not-a-valid-date',
      data: { count: 1000 },
    }),
  });

  assert.equal(res.status, 400);
  assert.ok(res.body.errors);
  assert.ok(res.body.errors.fieldErrors.timestamp);
});

test('POST /api/health-sync: empty type string returns 400', async (t) => {
  const { request, close } = await createTestServer();
  t.after(() => close());
  const apiToken = await pairDevice(request);

  const res = await request('/api/health-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': apiToken,
    },
    body: JSON.stringify({
      type: '',
      timestamp: '2026-02-24T10:00:00Z',
      data: { count: 1000 },
    }),
  });

  assert.equal(res.status, 400);
  assert.ok(res.body.errors);
  assert.ok(res.body.errors.fieldErrors.type);
});

test('POST /api/health-sync/batch: empty items array returns 400', async (t) => {
  const { request, close } = await createTestServer();
  t.after(() => close());
  const apiToken = await pairDevice(request);

  const res = await request('/api/health-sync/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': apiToken,
    },
    body: JSON.stringify({
      items: [], // Empty array not allowed (min 1)
    }),
  });

  assert.equal(res.status, 400);
  assert.ok(res.body.errors);
  assert.ok(res.body.errors.fieldErrors.items);
});
