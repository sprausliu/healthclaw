# Tasks: Batch Sync, Deduplication, and Cleanup APIs

**Input**: Design documents from `/specs/002-health-sync-batch-dedupe/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Include targeted tests for deterministic dedupe behavior, partial-success batch processing, and cleanup safety.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize dependencies, runtime dirs, and test harness for webhook-server feature work.

- [ ] T001 Add SQLite dependency and test script updates in `webhook-server/package.json`
- [ ] T002 Add runtime/data ignore rules for DB/backups/logs in `webhook-server/.gitignore`
- [ ] T003 [P] Create feature runtime directory placeholders (`webhook-server/data/.gitkeep`, `webhook-server/data/backups/.gitkeep`)
- [ ] T004 [P] Add feature environment keys (`ADMIN_TOKEN`, `BATCH_MAX_ITEMS`, `BATCH_MAX_BODY_MB`, `DEDUPE_DB_PATH`) in `webhook-server/.env.example`
- [ ] T005 Initialize test scaffold directories in `webhook-server/tests/unit/`, `webhook-server/tests/integration/`, `webhook-server/tests/fixtures/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared primitives required by all stories (validation, dedupe index, storage helpers, auth middleware, response contracts).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Implement shared record validator (`validateHealthRecord`) in `webhook-server/src/validation/health-record.js`
- [ ] T007 Implement canonical key generator (`buildCanonicalIdentity`, `buildDedupeKey`) in `webhook-server/src/dedupe/key-builder.js`
- [ ] T008 Implement SQLite dedupe repository (`init`, `has`, `upsert`, `bumpDuplicate`) in `webhook-server/src/dedupe/dedupe-repository.js`
- [ ] T009 Implement JSONL storage helper (`appendRecord`, `streamRecords`, `atomicRewrite`) in `webhook-server/src/storage/health-log-store.js`
- [ ] T010 [P] Implement admin auth middleware for cleanup endpoints in `webhook-server/src/middleware/auth-admin.js`
- [ ] T011 [P] Implement batch request guardrail middleware (item count/body-size checks) in `webhook-server/src/middleware/batch-guardrails.js`
- [ ] T012 Implement unified ingest service (`insert|duplicate|failed` status contract) in `webhook-server/src/services/ingest-service.js`
- [ ] T013 Wire foundational module imports/initialization into `webhook-server/index.js`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Fast Manual Backfill Sync (Priority: P1) 🎯 MVP

**Goal**: Accept many records in one authenticated request with partial-success reporting.

**Independent Test**: Submit a mixed valid/invalid batch and verify aggregate + item-level error response while valid items are ingested.

### Tests for User Story 1

- [ ] T014 [P] [US1] Add integration test for success batch ingestion in `webhook-server/tests/integration/health-sync-batch.success.test.js`
- [ ] T015 [P] [US1] Add integration test for partial-success (invalid subset) in `webhook-server/tests/integration/health-sync-batch.partial.test.js`
- [ ] T016 [P] [US1] Add integration test for unauthenticated batch rejection in `webhook-server/tests/integration/health-sync-batch.auth.test.js`

### Implementation for User Story 1

- [ ] T017 [US1] Add `POST /api/health-sync/batch` route and handler in `webhook-server/index.js`
- [ ] T018 [US1] Implement per-item processing loop using ingest service in `webhook-server/src/services/batch-sync-service.js`
- [ ] T019 [US1] Implement aggregate response schema (`total/inserted/duplicates/failed/errors`) in `webhook-server/src/contracts/batch-sync-response.js`
- [ ] T020 [US1] Add request/response logging for batch operations in `webhook-server/index.js`
- [ ] T021 [US1] Update API usage docs for batch endpoint in `webhook-server/README.md`

**Checkpoint**: User Story 1 is independently functional and testable

---

## Phase 4: User Story 2 - Idempotent Storage via Deduplication (Priority: P1)

**Goal**: Ensure repeated sync payloads (single and batch) do not create duplicates.

**Independent Test**: Replay identical payloads through single and batch endpoints; verify unique storage count does not increase.

### Tests for User Story 2

- [ ] T022 [P] [US2] Add unit tests for canonical-key stability across field order variants in `webhook-server/tests/unit/dedupe-key.test.js`
- [ ] T023 [P] [US2] Add integration test for duplicate replay on single endpoint in `webhook-server/tests/integration/health-sync-single.dedupe.test.js`
- [ ] T024 [P] [US2] Add integration test for duplicate replay inside batch endpoint in `webhook-server/tests/integration/health-sync-batch.dedupe.test.js`

### Implementation for User Story 2

- [ ] T025 [US2] Refactor single endpoint ingestion to use shared ingest service in `webhook-server/index.js`
- [ ] T026 [US2] Persist dedupe metadata timestamps/counts in `webhook-server/src/dedupe/dedupe-repository.js`
- [ ] T027 [US2] Return explicit single-sync status (`inserted|duplicate`) in `webhook-server/index.js`
- [ ] T028 [US2] Backfill dedupe index build utility for existing JSONL records in `webhook-server/src/dedupe/rebuild-index.js`
- [ ] T029 [US2] Add operational doc for dedupe behavior + index rebuild in `webhook-server/README.md`

