# Feature Specification: HealthClaw Webhook Config & Token Persistence

**Feature Branch**: `001-webhook-token-persistence`  
**Created**: 2026-02-20  
**Status**: Draft  
**Input**: User description: "Refactor HealthClaw webhook for npm/npx deployment by moving runtime config and persistent API tokens out of repository directories into proper user data/secrets storage, with migration from existing config.json and cleaner repo layout."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Run reliably via npx without repo-bound config (Priority: P1)

As an operator, I can start the webhook from any working directory (including npx execution) and it still loads/saves its runtime state correctly, without depending on repository-local files.

**Why this priority**: This is the core deployment objective. If runtime state remains tied to project folders, npx distribution is not viable.

**Independent Test**: Start the webhook from a clean directory that does not contain project files, pair a device, and verify the service restarts with state preserved.

**Acceptance Scenarios**:

1. **Given** the webhook is launched outside the repository, **When** it starts, **Then** it creates/uses a stable user-level data location and remains functional.
2. **Given** the webhook has existing runtime state, **When** the process restarts from a different working directory, **Then** prior non-secret configuration is still available.

---

### User Story 2 - Protect persistent sync token outside normal config files (Priority: P1)

As an operator, I need the permanent API token to be persisted in a secure secrets location (not plain repository config), so that long-lived credentials are less exposed and safer to manage.

**Why this priority**: Token storage is a security-sensitive requirement and a blocker for safe public package usage.

**Independent Test**: Pair once, inspect generated files, and confirm no plain token is stored in normal config files while sync endpoints still authenticate successfully.

**Acceptance Scenarios**:

1. **Given** a successful pair operation, **When** permanent credentials are saved, **Then** they are stored in the secrets store and excluded from plain runtime config.
2. **Given** valid sync requests to single and batch endpoints, **When** authentication is evaluated, **Then** both endpoints accept valid credentials and reject invalid credentials consistently.

---

### User Story 3 - Migrate existing installs without breaking ingestion (Priority: P2)

As an existing user, I want old `config.json`-based token data to migrate automatically, so upgrades do not break paired devices or require manual re-pairing.

**Why this priority**: Backward compatibility reduces upgrade risk and avoids operational disruption.

**Independent Test**: Start the new version with a legacy config present and confirm migration occurs once, token-based sync still works, and legacy secret material is removed from plain config.

**Acceptance Scenarios**:

1. **Given** a legacy installation with token in repo-local config, **When** the upgraded service starts, **Then** it migrates credential data to the new persistence model automatically.
2. **Given** migration already completed, **When** the service restarts, **Then** migration is not repeated and service behavior remains stable.

---

### User Story 4 - Keep repository clean and portable (Priority: P3)

As a maintainer, I want repository directories to remain code-focused (not runtime state dumps), so packaging, review, and publishing stay clean.

**Why this priority**: This supports maintainability and distribution quality, but depends on core persistence changes above.

**Independent Test**: Run normal operations (pair + sync) and verify repository status remains free of newly generated runtime config/data artifacts.

**Acceptance Scenarios**:

1. **Given** normal webhook operations, **When** runtime data changes, **Then** generated artifacts are written outside repository code directories.

### Edge Cases

- How does the system behave if secrets storage is temporarily unavailable at startup?
- How does migration behave when legacy config exists but token content is missing/corrupted?
- How does the system behave if multiple start attempts occur during first-run initialization?
- How does the system behave when operator explicitly sets custom storage paths?
- How does the system behave when token lookup fails for one request while service remains otherwise healthy?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST resolve runtime persistence paths independent of current working directory.
- **FR-002**: System MUST store non-sensitive runtime configuration separately from secret credentials.
- **FR-003**: System MUST persist permanent API token material in a secrets storage mechanism intended for sensitive values.
- **FR-004**: System MUST ensure plain runtime config files do not contain permanent API tokens after migration or new pairing.
- **FR-005**: System MUST keep authentication behavior consistent between single-sync and batch-sync endpoints.
- **FR-006**: System MUST provide automatic one-time migration from legacy token location when legacy data is detected.
- **FR-007**: System MUST make migration idempotent so repeated restarts do not duplicate or corrupt migrated state.
- **FR-008**: System MUST preserve existing paired-device usability after successful migration (no forced re-pair required).
- **FR-009**: System MUST surface clear operator-facing status/error messages for persistence initialization and migration outcomes.
- **FR-010**: System MUST support explicit operator override for storage location through documented configuration inputs.
- **FR-011**: System MUST avoid writing runtime data artifacts into repository source directories during standard operation.
- **FR-012**: System MUST fail safely when credential storage cannot be read, returning authentication failure without exposing sensitive internals.

### Key Entities _(include if feature involves data)_

- **Runtime Configuration Profile**: Non-secret operational settings (e.g., service options, pairing metadata, timestamps, path metadata).
- **Persistent Credential Record**: Sensitive authentication material for a paired device, managed in secret storage and referenced by runtime logic.
- **Migration State Record**: Metadata that indicates whether legacy credential migration has been attempted/completed and with what result.
- **Device Identity Record**: Stable identifier and descriptive metadata representing a paired client device.

## Assumptions

- Existing users may already have repository-local `config.json` with a valid permanent token.
- Operators may run the webhook via `npx` from arbitrary directories and expect identical behavior.
- A secure secret persistence mechanism is available on target environments, with a documented fallback path when unavailable.
- Current API contract for sync endpoints remains unchanged from operator/device perspective.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In a clean environment, operators can start and pair the webhook from outside the repository in under 10 minutes without manual file-path edits.
- **SC-002**: After pairing and restart, 100% of validation checks confirm no permanent token appears in plain runtime config files.
- **SC-003**: At least 95% of upgrade tests from legacy config complete automatic migration successfully without requiring device re-pairing.
- **SC-004**: During regression tests, single-sync and batch-sync authentication outcomes match for all valid/invalid token test cases.
- **SC-005**: After normal operational runs, repository working tree contains zero newly generated runtime persistence artifacts.
