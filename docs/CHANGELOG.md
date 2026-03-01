# Changelog

All notable changes to the HealthClaw project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Webhook Token Persistence & Portability

#### Directory-Independent Operation
- Webhook server now stores all runtime data in user-level application directories (not repository)
- Platform-specific data locations:
  - macOS: `~/Library/Application Support/healthclaw-webhook`
  - Linux: `~/.local/share/healthclaw-webhook`
  - Windows: `%APPDATA%\healthclaw-webhook`
- Service can be run from any directory using `npx healthclaw-webhook-server`
- Support for `HEALTHCLAW_DATA_DIR` environment variable to override default data location
- Startup diagnostics showing resolved data directory and secret backend type
- Warning when runtime data directory resolves inside repository tree

#### Secure Token Storage
- Permanent device tokens now stored in OS-native secret storage (keychain/credential manager)
- File-based fallback for environments without system keychain support
- Secret files created with restricted permissions (0700 directory, 0600 file on Unix-like systems)
- Token redaction guards prevent accidental logging of credentials
- Constant-time token comparison prevents timing attacks
- Support for `HEALTHCLAW_SECRET_BACKEND` environment variable to force backend selection

#### Legacy Migration
- Automatic one-time migration from repository-based `config.json` to new persistence model
- Idempotent migration with state tracking to prevent duplicate runs
- Token automatically moved from plain config to secure secret storage
- Legacy config files redacted with migration marker after successful migration
- Graceful failure handling allows service to continue if migration fails
- Migration status logging on startup for operator visibility

#### Repository Cleanliness
- Runtime artifacts (config.json, health-data.jsonl, dedupe.db) no longer created in repository
- `.gitignore` updated to exclude legacy runtime artifacts
- Maintainer documentation for release packaging and repo cleanliness verification

#### Documentation
- New `docs/persistence.md` explaining persistence architecture and storage behavior
- Updated README.md with persistence configuration and troubleshooting
- Migration runbook for upgrading from legacy versions
- Quickstart validation guide with repository cleanliness checks
- OpenAPI contract notes aligned with new authentication behavior

### Changed

#### Breaking Changes (with Migration Path)
- Runtime configuration path changed from `./config.json` to user-level directory
- Permanent token storage moved from config file to secret backend
- Health data file path changed from `./memory/health-data.jsonl` to user-level directory
- Deduplication database path changed from `./data/dedupe.db` to user-level directory

**Migration**: Automatic on first startup of new version. Existing paired devices continue working without re-pairing.

#### Internal Refactoring
- Extracted persistence layer into modular services:
  - `PathResolver`: Platform-aware path resolution
  - `RuntimeConfigRepository`: Non-secret config storage
  - `SecretStore`: Pluggable secret backend (system/file)
  - `CredentialService`: Token save/load/verify operations
  - `LegacyConfigMigrator`: Migration from old config format
  - `MigrationState`: State tracking for idempotent migrations
  - `PersistenceBootstrap`: Orchestration of initialization sequence
- Authentication logic now uses `CredentialService` for token verification
- All runtime paths resolved via `PathResolver` (no hardcoded relative paths)

#### API Behavior
- Authentication behavior unchanged for clients (same `X-API-Token` header)
- Pairing flow unchanged from client perspective
- Error responses remain the same (no secret internals exposed)

### Fixed
- Repository no longer accumulates runtime data files during normal operation
- Service now works correctly when run via `npx` from arbitrary directories
- Token storage now uses appropriate platform-specific secure storage mechanisms

### Security
- Permanent tokens no longer stored in plain text configuration files
- Tokens never logged in full (redacted prefixes only)
- Constant-time comparison prevents timing attacks on token verification
- Secret files created with owner-only permissions on Unix-like systems
- Authentication failures return generic errors without exposing secret storage internals

---

## Future Releases

Release versions will be documented here as they are published.
