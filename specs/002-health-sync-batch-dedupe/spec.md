# Feature Specification: Batch Sync, Deduplication, and Cleanup APIs

**Feature Branch**: `002-health-sync-batch-dedupe`  
**Created**: 2026-02-19  
**Status**: Draft  
**Input**: User description: "Need deduplication in webhook storage, add a batch upload endpoint for manual sync (current one-by-one upload is too slow), and add a cleanup data API."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fast Manual Backfill Sync (Priority: P1)

As the iOS/manual sync client, I can submit many health records in one request so historical sync is practical and not blocked by one-by-one uploads.

**Why this priority**: Bulk upload speed is the immediate bottleneck for real usage; without this, manual sync is too slow.

**Independent Test**: Send a request containing mixed health records (steps, heart-rate, sleep, workouts). Verify the system accepts the batch and reports per-request totals (accepted, inserted, duplicate, failed).

**Acceptance Scenarios**:

1. **Given** a valid API token and a batch containing valid records, **When** the client submits the batch sync request, **Then** the system processes all items and returns an aggregate result summary.
2. **Given** a valid API token and a batch with some invalid items, **When** the client submits the batch, **Then** the system records valid items, rejects invalid items, and returns failure details for only the invalid subset.
3. **Given** an unauthenticated request, **When** the client submits batch sync, **Then** the system rejects the request with an authentication error and does not store data.

---

### User Story 2 - Idempotent Storage via Deduplication (Priority: P1)

As the webhook owner, repeated syncs of the same historical data should not create duplicate records, so analytics and alerts remain accurate.

**Why this priority**: Duplicate data corrupts trend analysis and causes false alerts; idempotency is required for reliable monitoring.

**Independent Test**: Submit the same data payloads multiple times (single and batch). Verify only one canonical record is retained per unique data event and duplicates are reported as skipped.

**Acceptance Scenarios**:

1. **Given** a record already stored, **When** the same record is submitted again, **Then** the system identifies it as duplicate and does not append another copy.
2. **Given** mixed new and duplicate records in a batch, **When** the batch is processed, **Then** only new records are inserted and duplicates are skipped with accurate counts.
3. **Given** records of different health categories with distinct identity fields, **When** deduplication runs, **Then** it applies category-appropriate uniqueness rules and avoids false positive merges.

---

### User Story 3 - Safe Cleanup of Existing Data (Priority: P2)

As the webhook owner, I can preview and execute cleanup operations (especially duplicate removal) so historic data quality can be repaired safely.

**Why this priority**: Existing historical duplicates already exist; a safe cleanup workflow is necessary after dedupe is introduced.

**Independent Test**: Run cleanup preview to inspect impact, then run execution with explicit confirmation. Verify only targeted data is removed and a backup artifact exists for recovery.

**Acceptance Scenarios**:

1. **Given** a cleanup preview request for duplicates, **When** preview is executed, **Then** the system returns projected deletions by scope/type without mutating stored data.
2. **Given** an execution request with explicit confirmation, **When** cleanup runs, **Then** the system removes only targeted records and returns a post-action summary.
3. **Given** a cleanup request without required admin authorization, **When** execution is attempted, **Then** the system rejects the request and leaves data unchanged.

---

### Edge Cases

- Batch request contains zero items.
- Batch payload size exceeds the allowed limit.
- Batch includes malformed timestamps or non-object `data` fields.
- Batch contains both duplicate and invalid records in the same request.
- Cleanup preview/execution is requested while sync requests are being ingested concurrently.
- Cleanup criteria match no records.
- Cleanup execution is retried due to client timeout after server-side completion.
- Historical records created before dedupe metadata exists must still be evaluated safely.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a batch sync capability that accepts multiple health records in one authenticated request.
- **FR-002**: System MUST support current single-record sync behavior without breaking existing clients.
- **FR-003**: System MUST validate each submitted record independently and return item-level failures for invalid records.
- **FR-004**: System MUST apply deterministic deduplication for both single and batch ingestion.
- **FR-005**: System MUST classify duplicate records as non-inserted and include duplicate counts in responses.
- **FR-006**: System MUST persist only unique records to long-term health data storage.
- **FR-007**: System MUST expose cleanup preview capability that reports projected impact without modifying data.
- **FR-008**: System MUST expose cleanup execution capability for duplicate removal and scoped data removal with explicit confirmation.
- **FR-009**: System MUST require elevated admin authorization for cleanup endpoints.
- **FR-010**: System MUST create a recoverable backup artifact before destructive cleanup execution.
- **FR-011**: System MUST produce auditable cleanup result summaries including attempted, removed, skipped, and failed counts.
- **FR-012**: System MUST keep existing pairing and authentication behavior unchanged for sync endpoints.
- **FR-013**: System MUST handle partial-success batch processing (some inserted, some duplicate, some invalid) without failing the entire request.
- **FR-014**: System MUST provide clear, machine-readable response fields so clients can retry only failed items.

### Key Entities _(include if feature involves data)_

- **Health Sync Record**: A single health event payload submitted by client (type, timestamp, category, source, metadata, data).
- **Deduplication Identity**: Canonical identity representation derived from a record’s stable business fields for uniqueness checks.
- **Batch Sync Request**: A single client submission containing multiple health sync records plus request-level metadata.
- **Batch Processing Result**: Aggregate and item-level processing outcomes (inserted, duplicate, invalid, error).
- **Cleanup Job Request**: User-provided cleanup criteria and execution mode (preview vs execute, scope filters, confirmation).
- **Cleanup Job Result**: Execution summary including scope, counts, and backup reference.
- **Cleanup Backup Artifact**: Recoverable snapshot created before destructive cleanup execution.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A batch request with 1,000 valid records completes within 10 seconds under normal local deployment conditions.
- **SC-002**: Re-submitting identical historical payloads results in 0 additional stored records (idempotent behavior).
- **SC-003**: For mixed batches, response accuracy for inserted/duplicate/invalid counts is 100% against server-side processing results.
- **SC-004**: Cleanup preview and cleanup execute produce consistent projected-vs-actual duplicate removal counts within a 1% tolerance.
- **SC-005**: 100% of cleanup execute operations create a usable backup artifact reference before deletion starts.
- **SC-006**: Existing single-record sync clients continue to succeed without request format changes.

## Assumptions

- Existing authentication token model remains the baseline for sync endpoints.
- Cleanup APIs are admin-only and are expected to be used by trusted operator flows.
- Current storage format remains line-oriented historical records, with dedupe metadata/index managed separately.
- Manual sync clients prefer concise machine-readable summaries over verbose per-item payload echoes.
