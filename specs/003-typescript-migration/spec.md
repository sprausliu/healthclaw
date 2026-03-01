# Feature Specification: TypeScript Migration & Code Quality Uplift

**Feature Branch**: `003-typescript-migration`
**Created**: 2026-02-24
**Status**: Draft
**Input**: Migrate the HealthClaw webhook server from JavaScript to TypeScript with
functional programming principles, immutable data patterns, Zod validation, and tsgo as
the compiler.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Developer can build and type-check the project with zero errors (Priority: P1)

A developer clones the repo, installs dependencies, and runs `npm run typecheck` and
`npm run build`. Both commands succeed without errors or warnings. All source files are
TypeScript, all types are explicit, and no `any` escapes remain.

**Why this priority**: This is the foundation. Every other story depends on the project
compiling cleanly. A broken build blocks all contributors.

**Independent Test**: Run `tsgo --noEmit` on the fully migrated source tree and confirm
exit code 0 with no diagnostics.

**Acceptance Scenarios**:

1. **Given** the migrated codebase, **When** `npm run typecheck` is executed, **Then**
   it exits 0 with no type errors or implicit-any warnings.
2. **Given** the migrated codebase, **When** `npm run build` is executed, **Then**
   compiled output is produced in `dist/` and the server starts successfully.
3. **Given** a developer introduces a type error (e.g., passing `string` where `number`
   is expected), **When** they run `npm run typecheck`, **Then** a clear, actionable
   error is reported with file name and line number.
4. **Given** the compiled output, **When** the server is started, **Then** all existing
   HTTP endpoints respond identically to the pre-migration behaviour.

---

### User Story 2 — All external inputs are validated at runtime with clear error messages (Priority: P2)

When the server receives a malformed health-sync payload, a request with missing
required fields, or a batch with invalid items, it rejects the request with a
structured error response. The rejection is consistent and informative — it tells the
caller exactly which field failed and why.

**Why this priority**: Runtime validation is the safety layer between external data and
the domain. Without it, bad data silently corrupts the data store.

**Independent Test**: Send a malformed JSON body to `/api/health-sync` and verify the
response is 400 with a structured `errors` array describing the validation failures.

**Acceptance Scenarios**:

1. **Given** a valid paired device, **When** a health-sync request is sent with a
   missing required field, **Then** the response is HTTP 400 with a JSON body listing
   the missing field(s).
2. **Given** a valid paired device, **When** a batch request contains a mix of valid and
   invalid items, **Then** valid items are accepted, invalid items are rejected with
   per-item error details, and the overall response reports both counts.
3. **Given** a request with extra unknown fields, **When** ingested, **Then** the
   extra fields are stripped and do not appear in the stored record.
4. **Given** a request with a field value outside the allowed range (e.g., heart rate
   of -5), **When** validated, **Then** the request is rejected with a descriptive
   error referencing that specific field.

---

### User Story 3 — Business logic is isolated as pure functions, independently testable (Priority: P3)

All domain logic (deduplication, record transformation, batch summarisation, validation
rules) exists as pure functions that can be tested without starting an HTTP server, a
database, or any I/O infrastructure. Test files import the functions directly and assert
outputs given inputs.

**Why this priority**: Pure-function isolation dramatically reduces test setup cost and
makes logic verifiable without integration overhead.

**Independent Test**: Import `ingest-service` logic functions directly in a test file,
pass synthetic inputs, and assert outputs — no Express, no SQLite, no filesystem.

**Acceptance Scenarios**:

1. **Given** a record that has already been synced, **When** the deduplication function
   is called with that record's ID, **Then** it returns a result indicating duplication
   without performing any write.
2. **Given** a batch of 5 items where 2 are duplicates and 1 is invalid, **When** the
   batch processing function is called, **Then** it returns a summary with
   `inserted: 2`, `duplicates: 2`, `failed: 1` — with no database interaction required
   in the test.
3. **Given** two records with different data shapes, **When** the transformation
   function is applied, **Then** a correctly shaped domain record is returned without
   mutation of the input.

---

### User Story 4 — All existing tests pass after migration; new tests cover key pure functions (Priority: P4)

Every test that passed before the migration continues to pass after. New unit tests are
added for the pure domain functions introduced in Story 3. CI runs both test suites.

**Why this priority**: Test continuity proves the migration is behaviour-preserving.
New unit tests lock in the correctness of the refactored logic.

**Independent Test**: Run `npm test` on the migrated codebase and observe 100% of prior
tests passing plus new unit tests covering at least the deduplication and batch
summarisation functions.

**Acceptance Scenarios**:

1. **Given** the migrated codebase, **When** `npm test` is run, **Then** all
   previously-passing integration tests continue to pass.
2. **Given** the new pure-function unit tests, **When** `npm test` is run, **Then**
   they all pass with no mocking of I/O dependencies.
3. **Given** a regression introduced into a domain function, **When** tests are run,
   **Then** the relevant unit test catches it before the integration tests run.

---

## Functional Requirements _(mandatory)_

### FR-1: TypeScript Compilation

