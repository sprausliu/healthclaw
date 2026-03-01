# Research: Webhook Config & Token Persistence for npx Deployment

## Decision 1: Use OS-specific user data directory for non-secret runtime state
- **Decision**: Store runtime configuration/state in a stable user-level application data path instead of repository-relative files.
- **Rationale**: `npx` execution and arbitrary working directories require path independence; user-level paths survive upgrades and restarts.
- **Alternatives considered**:
  - Keep repository-local files: breaks portability and pollutes git working tree.
  - Temporary directory storage: not durable and unsafe for long-lived pairing state.

## Decision 2: Separate secret token storage from regular config storage
- **Decision**: Persist permanent API token in a dedicated secret store and keep non-sensitive settings in regular config.
- **Rationale**: Reduces accidental credential exposure and supports safer npm package usage.
- **Alternatives considered**:
  - Store token in same JSON config: easy but high leakage risk.
  - Environment-variable only token: hard for persistent per-device pairing lifecycle.

## Decision 3: Prefer system credential store with documented fallback
- **Decision**: Use platform credential store as primary secret backend; fallback to restricted local secret file only when system store is unavailable.
- **Rationale**: Provides stronger default protection across macOS/Linux/Windows while keeping deployment practical in constrained hosts.
- **Alternatives considered**:
  - Force system credential store only: can fail in headless/minimal environments.
  - Always local encrypted file: weaker security baseline and key management complexity.

## Decision 4: Introduce explicit migration state metadata
- **Decision**: Track migration progress/status in runtime state so migration is one-time and idempotent.
- **Rationale**: Prevents repeated migration side effects and gives operators clear diagnostics.
- **Alternatives considered**:
  - Infer migration only from file absence/presence: ambiguous and brittle.

## Decision 5: Keep existing API contracts unchanged for sync clients
- **Decision**: Preserve current `/api/health-sync` and `/api/health-sync/batch` request/response behavior and token header usage from client perspective.
- **Rationale**: Avoids breaking existing paired devices while changing server-side persistence internals.
- **Alternatives considered**:
  - New auth headers/endpoint version bump now: larger rollout blast radius.

## Decision 6: Add safe failure behavior when secret lookup fails
- **Decision**: If token retrieval fails at runtime, return standard authentication failure and structured operator logs, without exposing secret backend details.
- **Rationale**: Protects internals and keeps behavior predictable for clients.
- **Alternatives considered**:
  - Surface raw storage errors in API response: leaks internals and increases attack intelligence.

## Decision 7: Support operator override for storage root paths
- **Decision**: Allow explicit override of runtime/secrets storage roots via documented configuration inputs.
- **Rationale**: Enables custom deployment layouts (e.g., containers, managed hosts) without source edits.
- **Alternatives considered**:
  - Hardcode only default paths: simpler but operationally inflexible.

## Decision 8: Remove secret material from legacy config after successful migration
- **Decision**: After migration succeeds, legacy token fields are removed/redacted from plain config while preserving non-secret paired metadata.
- **Rationale**: Avoids duplicate secret sources and lowers residual risk.
- **Alternatives considered**:
  - Keep legacy token for fallback: creates long-term secret sprawl.
