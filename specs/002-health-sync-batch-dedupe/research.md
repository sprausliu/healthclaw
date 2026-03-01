# Research: Batch Sync, Deduplication, and Cleanup APIs

## Decision 1: Use a persistent dedupe index backed by SQLite
- **Decision**: Use a local SQLite database as dedupe index with a unique key per canonical record identity.
- **Rationale**: Reliable uniqueness guarantees across restarts, fast lookups for large backfills, and simpler concurrency control compared with in-memory or flat-file indexes.
- **Alternatives considered**:
  - JSONL/flat-file index: simple but becomes slow/fragile at higher volume and harder to keep atomic.
  - In-memory set only: fast but loses state on restart and cannot guarantee idempotency long-term.

## Decision 2: Keep JSONL as source-of-record event log
- **Decision**: Continue appending unique records into `health-data.jsonl`; SQLite stores dedupe metadata and cleanup bookkeeping.
- **Rationale**: Preserves existing compatibility and operational simplicity while adding idempotency control.
- **Alternatives considered**:
  - Fully migrating primary storage to SQLite: cleaner querying but larger migration and compatibility change.

## Decision 3: Add dedicated batch endpoint with partial success semantics
- **Decision**: Add `POST /api/health-sync/batch` accepting `items[]` and return aggregate + per-item error summary.
- **Rationale**: Manual sync speed improves drastically while allowing robust retries on failed subset only.
- **Alternatives considered**:
  - Reusing single endpoint with overloaded payload: ambiguous contract and risk to existing clients.

## Decision 4: Deterministic canonical-key generation per record
- **Decision**: Build canonical key from stable business fields by record type/category, then hash to fixed-length key.
- **Rationale**: Prevents false duplicates caused by field order, transient metadata, or formatting differences.
- **Alternatives considered**:
  - Hash entire raw payload: too sensitive to non-semantic field ordering and extra metadata.

## Decision 5: Cleanup API must be two-step (preview then execute)
- **Decision**: Expose admin cleanup preview and execute endpoints; execute requires explicit confirmation and creates backup before mutation.
- **Rationale**: Minimizes accidental data loss and gives clear operator visibility before deletion.
- **Alternatives considered**:
  - Single destructive endpoint: too risky for operational use.

## Decision 6: Admin auth model for cleanup
- **Decision**: Require separate admin token for cleanup APIs; regular device sync token cannot invoke cleanup.
- **Rationale**: Reduces blast radius if device token leaks and keeps destructive operations gated.
- **Alternatives considered**:
  - Reuse device token: insufficient privilege separation.

## Decision 7: Cleanup execution strategy
- **Decision**: For destructive cleanup, stream-read JSONL, filter by criteria, write replacement file atomically, and persist backup path metadata.
- **Rationale**: Safe and predictable for append-log storage, avoids partial truncation risk.
- **Alternatives considered**:
  - In-place rewrite: higher corruption risk on crash/interruption.

## Decision 8: Batch limits and guardrails
- **Decision**: Enforce request-level limits (max item count and payload size) and validate items independently.
- **Rationale**: Prevents resource spikes and keeps predictable response latency.
- **Alternatives considered**:
  - Unlimited batch size: increased timeout/memory risk.
