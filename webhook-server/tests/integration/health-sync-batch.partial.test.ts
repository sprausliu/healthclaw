import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../../src/index.js';

test('batch endpoint returns partial success for invalid subset', async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hc-batch-partial-'));
  const app = await createApp({
    dataDir: tmp,
    repoRoot: tmp,
  });

  const pairToken = (await request(app).post('/admin/generate-pairing')).body.pairingToken;
  const apiToken = (await request(app).post(`/api/pair?token=${pairToken}`).send({})).body.permanentToken;

  const res = await request(app)
    .post('/api/health-sync/batch')
    .set('X-API-Token', apiToken)
    .send({
      items: [
        { type: 'steps', timestamp: '2026-02-19T09:00:00Z', data: { count: 100 } },
        { type: 'steps', timestamp: 'not-a-date', data: { count: 101 } },
        { type: 'sleep', timestamp: '2026-02-19T10:00:00Z', data: { duration: 123 } },
      ],
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, false);
  assert.equal(res.body.total, 3);
  assert.equal(res.body.inserted, 2);
  assert.equal(res.body.failed, 1);
  assert.equal(res.body.errors.length, 1);
  assert.equal(res.body.errors[0].index, 1);
  assert.equal(res.body.errors[0].code, 'INVALID_TIMESTAMP');

  const lines = (await fs.promises.readFile(app.locals.paths.healthDataFile, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);

  app.locals.dedupeRepository.close();
});
