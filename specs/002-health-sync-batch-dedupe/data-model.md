# Data Model: Batch Sync, Deduplication, and Cleanup APIs

## 1) HealthSyncRecord
Represents one submitted health data event.

**Fields**
- `type` (string, required)
- `timestamp` (ISO-8601 string, required)
- `data` (object, required)
- `category` (string, optional)
- `source` (object, optional)
- `metadata` (object, optional)
- `receivedAt` (ISO-8601 string, server-generated)

**Validation Rules**
- `type`, `timestamp`, `data` are mandatory.
- `timestamp` must parse as valid ISO date-time.
- `data` must be a non-null JSON object.

## 2) DedupeIdentity
Canonical identity derived from stable business fields for uniqueness.

**Fields**
- `dedupeKey` (string, required, unique)
- `recordType` (string)
- `recordTimestamp` (string)
- `firstSeenAt` (ISO-8601 string)
- `lastSeenAt` (ISO-8601 string)
- `duplicateCount` (integer)

**Generation Rules**
- Canonicalize selected stable fields by record type/category.
- Normalize date/time strings to canonical format.
- Ignore volatile fields (e.g., receivedAt, non-semantic metadata changes).
- Hash canonical representation to fixed-length key.

## 3) BatchSyncRequest
Container for many records in one call.

**Fields**
- `items` (array<HealthSyncRecord>, required, min 1)
- `clientRequestId` (string, optional)

## 4) BatchProcessingResult
Aggregated processing output for a batch.

**Fields**
- `total` (integer)
- `inserted` (integer)
- `duplicates` (integer)
- `failed` (integer)
- `errors` (array of `{index, code, message}`)

**State/Flow**
- Item state: `validated -> inserted|duplicate|failed`.
- Batch is always partial-success capable.

## 5) CleanupRequest
Operator request to inspect or mutate stored data.

**Fields**
- `mode` (enum: `duplicates-only`, `before-date`, `by-type`, `compound`)
- `dryRun` (boolean; true for preview)
- `confirm` (boolean; required true for execute)
- `filters` (object):
  - `beforeTimestamp` (optional)
  - `types` (optional array<string>)
  - `categories` (optional array<string>)

## 6) CleanupResult
Summary of cleanup operation.

**Fields**
- `preview` (boolean)
- `matched` (integer)
- `removed` (integer)
- `kept` (integer)
- `failed` (integer)
- `backupPath` (string, execute only)
- `byType` (object map)

## Relationships
- One `HealthSyncRecord` maps to exactly one `DedupeIdentity` key.
- One `BatchSyncRequest` produces one `BatchProcessingResult`.
- One `CleanupRequest` produces one `CleanupResult`, and execute mode creates one backup artifact.