**Checkpoint**: User Stories 1 and 2 both work independently and together

---

## Phase 5: User Story 3 - Safe Cleanup of Existing Data (Priority: P2)

**Goal**: Provide admin-only preview/execute cleanup with backup-first safety.

**Independent Test**: Run preview then execute duplicates-only cleanup and verify backup exists plus only targeted records removed.

### Tests for User Story 3

- [ ] T030 [P] [US3] Add integration test for cleanup preview non-destructive behavior in `webhook-server/tests/integration/cleanup.preview.test.js`
- [ ] T031 [P] [US3] Add integration test for execute requiring admin token + confirm in `webhook-server/tests/integration/cleanup.auth-confirm.test.js`
- [ ] T032 [P] [US3] Add integration test for duplicates-only cleanup result consistency in `webhook-server/tests/integration/cleanup.duplicates.test.js`

### Implementation for User Story 3

- [ ] T033 [US3] Add `POST /admin/cleanup/preview` endpoint in `webhook-server/index.js`
- [ ] T034 [US3] Add `POST /admin/cleanup/execute` endpoint in `webhook-server/index.js`
- [ ] T035 [US3] Implement cleanup criteria evaluator (mode + filters) in `webhook-server/src/services/cleanup/filter-engine.js`
- [ ] T036 [US3] Implement preview summarizer (`matched/removed/byType`) in `webhook-server/src/services/cleanup/preview-service.js`
- [ ] T037 [US3] Implement execute workflow (backup -> atomic rewrite -> result summary) in `webhook-server/src/services/cleanup/execute-service.js`
- [ ] T038 [US3] Record backup metadata and cleanup audit output in `webhook-server/src/services/cleanup/audit-log.js`
- [ ] T039 [US3] Document cleanup API usage and safeguards in `webhook-server/README.md`

**Checkpoint**: All user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tighten quality, contracts, and operational readiness across all stories.

- [ ] T040 [P] Sync implementation with `specs/002-health-sync-batch-dedupe/contracts/openapi.yaml`
- [ ] T041 [P] Add quickstart validation script and examples in `specs/002-health-sync-batch-dedupe/quickstart.md`
- [ ] T042 Add regression test for backward compatibility of original `/api/health-sync` in `webhook-server/tests/integration/health-sync-single.compat.test.js`
- [ ] T043 Add performance smoke test (1,000-item batch under target) in `webhook-server/tests/integration/health-sync-batch.perf.test.js`
- [ ] T044 Run full test suite and fix failures in `webhook-server/tests/`
- [ ] T045 Update changelog/feature notes in `docs/API_SPEC.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies, starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2 (can run parallel with US1 after foundation, but recommended right after US1 for MVP reliability).
- **Phase 5 (US3)**: Depends on Phase 2; best after US2 to reuse dedupe primitives.
- **Phase 6 (Polish)**: Depends on completion of desired user stories.

### User Story Dependencies

- **US1 (P1)**: Independent after foundational completion.
- **US2 (P1)**: Independent after foundational completion; reuses shared ingestion + dedupe primitives.
- **US3 (P2)**: Independent after foundational completion; benefits from completed dedupe index behavior from US2.

### Within Each User Story

- Tests first, then implementation.
- Contracts/validation before endpoint wiring.
- Endpoint wiring before doc updates.

### Parallel Opportunities

- Setup tasks T003/T004 parallel.
- Foundational tasks T010/T011 parallel with core module work.
- US1 tests T014-T016 parallel.
- US2 tests T022-T024 parallel.
- US3 tests T030-T032 parallel.
- Cross-cutting T040/T041 parallel.

---

## Parallel Example: User Story 1

```bash
# Parallel test prep for US1
Task: "T014 [US1] success batch integration test"
Task: "T015 [US1] partial-success integration test"
Task: "T016 [US1] auth rejection integration test"

# Then implement in order
Task: "T017 [US1] add batch endpoint"
Task: "T018 [US1] batch processing service"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 + Phase 2.
2. Deliver US1 (batch ingestion).
3. Deliver US2 (idempotent dedupe) and validate replay behavior.
4. Pause for manual sync validation with iOS client.

### Incremental Delivery

1. Foundation complete.
2. Ship US1 for speed.
3. Ship US2 for correctness.
4. Ship US3 for safe operations.
5. Finish polish/perf/docs.

### Light-Weight Swarm Strategy

- Agent A: Foundation + US1 endpoint/service path.
- Agent B: Dedupe internals + tests for US2.
- Agent C: Cleanup APIs + safety/backup logic for US3.
- Integrator: Rebase/merge results, run final test sweep, resolve conflicts.

---

## Notes

- Keep existing `/api/health-sync` request format fully backward compatible.
- Any destructive cleanup must require explicit confirm and create backup first.
- Do not commit runtime secrets or local state files.
