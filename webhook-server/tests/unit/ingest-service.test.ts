import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingest, type IngestDeps } from '../../src/services/ingest-service.js';

test('ingest: valid record calls save and returns inserted status', async () => {
  let saveCalled = false;
  let savedRecord: any = null;

  const deps: IngestDeps = {
    isDuplicate: async () => false,
    save: async (record) => {
      saveCalled = true;
      savedRecord = record;
    },
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
