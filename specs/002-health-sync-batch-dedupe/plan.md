# Implementation Plan: Batch Sync, Deduplication, and Cleanup APIs

**Branch**: `002-health-sync-batch-dedupe` | **Date**: 2026-02-19 | **Spec**: `/Users/crliu/Source/healthclaw/specs/002-health-sync-batch-dedupe/spec.md`
**Input**: Feature specification from `/Users/crliu/Source/healthclaw/specs/002-health-sync-batch-dedupe/spec.md`

## Summary

Add a batch sync endpoint for manual backfill efficiency, enforce idempotent ingestion via deterministic dedupe keys, and provide safe admin cleanup APIs (preview + execute with backup) to remove existing duplicates and scoped historical data without breaking current single-record clients.

## Technical Context

**Language/Version**: Node.js >= 18 (current runtime Node 22)
**Primary Dependencies**: Express, body-parser, dotenv, Node built-ins (`crypto`, `fs`, `path`), SQLite driver (`better-sqlite3` or equivalent)
**Storage**: Existing JSONL file for record log + local SQLite dedupe/cleanup index
**Testing**: Node integration tests via HTTP request harness + unit tests for dedupe key generation and cleanup filtering
**Target Platform**: macOS/Linux host running webhook server process
**Project Type**: Single backend service (webhook server)
**Performance Goals**: Process 1,000-record batch within 10s under normal local deployment; constant-time duplicate lookup
**Constraints**: Preserve backward compatibility for `/api/health-sync`; partial-success batch semantics; cleanup must be admin-gated and backup-first
**Scale/Scope**: Single-user health stream with historical backfill (10^5+ records over time)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Constitution file is a placeholder template and defines no enforceable project-specific gates.
- No explicit constitutional violations detected for this plan.
- Proceeding with conservative gates for this feature:
  - Backward compatibility for existing sync client is mandatory.
  - Destructive cleanup operations require explicit confirmation and backup.

**Post-Phase-1 Re-check**: PASS. Design artifacts preserve compatibility and safety gates.

## Project Structure

### Documentation (this feature)

```text
specs/002-health-sync-batch-dedupe/
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
├── index.js                 # existing HTTP routes and handlers
├── package.json             # dependencies/scripts
├── data/                    # new runtime artifacts (db/backups; gitignored)
│   ├── dedupe.db
│   └── backups/
└── tests/                   # new test suite for feature
    ├── unit/
    │   ├── dedupe-key.test.js
    │   └── validation.test.js
    ├── integration/
    │   ├── health-sync-batch.test.js
    │   └── cleanup-api.test.js
    └── fixtures/
        └── sample-health-records.json
```

**Structure Decision**: Use the existing single backend service structure under `webhook-server/`; add focused runtime data directory and tests without introducing new top-level services.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| None | N/A | N/A |
