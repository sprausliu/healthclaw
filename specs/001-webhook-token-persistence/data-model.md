# Data Model: Webhook Config & Token Persistence

## 1) RuntimeConfigProfile
Non-sensitive runtime configuration persisted in user data storage.

**Fields**
- `serviceVersion` (string)
- `paired` (boolean)
- `deviceInfo` (object, optional)
- `pairedAt` (ISO-8601 string, optional)
- `lastSync` (ISO-8601 string, optional)
- `storageVersion` (integer)
- `migration` (MigrationState, optional)

**Validation Rules**
- Must never contain permanent API token value.
- Unknown fields are tolerated for forward compatibility.

## 2) SecretCredentialRecord
Sensitive credential state for sync authentication.

**Fields**
- `deviceId` (string)
- `tokenRef` (string; locator/identifier in secret backend)
- `tokenMaterial` (string; only in secret backend, never plain config)
- `createdAt` (ISO-8601 string)
- `rotatedAt` (ISO-8601 string, optional)
- `revokedAt` (ISO-8601 string, optional)

**Validation Rules**
- Exactly one active token per paired device.
- Active token must be retrievable at request-auth time.

## 3) MigrationState
Tracks one-time migration from legacy repo-local config.

**Fields**
- `status` (enum: `not-started` | `in-progress` | `completed` | `failed`)
- `startedAt` (ISO-8601 string, optional)
- `completedAt` (ISO-8601 string, optional)
- `errorCode` (string, optional)
- `legacySourcePath` (string, optional)

**State Transitions**
- `not-started -> in-progress -> completed`
- `in-progress -> failed`
- `failed -> in-progress` (retry path)
- `completed` is terminal unless explicit migration reset.

## 4) StorageResolutionContext
Resolved path/backend metadata used at startup.

**Fields**
- `runtimeConfigPath` (string)
- `healthDataPath` (string)
- `dedupeDbPath` (string)
- `secretBackend` (enum: `system-store` | `file-fallback`)
- `overrideApplied` (boolean)

## Relationships
- One `RuntimeConfigProfile` references one active `SecretCredentialRecord` for paired mode.
- One `MigrationState` is embedded in `RuntimeConfigProfile` to ensure idempotent upgrades.
- One `StorageResolutionContext` governs where `RuntimeConfigProfile` and related files are read/written.
