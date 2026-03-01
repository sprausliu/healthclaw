# Tasks: HealthClaw Webhook Config & Token Persistence

**Input**: Design documents from `/specs/001-webhook-token-persistence/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No mandatory automated test tasks were explicitly required in spec; validation is covered via quickstart and acceptance verification tasks.

**Organization**: Tasks are grouped by user story for independent delivery and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no direct dependency)
- **[Story]**: User story label (US1, US2, US3, US4)
- Every task includes explicit file path(s)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare scaffolding for persistence refactor.

- [ ] T001 Create persistence module directories in `webhook-server/src/persistence/` and `webhook-server/src/persistence/providers/`
- [ ] T002 Add persistence config section and defaults in `webhook-server/README.md` and `webhook-server/.env.example`
- [ ] T003 [P] Add runtime artifact ignore rules for legacy/local artifacts in `webhook-server/.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core abstractions required by all user stories.

**⚠️ CRITICAL**: Complete before user story implementation.

- [ ] T004 Implement storage path resolver for user-level app data in `webhook-server/src/persistence/path-resolver.js`
- [ ] T005 [P] Implement runtime config repository (non-secret JSON) in `webhook-server/src/persistence/runtime-config-repo.js`
- [ ] T006 [P] Implement secret provider interface and factory in `webhook-server/src/persistence/secret-store.js`
- [ ] T007 Implement system-store provider adapter in `webhook-server/src/persistence/providers/system-secret-provider.js`
- [ ] T008 Implement file-fallback secret provider with restricted permissions in `webhook-server/src/persistence/providers/file-secret-provider.js`
- [ ] T009 Implement persistence bootstrap/orchestration service in `webhook-server/src/persistence/persistence-bootstrap.js`
- [ ] T010 Wire persistence bootstrap into app initialization in `webhook-server/index.js`
- [ ] T011 Document bootstrap/runtime path behavior in `webhook-server/docs/persistence.md`

**Checkpoint**: Foundation ready for story-level work.

---

## Phase 3: User Story 1 - Run reliably via npx without repo-bound config (Priority: P1) 🎯 MVP

**Goal**: Service runs from any working directory and persists non-secret state in stable user-level paths.

**Independent Test**: Start from `/tmp`, pair once, restart from another directory, verify state remains and repository tree has no new runtime artifacts.

### Implementation for User Story 1

- [ ] T012 [US1] Refactor `CONFIG_FILE`, `HEALTH_DATA_FILE`, and `DEDUPE_DB_PATH` resolution to use persistence bootstrap in `webhook-server/index.js`
- [ ] T013 [P] [US1] Update dedupe repository initialization to use resolved external path in `webhook-server/src/dedupe/dedupe-repository.js`
- [ ] T014 [P] [US1] Update health log append path handling to external runtime data location in `webhook-server/src/storage/health-log-store.js`
- [ ] T015 [US1] Ensure startup creates required runtime directories safely in `webhook-server/src/persistence/path-resolver.js`
- [ ] T016 [US1] Add startup diagnostics (resolved paths + backend type without secrets) in `webhook-server/index.js`
- [ ] T017 [US1] Update operational docs for npx run-from-anywhere flow in `webhook-server/README.md`

**Checkpoint**: US1 independently functional.

---

## Phase 4: User Story 2 - Protect persistent sync token outside normal config files (Priority: P1)

**Goal**: Permanent token no longer stored in plain config; auth still works for both sync endpoints.

**Independent Test**: Pair device and confirm plain config has no permanent token while `/api/health-sync` and `/api/health-sync/batch` auth behavior remains correct.

### Implementation for User Story 2

- [ ] T018 [US2] Replace `device.permanentToken` read/write with secret-store operations in `webhook-server/index.js`
- [ ] T019 [P] [US2] Add credential service for token save/load/revoke operations in `webhook-server/src/persistence/credential-service.js`
- [ ] T020 [P] [US2] Update runtime config schema handling to persist token metadata/reference only in `webhook-server/src/persistence/runtime-config-repo.js`
- [ ] T021 [US2] Update `authenticatePermanent` to use credential service and safe auth-failure behavior in `webhook-server/index.js`
- [ ] T022 [US2] Ensure pair endpoint stores token via secret backend and writes non-secret device metadata only in `webhook-server/index.js`
- [ ] T023 [US2] Add redaction guard to prevent token logging in `webhook-server/src/persistence/credential-service.js`
- [ ] T024 [US2] Update API/auth behavior notes in `webhook-server/docs/persistence.md`

**Checkpoint**: US1 + US2 independently functional.

---

## Phase 5: User Story 3 - Migrate existing installs without breaking ingestion (Priority: P2)

