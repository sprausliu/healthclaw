import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../../src/index.js';

async function setup() {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hc-batch-success-'));
  const app = await createApp({
    dataDir: tmp,
    repoRoot: tmp,
  });

  const pairRes = await request(app).post('/admin/generate-pairing');
  const token = pairRes.body.pairingToken;
  const pairDone = await request(app).post(`/api/pair?token=${token}`).send({ deviceInfo: { model: 'test' } });

  return {
    app,
    apiToken: pairDone.body.permanentToken,
    cleanup: () => app.locals.dedupeRepository.close(),
    dataFile: app.locals.paths.healthDataFile
  };
}

test('batch endpoint ingests valid records successfully', async () => {
  const { app, apiToken, cleanup, dataFile } = await setup();

  const res = await request(app)
    .post('/api/health-sync/batch')
    .set('X-API-Token', apiToken)
    .send({
      items: [
        { type: 'steps', timestamp: '2026-02-19T09:00:00Z', data: { count: 1200 } },
        { type: 'heart-rate', timestamp: '2026-02-19T09:01:00Z', data: { bpm: 76 } },
      ],
    });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    success: true,
    total: 2,
    inserted: 2,
    duplicates: 0,
    failed: 0,
    errors: [],
  });

  const lines = (await fs.promises.readFile(dataFile, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);

  cleanup();
});
