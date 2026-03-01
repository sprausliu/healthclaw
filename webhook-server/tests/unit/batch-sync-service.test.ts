import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processBatch, type BatchDeps } from '../../src/services/batch-sync-service.js';

test('processBatch: mixed batch returns correct counts', async () => {
  const results = [
    { status: 'inserted' as const, dedupeKey: 'key1' },
    { status: 'duplicate' as const, dedupeKey: 'key2' },
    { status: 'failed' as const, code: 'INVALID_TIMESTAMP', message: 'Invalid timestamp' },
    { status: 'inserted' as const, dedupeKey: 'key3' },
  ];

  let callCount = 0;

  const deps: BatchDeps = {
    ingestOne: async () => results[callCount++]!,
  };

  const items = [{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }];

  const summary = await processBatch(items, deps);

  assert.equal(summary.total, 4);
  assert.equal(summary.inserted, 2);
  assert.equal(summary.duplicates, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0]!.index, 2);
  assert.equal(summary.errors[0]!.code, 'INVALID_TIMESTAMP');
});

test('processBatch: empty batch returns all-zero summary', async () => {
  const deps: BatchDeps = {
    ingestOne: async () => ({ status: 'inserted', dedupeKey: 'should-not-be-called' }),
  };

  const items: any[] = [];

  const summary = await processBatch(items, deps);

  assert.equal(summary.total, 0);
  assert.equal(summary.inserted, 0);
  assert.equal(summary.duplicates, 0);
  assert.equal(summary.failed, 0);
  assert.equal(summary.errors.length, 0);
});

test('processBatch: all successful returns zero failures', async () => {
  const deps: BatchDeps = {
    ingestOne: async () => ({ status: 'inserted', dedupeKey: 'key' }),
  };

  const items = [{ a: 1 }, { b: 2 }, { c: 3 }];

  const summary = await processBatch(items, deps);

  assert.equal(summary.total, 3);
  assert.equal(summary.inserted, 3);
  assert.equal(summary.duplicates, 0);
  assert.equal(summary.failed, 0);
  assert.equal(summary.errors.length, 0);
});

test('processBatch: all duplicates returns zero insertions', async () => {
  const deps: BatchDeps = {
    ingestOne: async () => ({ status: 'duplicate', dedupeKey: 'key' }),
  };

  const items = [{ a: 1 }, { b: 2 }];

  const summary = await processBatch(items, deps);

  assert.equal(summary.total, 2);
  assert.equal(summary.inserted, 0);
  assert.equal(summary.duplicates, 2);
  assert.equal(summary.failed, 0);
  assert.equal(summary.errors.length, 0);
});

test('processBatch: exception during ingest counts as failure', async () => {
  let callCount = 0;

  const deps: BatchDeps = {
    ingestOne: async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Database connection failed');
      }
      return { status: 'inserted', dedupeKey: 'key' };
    },
  };

  const items = [{ a: 1 }, { b: 2 }, { c: 3 }];

  const summary = await processBatch(items, deps);

  assert.equal(summary.total, 3);
  assert.equal(summary.inserted, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0]!.index, 1);
  assert.equal(summary.errors[0]!.code, 'INTERNAL_ERROR');
  assert.ok(summary.errors[0]!.message.includes('Database connection failed'));
});
