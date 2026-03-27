import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalIdentity, buildDedupeKey } from '../../src/dedupe/key-builder.js';

test('dedupe key is stable across field order variants', () => {
  const base = {
    type: 'heart-rate',
    timestamp: '2026-02-19T09:30:00.000Z',
    category: 'vital',
    source: { device: 'watch', app: 'health' },
    data: { bpm: 81, context: { unit: 'count/min', resting: false } },
  };

  const reordered = {
    timestamp: '2026-02-19T09:30:00.000Z',
    type: 'heart-rate',
    source: { app: 'health', device: 'watch' },
    category: 'vital',
    data: { context: { resting: false, unit: 'count/min' }, bpm: 81 },
    metadata: { ignored: true },
  };

  assert.equal(buildCanonicalIdentity(base), buildCanonicalIdentity(reordered));
  assert.equal(buildDedupeKey(base), buildDedupeKey(reordered));
});

test('dedupe key changes when canonical business data changes', () => {
  const a = { type: 'steps', timestamp: '2026-02-19T10:00:00Z', data: { count: 1000 } };
  const b = { type: 'steps', timestamp: '2026-02-19T10:00:00Z', data: { count: 1001 } };

  assert.notEqual(buildDedupeKey(a), buildDedupeKey(b));
});

test('dedupe key uses client-provided dedupeKey from data field', () => {
  const record = {
    type: 'steps',
    timestamp: '2026-02-19T10:00:00Z',
    data: { count: 1000, dedupeKey: 'client-stable-key-abc' },
  };

  assert.equal(buildDedupeKey(record), 'client-stable-key-abc');
});

test('dedupe key falls back to SHA256 when data.dedupeKey is absent', () => {
  const record = {
    type: 'steps',
    timestamp: '2026-02-19T10:00:00Z',
    data: { count: 1000 },
  };

  // Should be a hex SHA256 hash (64 chars)
  const key = buildDedupeKey(record);
  assert.equal(key.length, 64);
  assert.match(key, /^[0-9a-f]{64}$/);
});