- All `.js` source files under `src/` and `index.js` MUST be converted to `.ts`.
- The project MUST use **tsgo** (`@typescript-go/tsgo`) as the compiler.
- `tsconfig.json` MUST enable `strict`, `noImplicitAny`, `strictNullChecks`,
  `strictFunctionTypes`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- `outDir` MUST be set to `dist/`. `rootDir` to `src/`.
- `npm run typecheck` → `tsgo --noEmit`
- `npm run build` → `tsgo`

### FR-2: Immutability

- All object/array type annotations MUST use `readonly` or `ReadonlyArray<T>`.
- No function argument MUST be mutated. Derived values MUST use spread or clone.
- `const` MUST replace all `let`/`var` declarations where the value is not reassigned.
- `var` is FORBIDDEN everywhere.

### FR-3: Functional Domain Logic

- The `ingest-service`, `batch-sync-service`, and deduplication logic MUST be refactored
  into pure functions that accept typed inputs and return typed outputs.
- Side-effecting operations (DB writes, file appends) MUST be injected as typed
  function parameters (dependency injection), not imported as module-level globals.
- Class usage MUST be limited to repository/infrastructure adapters.

### FR-4: Zod Validation

- Zod MUST be added as a runtime dependency.
- All HTTP request bodies (health-sync, batch, pairing) MUST be validated against
  a Zod schema at the route handler level, before reaching domain logic.
- Zod-inferred types (`z.infer<typeof Schema>`) MUST replace manually-declared
  duplicate interfaces for request/response shapes.
- Validation errors MUST be surfaced as HTTP 400 with a structured JSON body.

### FR-5: Branded Types for Domain Identifiers

- `DeviceToken`, `PairingToken`, `SyncId`, and similar identifiers MUST be
  branded types (opaque `string & { _brand: '...' }`).
- Raw `string` MUST NOT be used for these values in function signatures.

### FR-6: Structured Logging

- All `console.log`, `console.error`, `console.warn` calls MUST be replaced with a
  structured logger that emits JSON with fields: `level`, `timestamp`, `message`,
  plus relevant context.
- Log level MUST be configurable via environment variable (`LOG_LEVEL`).

### FR-7: ESLint + Prettier

- ESLint MUST be configured with `@typescript-eslint` recommended rules.
- `no-explicit-any`, `no-var`, `prefer-const` rules MUST be enabled and set to `error`.
- Prettier MUST be configured for consistent formatting.
- `npm run lint` and `npm run format:check` MUST succeed on CI.

### FR-8: Backwards-Compatible Runtime Behaviour

- All existing HTTP endpoints MUST respond with identical status codes, field names,
  and semantics after migration.
- The pairing flow, token validation, batch ingestion, and admin routes MUST behave
  identically from the perspective of the HealthClaw iOS app.
- No breaking changes to the on-disk data format (JSONL, SQLite schema).

---

## Success Criteria _(mandatory)_

1. `npm run typecheck` exits 0 with zero diagnostics on the fully migrated codebase.
2. `npm run build` produces a runnable server in `dist/` that passes all integration
   tests.
3. `npm test` passes 100% of existing tests plus new unit tests for domain functions.
4. `npm run lint` exits 0 — no `any` escapes, no `var`, no `let` for constants.
5. Sending a malformed payload to any API endpoint returns HTTP 400 with a structured
   JSON error body within 200 ms.
6. A developer unfamiliar with the codebase can locate the domain logic for any
   endpoint in under 5 minutes, because pure functions are co-located with their
   responsibility.
7. The HealthClaw iOS app continues to sync data successfully after deployment of the
   migrated server.

---

## Key Entities

| Entity | Description |
|---|---|
| `DeviceToken` | Branded string — permanent credential issued on pairing |
| `PairingToken` | Branded string — short-lived token for device pairing flow |
| `SyncId` | Branded string — unique identifier for deduplication of health records |
| `HealthRecord` | Readonly domain record representing a single health data point |
| `BatchSummary` | Readonly result of a batch sync: counts of inserted / duplicate / failed |
| `ValidationResult<T>` | Discriminated union: `{ ok: true; value: T }` or `{ ok: false; errors: ZodError }` |
| `IngestResult` | Discriminated union: `inserted` / `duplicate` / `failed` |

---

## Assumptions

- The tsgo compiler (`@typescript-go/tsgo`) supports all TypeScript features used by
  the project. The migration team will validate this early and fall back to `tsc` only
  if a blocker is found.
- Existing tests use Node.js built-in `node:test`; no test framework change is required.
- The SQLite schema does not change; only the TypeScript interface describing it is
  introduced.
- The iOS app communicates with the server only via documented HTTP endpoints; no
  internal implementation details are exposed to the client.
- `supertest` works with the TypeScript-compiled server via `ts-node` or compiled
  output in tests.

---

## Out of Scope

- Switching the HTTP framework (Express remains).
- Changing the database engine (better-sqlite3 remains).
- Adding new API endpoints or changing existing API contracts.
- iOS app changes.
- Deployment infrastructure changes.
