# Tasks: TypeScript Migration & Code Quality Uplift

**Input**: Design documents from `/specs/003-typescript-migration/`
**Prerequisites**: plan.md ✅, spec.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.
**Parallelism**: Tasks marked [P] can run concurrently (different files, no shared dependencies).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Toolchain, config files, and project scaffolding — must complete before any migration begins.

- [ ] T001 Add devDependencies to `webhook-server/package.json`: `@typescript-go/tsgo`, `typescript`, `zod`, `@types/express`, `@types/better-sqlite3`, `@types/node`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint`, `prettier`
- [ ] T002 Create `webhook-server/tsconfig.json` with `strict`, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `outDir: dist`, `rootDir: src`
- [ ] T003 [P] Create `webhook-server/.eslintrc.json` with `@typescript-eslint/recommended` + custom rules: `no-explicit-any: error`, `no-var: error`, `prefer-const: error`
- [ ] T004 [P] Create `webhook-server/.prettierrc` with project formatting config (single quotes, 2-space indent, trailing commas)
- [ ] T005 Update `webhook-server/package.json` scripts: `typecheck: tsgo --noEmit`, `build: tsgo`, `lint: eslint src --ext .ts`, `format:check: prettier --check src`
- [ ] T006 Add `webhook-server/dist/` to `.gitignore`
- [ ] T007 Create `webhook-server/src/` directory structure per plan.md: `types/`, `schemas/`, `logger/`, `contracts/`, `dedupe/`, `middleware/`, `persistence/providers/`, `services/cleanup/`, `storage/`, `validation/`

**Checkpoint**: Run `npm run typecheck` on empty `src/` — exits 0. Toolchain is working.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that every migrated module depends on. Must be complete before user story phases.

- [ ] T008 Create `webhook-server/src/types/branded.ts` — define `DeviceToken`, `PairingToken`, `SyncId`, `HealthRecordId` branded types with factory functions (`toDeviceToken`, etc.)
- [ ] T009 [P] Create `webhook-server/src/logger/index.ts` — structured JSON logger: `log(level, message, ctx?)` emits `{level, timestamp, message, ...ctx}` to stdout; `LOG_LEVEL` env var configurable
- [ ] T010 [P] Create `webhook-server/src/schemas/health-sync.schema.ts` — Zod schemas for `HealthSyncBody`, `BatchSyncBody`, `BatchSyncItem`, `PairingRequestBody`; export inferred types
- [ ] T011 [P] Create `webhook-server/src/middleware/validate.ts` — generic `validate(schema)` Express middleware factory; returns 400 + `{ errors: result.error.flatten() }` on failure
- [ ] T012 Migrate `webhook-server/src/storage/health-log-store.ts` (from `health-log-store.js`) — add `readonly` to all types, explicit return types, replace `console.*` with logger
- [ ] T013 [P] Migrate `webhook-server/src/contracts/batch-sync-response.ts` (from `batch-sync-response.js`) — add types, `readonly` results, explicit return types

**Checkpoint**: `npm run typecheck` passes on Phase 2 files. Import the branded types in a scratch file to confirm they compile.

---

## Phase 3: User Story 1 — Build & Type-Check Succeeds (Priority: P1) 🎯 MVP

**Goal**: Every source file is TypeScript, `tsgo --noEmit` exits 0, `npm run build` produces runnable output.

**Independent Test**: `npm run typecheck && npm run build && node dist/index.js` — server starts and responds to `GET /health`.

- [ ] T014 Migrate `webhook-server/src/dedupe/dedupe-repository.ts` (from `dedupe-repository.js`) — type `sqlite3` statements, readonly interfaces for DB rows, replace `console.*`
- [ ] T015 [P] Migrate `webhook-server/src/persistence/path-resolver.ts` — add `Readonly<Paths>` return type, explicit param types
- [ ] T016 [P] Migrate `webhook-server/src/persistence/migration-state.ts` — readonly state type, typed return
- [ ] T017 [P] Migrate `webhook-server/src/persistence/providers/file-secret-provider.ts` — typed `SecretProvider` interface, readonly
- [ ] T018 [P] Migrate `webhook-server/src/persistence/providers/system-secret-provider.ts` — typed `SecretProvider` interface
- [ ] T019 Migrate `webhook-server/src/persistence/secret-store.ts` — depends on providers (T017, T018); typed interface, no `any`
- [ ] T020 Migrate `webhook-server/src/persistence/runtime-config-repo.ts` — depends on secret-store (T019); typed `RuntimeConfig` shape with `readonly` fields
- [ ] T021 Migrate `webhook-server/src/persistence/legacy-config-migrator.ts` — depends on runtime-config-repo (T020); typed, readonly
- [ ] T022 [P] Migrate `webhook-server/src/persistence/credential-service.ts` — depends on secret-store (T019); typed `CredentialService` interface
- [ ] T023 Migrate `webhook-server/src/persistence/persistence-bootstrap.ts` — depends on all persistence modules (T019–T022); typed `PersistenceResult`, replace `console.*` with logger
- [ ] T024 [P] Migrate `webhook-server/src/middleware/auth-admin.ts` (from `auth-admin.js`) — typed Express middleware, replace `console.*`
- [ ] T025 [P] Migrate `webhook-server/src/middleware/batch-guardrails.ts` — typed middleware, `readonly` config
- [ ] T026 [P] Migrate `webhook-server/src/validation/index.ts` (from `validation/` JS files) — add types, readonly
- [ ] T027 [P] Migrate `webhook-server/src/services/cleanup/preview-service.ts` — typed, readonly results, replace `console.*`
- [ ] T028 [P] Migrate `webhook-server/src/services/cleanup/execute-service.ts` — typed, readonly results, replace `console.*`
- [ ] T029 Migrate `webhook-server/src/index.ts` (from `index.js`) — wire all migrated modules; typed route handlers; apply `validate` middleware (T011) to `/api/health-sync` and `/api/health-sync/batch`; replace all `console.*` with logger
- [ ] T030 [US1] Run `npm run typecheck` — fix all reported errors until exit 0
- [ ] T031 [US1] Run `npm run build` — confirm `dist/index.js` is emitted and server starts cleanly

**Checkpoint**: `GET /health` returns `200 {"status":"ok",...}` from compiled output.

---

## Phase 4: User Story 2 — Runtime Validation at All Boundaries (Priority: P2)

**Goal**: All request bodies validated by Zod schemas; malformed inputs return HTTP 400 with structured errors.

**Independent Test**: `curl -X POST /api/health-sync -d '{"invalid":true}' -H 'x-api-token: valid'` → HTTP 400 `{"errors":{...}}`.

- [ ] T032 [US2] Apply `validate(HealthSyncSchema)` middleware to `POST /api/health-sync` in `src/index.ts` — confirm typed `req.body` in handler
- [ ] T033 [US2] Apply `validate(BatchSyncSchema)` middleware to `POST /api/health-sync/batch` — confirm typed `req.body`
- [ ] T034 [US2] Apply `validate(PairingRequestSchema)` middleware to `POST /api/pair`
- [ ] T035 [P] [US2] Write integration test `tests/integration/validation.test.ts` — tests: missing required field → 400, extra fields stripped, out-of-range value → 400 with field name
- [ ] T036 [US2] Confirm `npm test` passes with new validation tests

---

## Phase 5: User Story 3 — Pure Function Domain Logic (Priority: P3)

**Goal**: `ingest-service` and `batch-sync-service` are refactored to pure functions with injected dependencies, independently unit-testable.

**Independent Test**: Import `ingest` function in a unit test, pass mock `isDuplicate` / `save` fns, assert `IngestResult` — no Express, no SQLite, no filesystem.

- [ ] T037 [US3] Refactor `webhook-server/src/services/ingest-service.ts` — extract pure `ingest(record: unknown, deps: IngestDeps): IngestResult` function; define `IngestDeps` type with `isDuplicate`, `save` injected; keep existing exported factory for backwards-compat with route handler
- [ ] T038 [US3] Refactor `webhook-server/src/services/batch-sync-service.ts` — extract pure `processBatch(items: readonly unknown[], deps: BatchDeps): BatchSummary`; `BatchSummary` is `Readonly<{total, inserted, duplicates, failed}>`
- [ ] T039 [P] [US3] Create `webhook-server/tests/unit/ingest-service.test.ts` — unit tests: duplicate record returns `{status:'duplicate'}`, invalid record returns `{status:'failed'}`, valid record calls `save` once and returns `{status:'inserted'}`
- [ ] T040 [P] [US3] Create `webhook-server/tests/unit/batch-sync-service.test.ts` — unit tests: mixed batch returns correct counts, empty batch returns all-zero summary
- [ ] T041 [US3] Run `npm test` — confirm all unit tests pass with no I/O mocking overhead

---

## Phase 6: User Story 4 — All Tests Pass (Priority: P4)

**Goal**: 100% of pre-migration integration tests pass on migrated codebase + all new unit tests green.

**Independent Test**: `npm test` exits 0 with no skipped tests.

- [ ] T042 [US4] Migrate `webhook-server/tests/integration/helpers.ts` (from `helpers.js`) — add types
- [ ] T043 [P] [US4] Migrate `webhook-server/tests/integration/health-sync-batch.success.test.ts`
- [ ] T044 [P] [US4] Migrate `webhook-server/tests/integration/health-sync-batch.auth.test.ts`
- [ ] T045 [P] [US4] Migrate `webhook-server/tests/integration/health-sync-batch.partial.test.ts`
- [ ] T046 [US4] Update `package.json` test script to run TypeScript tests (via `ts-node` or compiled output)
- [ ] T047 [US4] Run full `npm test` — fix any remaining failures

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Lint, format, CI integration, and cleanup of any JS remnants.

- [ ] T048 Run `npm run lint` — fix all ESLint errors (no `any`, no `var`, no implicit types)
- [ ] T049 [P] Run `npm run format:check` — apply `prettier --write src tests` then verify
- [ ] T050 [P] Delete all original `.js` source files under `webhook-server/src/` and `webhook-server/index.js` after confirming `.ts` equivalents compile cleanly
- [ ] T051 [P] Update `webhook-server/README.md` — update build/run/test commands to reflect TypeScript setup
- [ ] T052 Commit all changes on `003-typescript-migration` branch with message: `feat: migrate webhook-server to TypeScript (strict, FP, Zod, tsgo)`

---

## Dependency Graph

```
Phase 1 (Setup)
    └─→ Phase 2 (Foundational: branded types, logger, schemas, middleware)
            ├─→ Phase 3 (US1: file-by-file migration, bottom-up)
            │       ├─→ Phase 4 (US2: apply Zod validation middleware)
            │       │       └─→ Phase 6 (US4: integration tests)
            │       └─→ Phase 5 (US3: pure function refactor + unit tests)
            │               └─→ Phase 6 (US4: unit tests)
            └─→ Phase 7 (Polish — after all stories complete)
```

## Parallel Execution Opportunities

**Phase 2** (after T008 branded types): T009, T010, T011, T012, T013 can all run in parallel.

**Phase 3** (after T013 storage done): T015–T018 can run in parallel; T019–T023 are sequential (persistence stack); T024–T028 can run in parallel with T019–T023.

**Phase 5**: T039 and T040 unit tests can be written in parallel with T037 and T038 refactoring (if using TDD approach).

**Phase 6**: T043–T045 test migrations are all parallel after T042 helpers.

## Implementation Strategy

**MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1) — delivers a fully typed, compiling codebase.
**Increment 2**: Phase 4 (US2) — runtime validation safety net.
**Increment 3**: Phase 5 (US3) — pure function refactor, unit test coverage.
**Increment 4**: Phase 6 + Phase 7 — full test pass + cleanup.

Total tasks: **52**
Parallelizable tasks: **22** (marked [P])
Estimated implementation phases: **7**
