<!-- Sync Impact Report
Version change: (new) → 1.0.0
Added sections: Core Principles (I–V), Tech Stack, Development Workflow, Governance
Templates requiring updates:
  ✅ constitution.md (this file)
  ⚠ plan-template.md (review for principle-aligned sections)
  ⚠ spec-template.md (review for scope alignment)
  ⚠ tasks-template.md (review for task categorization)
Follow-up TODOs: none
-->

# HealthClaw Webhook Server Constitution

## Core Principles

### I. TypeScript-First (NON-NEGOTIABLE)

All source code MUST be written in TypeScript. JavaScript files are only permitted for
configuration tooling that does not support TypeScript (e.g., some config files).

- `strict: true` is MANDATORY — no exceptions.
- `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` MUST all be enabled.
- `any` is FORBIDDEN. Use `unknown` and narrow explicitly, or define a proper type.
- All public function signatures MUST have explicit return types.
- Prefer `type` aliases over `interface` for data shapes; use `interface` only when
  extension via declaration merging is intentional.
- Branded/opaque types MUST be used for domain identifiers (e.g., `DeviceToken`, `SyncId`).
- Type assertions (`as`) are FORBIDDEN unless paired with a runtime guard.
- The project compiler is **tsgo** (`@typescript/native-preview`). Never invoke `tsc` directly.
  Compile check: `tsgo --noEmit`. Build: `tsgo`.

Rationale: A fully typed codebase eliminates entire classes of runtime errors and makes
refactoring safe at scale. tsgo provides significantly faster incremental compilation.

### II. Functional Programming (NON-NEGOTIABLE)

Business logic MUST be expressed as pure functions with no side effects.

- A **pure function** takes inputs and returns outputs. It MUST NOT mutate arguments,
  read/write global state, perform I/O, or produce non-deterministic results.
- Side effects (I/O, DB writes, network calls) MUST be pushed to the edges — entry
  points, route handlers, service bootstrappers — and kept out of domain logic.
- Prefer function composition over class hierarchies. Classes are permitted only for
  stateful infrastructure concerns (e.g., database repositories, connection pools).
- `this` binding inside business logic is a code smell.
- Prefer `map`, `filter`, `reduce`, and pipeline patterns over imperative loops.
- Avoid `for`/`while` loops in domain logic; use array methods or recursive helpers.
- Functions SHOULD be small, single-purpose, and independently testable.

Rationale: Pure functions are trivially testable, predictable, and composable.
Side-effect isolation makes the system easier to reason about and mock in tests.

### III. Immutability (NON-NEGOTIABLE)

All data objects MUST be treated as immutable after construction.

- `const` MUST be used for all variable declarations. `let` is only permitted when
  a value genuinely needs reassignment (e.g., loop counters, accumulator variables).
  `var` is FORBIDDEN.
- All object type properties MUST be declared `readonly`. Use `Readonly<T>` or
  `ReadonlyArray<T>` wrappers for external data.
- Mutation of function arguments is FORBIDDEN. Return new objects instead.
- Use spread (`{ ...obj, key: value }`) or `structuredClone` for derived objects.
- `Object.freeze` SHOULD be applied to module-level constants and config objects.
- Avoid classes with mutable instance fields in domain logic. Prefer factory functions
  returning readonly records.

Rationale: Immutability eliminates a wide class of bugs caused by shared mutable state,
makes concurrent operations safe, and simplifies debugging.

### IV. Type Safety & API Contracts

All external boundaries MUST be validated at runtime with schema libraries.

- All HTTP request bodies, query params, and external data MUST be validated using
  **Zod** schemas before being used.
- Zod schemas are the single source of truth for both runtime validation and TypeScript
  types (`z.infer<typeof Schema>`). Do not duplicate type definitions.
- All internal module APIs MUST expose typed interfaces — no untyped `object` or
  `Record<string, unknown>` returns for domain data.
- Error handling MUST be explicit. Use `Result<T, E>` pattern (or similar discriminated
  union) rather than throwing in domain logic. Only route handlers and top-level entry
  points may `throw` / `catch`.
- All async functions MUST handle rejection explicitly. Unhandled promise rejections
  are FORBIDDEN.

Rationale: Runtime validation at boundaries prevents malformed external data from
propagating into the system. Explicit error handling makes failure modes visible.

### V. Observability & Simplicity

The system MUST be observable and kept as simple as possible.

- All significant operations MUST emit structured JSON logs with fields:
  `level`, `timestamp`, `message`, and relevant context (no `console.log` strings).
- Log levels MUST be used correctly: `debug` (dev only), `info` (normal ops),
  `warn` (recoverable anomaly), `error` (requires action).
- Every route handler MUST log the outcome (success or failure with context).
- YAGNI: Do not add abstractions until needed by two or more concrete use cases.
- Complexity MUST be justified. Simpler solutions are preferred even if slightly less
  elegant.
- Every module MUST have a single, clearly stated responsibility (SRP).

Rationale: Observability reduces time-to-debug in production. Simplicity reduces
maintenance burden and onboarding friction.

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Compiler**: tsgo (`@typescript-go/tsgo`) — `tsgo --noEmit` for type checks, `tsgo` for build
- **Runtime**: Node.js ≥ 22 (LTS)
- **Framework**: Express (type-annotated with `@types/express`)
- **Validation**: Zod
- **Database**: better-sqlite3 (type-annotated with `@types/better-sqlite3`)
- **Testing**: Node.js built-in test runner (`node:test`) + `supertest`
- **Package manager**: npm
- **Linting**: ESLint with `@typescript-eslint`
- **Formatting**: Prettier

## Development Workflow

- **Feature branches**: `feat/<slug>`, **fix branches**: `fix/<slug>`
- All code MUST pass `tsgo --noEmit` before commit. CI will reject type errors.
- Tests MUST pass (`npm test`) before merging.
- Pure domain logic MUST have unit tests. Route handlers MUST have integration tests.
- No `console.log` in committed code — use the structured logger.
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- PR descriptions MUST list changed services and any breaking API changes.

## Governance

This constitution supersedes all prior coding conventions in the HealthClaw Webhook Server
project. All new code and all code touched during refactoring MUST comply.

Amendments require:
1. A written rationale explaining the change and its impact.
2. A version bump following semantic versioning (see below).
3. Update to this file and any dependent templates.

Version policy:
- MAJOR: Principle removals or redefinitions that break existing patterns.
- MINOR: New principle or section added.
- PATCH: Clarifications, wording, non-semantic refinements.

Compliance is verified at code review. Non-compliant code MUST NOT be merged.

**Version**: 1.0.0 | **Ratified**: 2026-02-24 | **Last Amended**: 2026-02-24