**Goal**: Legacy repo-local token is migrated once, idempotently, without re-pairing.

**Independent Test**: Start with legacy config containing token, verify one-time migration success, confirm repeated restart does not remigrate, and sync still works.

### Implementation for User Story 3

- [ ] T025 [US3] Implement legacy config reader and migration extractor in `webhook-server/src/persistence/legacy-config-migrator.js`
- [ ] T026 [P] [US3] Implement migration state model and transitions in `webhook-server/src/persistence/migration-state.js`
- [ ] T027 [US3] Execute migration during bootstrap before auth handling is initialized in `webhook-server/src/persistence/persistence-bootstrap.js`
- [ ] T028 [US3] Remove/redact legacy `device.permanentToken` from old config after successful migration in `webhook-server/src/persistence/legacy-config-migrator.js`
- [ ] T029 [US3] Add idempotency and retry-safe migration guards in `webhook-server/src/persistence/persistence-bootstrap.js`
- [ ] T030 [US3] Add operator-facing migration status/error logs in `webhook-server/index.js`
- [ ] T031 [US3] Add migration runbook notes in `webhook-server/docs/persistence.md`

**Checkpoint**: US3 independently functional.

---

## Phase 6: User Story 4 - Keep repository clean and portable (Priority: P3)

**Goal**: Routine operation no longer generates runtime artifacts in repo directories.

**Independent Test**: Run pair + single sync + batch sync, then verify no new runtime files are created under repository source paths.

### Implementation for User Story 4

- [ ] T032 [US4] Replace remaining repository-relative runtime path usage across server modules in `webhook-server/index.js` and `webhook-server/src/**`
- [ ] T033 [P] [US4] Add startup warning when runtime path resolves inside repository tree in `webhook-server/src/persistence/path-resolver.js`
- [ ] T034 [US4] Add repository cleanliness verification steps to quickstart docs in `specs/001-webhook-token-persistence/quickstart.md`
- [ ] T035 [US4] Add maintainer notes for release packaging expectations in `webhook-server/README.md`

**Checkpoint**: All user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, validation, and release readiness.

- [ ] T036 [P] Run full quickstart validation and record outcomes in `specs/001-webhook-token-persistence/quickstart.md`
- [ ] T037 Align OpenAPI contract notes with final auth behavior in `specs/001-webhook-token-persistence/contracts/openapi.yaml`
- [ ] T038 [P] Update changelog/release notes for persistence migration and storage behavior in `docs/CHANGELOG.md`
- [ ] T039 Perform code cleanup and consistency pass across `webhook-server/src/persistence/` and `webhook-server/index.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2 (can run after US1 starts, but recommended after T012/T015).
- **Phase 5 (US3)**: Depends on Phase 2 and US2 credential service primitives.
- **Phase 6 (US4)**: Depends on US1+US2 core path/auth refactor.
- **Phase 7 (Polish)**: Depends on all target stories complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after foundation.
- **US2 (P1)**: Independent value after foundation; complements US1.
- **US3 (P2)**: Depends on US2 token storage behavior.
- **US4 (P3)**: Depends on US1 path refactor and US2 token/config separation.

### Parallel Opportunities

- Setup: T003 parallel with T001/T002.
- Foundational: T005, T006 can run in parallel; then T007/T008.
- US1: T013 and T014 parallel after T012 starts.
- US2: T019 and T020 parallel before T021/T022 integration.
- US3: T026 parallel with early T025 scaffolding.
- US4: T033 parallel with T032 once path APIs are stable.
- Polish: T036 and T038 parallel.

---

## Parallel Example: User Story 2

```bash
# Parallel preparation tasks:
Task: "T019 [US2] Add credential service in webhook-server/src/persistence/credential-service.js"
Task: "T020 [US2] Update runtime config schema handling in webhook-server/src/persistence/runtime-config-repo.js"

# Then integrate into request/auth flow:
Task: "T021 [US2] Update authenticatePermanent in webhook-server/index.js"
Task: "T022 [US2] Update pair endpoint token persistence in webhook-server/index.js"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independent test from spec.
4. Demo npx directory-independent operation.

### Incremental Delivery

1. Deliver US1 (path portability) first.
2. Deliver US2 (secret token persistence separation).
3. Deliver US3 (legacy migration + idempotency).
4. Deliver US4 (repo cleanliness guarantees).
5. Finish with Polish phase and release notes.

### Notes

- Keep task IDs in execution order.
- Preserve backward compatibility for sync API behavior during all phases.
- Do not expose secret backend internals in API error responses.
- Commit per logical task group for safer rollback.
