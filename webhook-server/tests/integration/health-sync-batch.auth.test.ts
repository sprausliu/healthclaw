import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../src/index.js';

test('batch endpoint rejects unauthenticated requests', async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hc-batch-auth-'));
  const app = await createApp({
    dataDir: tmp,
    repoRoot: tmp,
  });

  const res = await request(app)
    .post('/api/health-sync/batch')
    .send({ items: [{ type: 'steps', timestamp: '2026-02-19T00:00:00Z', data: { count: 1 } }] });

  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Missing API token');

  app.locals.dedupeRepository.close();
});
