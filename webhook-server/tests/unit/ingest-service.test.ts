import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingest, type IngestDeps } from '../../src/services/ingest-service.js';

const noOpUpdate = async () => {};

test('ingest: valid record calls save and returns inserted status', async () => {
  let saveCalled = false;
  let savedRecord: any = null;

  const deps: IngestDeps = {
    isDuplicate: async () => false,
    save: async (record) => {
      saveCalled = true;
      savedRecord = record;
    },
    update: noOpUpdate,
  };

  const record = {
    type: 'steps',
    timestamp: '2026-02-24T10:00:00Z',
    data: { count: 1000 },
  };

  const result = await ingest(record, deps);

  assert.equal(result.status, 'inserted');
  assert.equal(saveCalled, true);
  assert.ok(savedRecord);
  assert.ok('dedupeKey' in savedRecord);
  assert.ok('receivedAt' in savedRecord);
});

test('ingest: duplicate record returns duplicate status without saving', async () => {
  let saveCalled = false;

  const deps: IngestDeps = {
    isDuplicate: async () => true, // Mark as duplicate
    save: async () => {
      saveCalled = true;
    },
    update: noOpUpdate,
  };

  const record = {
    type: 'steps',
    timestamp: '2026-02-24T10:00:00Z',
    data: { count: 1000 },
  };

  const result = await ingest(record, deps);

  assert.equal(result.status, 'duplicate');
  assert.equal(saveCalled, false);
  assert.ok('dedupeKey' in result);
});

test('ingest: invalid record returns failed status', async () => {
  let saveCalled = false;

  const deps: IngestDeps = {
    isDuplicate: async () => false,
    save: async () => {
      saveCalled = true;
    },
    update: noOpUpdate,
  };

  // Missing required fields
  const invalidRecord = {
    type: 'steps',
    // Missing timestamp
  };

  const result = await ingest(invalidRecord, deps);

  assert.equal(result.status, 'failed');
  assert.equal(saveCalled, false);
  assert.ok('code' in result);
  assert.ok('message' in result);
});

test('ingest: record with invalid timestamp returns failed status', async () => {
  let saveCalled = false;

  const deps: IngestDeps = {
    isDuplicate: async () => false,
    save: async () => {
      saveCalled = true;
    },
    update: noOpUpdate,
  };

  const invalidRecord = {
    type: 'steps',
    timestamp: 'not-a-valid-date',
    data: { count: 1000 },
  };

  const result = await ingest(invalidRecord, deps);

  assert.equal(result.status, 'failed');
  assert.equal(saveCalled, false);
});

test('ingest: record without data field returns failed status', async () => {
  let saveCalled = false;

  const deps: IngestDeps = {
    isDuplicate: async () => false,
    save: async () => {
      saveCalled = true;
    },
    update: noOpUpdate,
  };

  const invalidRecord = {
    type: 'steps',
    timestamp: '2026-02-24T10:00:00Z',
    // Missing data
  };

  const result = await ingest(invalidRecord, deps);

  assert.equal(result.status, 'failed');
  assert.equal(saveCalled, false);
});

test('ingest: upsert strategy with existing key calls update and returns updated', async () => {
  let updateCalled = false;
  let updatedRecord: any = null;
  let saveCalled = false;

  const deps: IngestDeps = {
    isDuplicate: async () => true,
    save: async () => {
      saveCalled = true;
    },
    update: async (_key, record) => {
      updateCalled = true;
      updatedRecord = record;
    },
  };

  const record = {
    type: 'steps',
    timestamp: '2026-02-24T10:00:00Z',
    data: { count: 1500, dedupeKey: 'steps-2026-02-24', dedupeStrategy: 'upsert' },
  };

  const result = await ingest(record, deps);

  assert.equal(result.status, 'updated');
  assert.ok('dedupeKey' in result);
  assert.equal(result.dedupeKey, 'steps-2026-02-24');
  assert.equal(updateCalled, true);
  assert.equal(saveCalled, false);
  assert.ok(updatedRecord);
  assert.ok('receivedAt' in updatedRecord);
});

test('ingest: upsert strategy with new key inserts normally', async () => {
  let saveCalled = false;
  let savedRecord: any = null;

  const deps: IngestDeps = {
    isDuplicate: async () => false,
    save: async (record) => {
      saveCalled = true;
      savedRecord = record;
    },
    update: noOpUpdate,
  };

  const record = {
    type: 'steps',
    timestamp: '2026-02-24T10:00:00Z',
    data: { count: 1500, dedupeKey: 'steps-2026-02-24', dedupeStrategy: 'upsert' },
  };

  const result = await ingest(record, deps);

  assert.equal(result.status, 'inserted');
  assert.equal(result.dedupeKey, 'steps-2026-02-24');
  assert.equal(saveCalled, true);
  assert.ok(savedRecord);
});

test('ingest: duplicate without upsert strategy returns duplicate (unchanged behavior)', async () => {
  let updateCalled = false;
  let saveCalled = false;

  const deps: IngestDeps = {
    isDuplicate: async () => true,
    save: async () => {
      saveCalled = true;
    },
    update: async () => {
      updateCalled = true;
    },
  };

  const record = {
    type: 'steps',
    timestamp: '2026-02-24T10:00:00Z',
    data: { count: 1000 },
  };

  const result = await ingest(record, deps);

  assert.equal(result.status, 'duplicate');
  assert.equal(saveCalled, false);
  assert.equal(updateCalled, false);
});

test('ingest: client-provided dedupeKey is used as the key', async () => {
  let savedRecord: any = null;

  const deps: IngestDeps = {
    isDuplicate: async () => false,
    save: async (record) => {
      savedRecord = record;
    },
    update: noOpUpdate,
  };

  const record = {
    type: 'steps',
    timestamp: '2026-02-24T10:00:00Z',
    data: { count: 1000, dedupeKey: 'my-stable-key-123' },
  };

  const result = await ingest(record, deps);

  assert.equal(result.status, 'inserted');
  assert.equal(result.dedupeKey, 'my-stable-key-123');
  assert.equal(savedRecord.dedupeKey, 'my-stable-key-123');
});
