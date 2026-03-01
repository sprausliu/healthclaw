# Implementation Plan: HealthClaw Webhook Config & Token Persistence

**Branch**: `001-webhook-token-persistence` | **Date**: 2026-02-20 | **Spec**: `/Users/crliu/Source/healthclaw/specs/001-webhook-token-persistence/spec.md`
**Input**: Feature specification from `/Users/crliu/Source/healthclaw/specs/001-webhook-token-persistence/spec.md`

## Summary

Refactor webhook persistence so runtime config/data and permanent sync token storage are decoupled from repository paths, support `npx` execution from arbitrary directories, and provide safe one-time migration from legacy `webhook-server/config.json` token storage without breaking existing paired devices.

## Technical Context

**Language/Version**: Node.js >= 18 (current runtime Node 22)  
**Primary Dependencies**: Express, body-parser, dotenv, Node built-ins (`fs`, `path`, `crypto`), optional credential-store adapter dependency  
**Storage**: User-level runtime files (config/data/jsonl/sqlite) + dedicated secret backend for permanent token  
**Testing**: Node unit + integration tests (startup path resolution, migration idempotency, auth behavior parity single vs batch)  
**Target Platform**: macOS/Linux/Windows hosts running webhook server  
**Project Type**: Single backend service  
**Performance Goals**: No material regression to existing sync latency; startup + migration check completes within normal service boot window (<3s in local baseline)  
**Constraints**: Backward-compatible sync API, no token in plain config after migration, repository tree stays runtime-artifact free, safe failure behavior on secret read errors  
**Scale/Scope**: Single webhook deployment per operator with long-lived paired device and historical health ingestion

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Constitution file in this repo is still template-only and does not define enforceable project-specific gates.
- Applying conservative project gates for this feature:
  - Preserve existing sync API behavior for currently paired clients.
  - Treat permanent token as secret material and keep out of plain config.
  - Migration must be one-time and non-destructive to pairing continuity.

**Post-Phase-1 Re-check**: PASS. Research/data model/contracts/quickstart preserve compatibility and safety gates.

## Project Structure

### Documentation (this feature)

```text
specs/001-webhook-token-persistence/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
webhook-server/
├── index.js
├── https-server.js
├── src/
│   ├── middleware/
│   ├── services/
│   ├── storage/
│   ├── dedupe/
│   └── contracts/
├── tests/
│   ├── unit/
│   └── integration/
└── package.json

# Runtime outputs (outside repository source tree; user-level app data path)
<user-data-root>/healthclaw-webhook/
├── config.json              # non-secret runtime config
├── health-data.jsonl
├── dedupe.db
└── migration-state.json     # optional if not embedded

# Secret storage (outside plain config)
<secret-backend>/
└── device-permanent-token
```

**Structure Decision**: Keep existing single-service layout in `webhook-server/`; introduce a persistence abstraction that resolves external runtime/secrets locations so repository code directories remain clean under normal operation.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| None | N/A | N/A |
