# Persistence Architecture

## Overview

The HealthClaw webhook server uses a layered persistence architecture that separates runtime configuration from secret credentials and ensures the service can run from any directory (including via `npx`).

## Key Concepts

### User-Level Data Storage

All runtime data is stored in a user-level application data directory, **not** in the repository:

- **macOS**: `~/Library/Application Support/healthclaw-webhook`
- **Linux**: `~/.local/share/healthclaw-webhook`
- **Windows**: `%APPDATA%\healthclaw-webhook`

You can override this location by setting the `HEALTHCLAW_DATA_DIR` environment variable.

### Secret Backend

Permanent device tokens are stored separately from runtime configuration using a secure secret backend:

1. **System Keychain** (preferred): Uses OS-native secret storage
   - macOS: Keychain Access
   - Linux: libsecret/secret-tool
   - Windows: Credential Manager

2. **File-based fallback**: If system keychain is unavailable, secrets are stored in a restricted-permission file at `~/.local/share/healthclaw-webhook/.secrets/device-token` (or platform equivalent)

You can explicitly choose a backend with the `HEALTHCLAW_SECRET_BACKEND` environment variable (`system` or `file`).

## Startup Behavior

### Bootstrap Process

1. **Path Resolution**: Determines user-level data directory based on platform
2. **Directory Creation**: Creates required directories with appropriate permissions
3. **Secret Store Initialization**: Initializes the secret backend (system or file fallback)
4. **Runtime Config Loading**: Loads non-secret configuration from `config.json`
5. **Legacy Migration** (if needed): Automatically migrates token from legacy `config.json` in repository

### Diagnostics

On startup, the server logs:

```
[healthclaw] Persistence initialized
[healthclaw] Data directory: /Users/username/Library/Application Support/healthclaw-webhook
[healthclaw] Secret backend: system
```

This helps operators verify the runtime environment is configured correctly.

## Authentication Flow

### Pairing

When a device pairs:

1. Temporary pairing token is validated
2. Permanent API token is generated
3. **Token is stored in secret backend** (NOT in config.json)
4. Device metadata (info, paired timestamp) is stored in config.json
5. Config includes `tokenStored: true` flag to indicate secret is present

### Sync Endpoints

Both `/api/health-sync` (single) and `/api/health-sync/batch` use the same authentication:

1. Client sends `X-API-Token` header
2. Server loads token from secret backend
3. Constant-time comparison prevents timing attacks
4. On verification failure, generic error is returned (no secret internals exposed)

### Safe Failure Behavior

If credential storage cannot be read:

- Authentication returns `401 Unauthorized` with a generic error message
- No secret internals (paths, backend type, or partial tokens) are exposed in error responses
- Error is logged server-side for operator troubleshooting

## Security Guarantees

### Token Redaction

The credential service includes built-in redaction guards:

- Tokens are NEVER logged in full
- Only redacted prefixes (e.g., `abc12345...[REDACTED]`) appear in logs
- Use `CredentialService.redactToken()` for safe logging

### Constant-Time Comparison

Token verification uses constant-time comparison to prevent timing attacks that could leak token information.

### File Permissions

When using file-based secret storage:

- Secret directory permissions: `0700` (owner-only access)
- Secret file permissions: `0600` (owner-only read/write)

## Configuration Files

### Runtime Config (`config.json`)

Stores non-secret operational state:

```json
{
  "pairing": {
    "token": "temp-pairing-token",
    "expiresAt": 1708085234567,
    "used": true
  },
  "device": {
    "deviceInfo": { "model": "iPhone 15 Pro", "os": "iOS 17.3" },
    "pairedAt": "2026-02-20T10:30:00.000Z",
    "lastSync": "2026-02-20T11:00:00.000Z",
    "tokenStored": true
  }
}
```

**Note**: No `permanentToken` field is present. The `tokenStored: true` flag indicates the token exists in the secret backend.

### Environment Variables

- `HEALTHCLAW_DATA_DIR`: Override default user-level data directory
- `HEALTHCLAW_SECRET_BACKEND`: Force secret backend (`system` or `file`)
- `PORT`: Server port (default: 3000)
- `BATCH_MAX_ITEMS`: Max items per batch sync (default: 5000)
- `BATCH_MAX_BODY_MB`: Max request body size in MB (default: 10)
- `ADMIN_TOKEN`: Token for admin/cleanup endpoints

## Directory-Independent Operation

The server resolves all paths relative to the user-level data directory, **not** the current working directory or repository location.

This means you can:

- Run from any directory: `cd /tmp && npx healthclaw-webhook-server`
- Install globally: `npm install -g` and run from anywhere
- Run via `npx` without cloning the repo

The server will always find its configuration and data in the user-level location.

## API Behavior Notes

### Authentication Consistency

Both single-sync and batch-sync endpoints share the same authentication implementation, ensuring consistent behavior:

- Same token verification logic
- Same error responses for invalid/missing tokens
- Same safe failure handling

### Backward Compatibility

The persistence refactor maintains API contract compatibility:

- Sync endpoints still accept `X-API-Token` header
- Response formats unchanged
- Pairing flow unchanged from client perspective

Existing paired devices continue to work after upgrade (assuming successful migration from legacy config).

## Legacy Config Migration

### Overview

When upgrading from a version that stored tokens in the repository's `config.json`, the server automatically migrates credentials to the new secure storage on first startup.

### Migration Process

The migration is:

- **Automatic**: Runs during bootstrap, no manual steps required
- **Idempotent**: Safe to restart during or after migration
- **One-time**: Marked complete after successful run, won't re-execute
- **State-tracked**: Uses `migration-state.json` to track progress and prevent duplicates

### Migration Steps

1. **Detection**: Check if legacy `config.json` exists in repository directory with `device.permanentToken`
2. **Migration State Check**: Load migration state to see if already completed
3. **Token Migration**: Copy `permanentToken` from legacy config to secret backend
4. **Metadata Migration**: Copy device info, pairing data to new runtime config
5. **Token Redaction**: Remove `permanentToken` from legacy config and add `_migrated` marker
6. **State Update**: Mark migration as completed

### Migration States

- `pending`: Initial state, migration not yet attempted
- `in_progress`: Migration started but not confirmed complete
- `completed`: Migration finished successfully
- `failed`: Migration attempted but failed (will retry on next startup)
- `not_needed`: No legacy config found or it had no token

### Migration Logs

On startup, you'll see one of these messages:

```
[healthclaw] Legacy config migration: completed at 2026-02-20T10:30:00.000Z
[healthclaw] Legacy config migration: not needed (no legacy config found)
[healthclaw] Legacy config migration: FAILED - <error details>
```

### After Migration

Legacy `config.json` in the repository will be modified:

```json
{
  "pairing": { ... },
  "device": {
    // permanentToken removed
    "deviceInfo": { ... },
    "pairedAt": "...",
    "lastSync": "..."
  },
  "_migrated": {
    "migratedAt": "2026-02-20T10:30:00.000Z",
    "note": "Permanent token migrated to secure storage. See docs/persistence.md"
  }
}
```

The token is now in the secret backend, and device continues to work without re-pairing.

### Migration Failure Recovery

If migration fails:

1. Service continues to start (migration failure is non-fatal)
2. Error is logged with details
3. On next restart, migration will retry (state marked as `failed`)
4. If retry continues to fail, you may need to:
   - Check secret backend availability
   - Verify file permissions
   - Re-pair device as last resort

### Manual Migration Check

To verify migration status:

```bash
# Check migration state file
cat ~/Library/Application\ Support/healthclaw-webhook/migration-state.json

# Check if token is in secret backend
# (Actual command depends on your OS and backend)
```

### Runbook: Upgrade from Legacy Version

1. **Before Upgrade**:
   - Ensure legacy `config.json` exists with `device.permanentToken`
   - Back up your current config.json if desired
   - Note your current paired device info

2. **Upgrade**:
   - Pull new version or install via npm/npx
   - Start the server normally

3. **Verify Migration**:
   - Check startup logs for migration status
   - Confirm sync endpoints still work with existing device
   - Check repository `config.json` has `_migrated` marker and no `permanentToken`
   - Verify new runtime config exists in user data directory

4. **If Migration Succeeds**:
   - No further action needed
   - Device continues to sync normally
   - Runtime state now in user-level directory

5. **If Migration Fails**:
   - Check error message in logs
   - Verify secret backend is available (see troubleshooting)
   - Restart to retry migration
   - If persistent failure, re-pair device as workaround

## Troubleshooting

### "Secret backend unavailable"

If you see this warning on startup, the system keychain is unavailable and the server fell back to file-based storage. This is safe but less secure than OS-native credential storage.

**Solutions**:
- **Linux**: Install `libsecret` and `secret-tool`: `sudo apt-get install libsecret-1-0 libsecret-tools`
- **macOS**: Keychain should always be available; if not, check system integrity
- **Windows**: Credential Manager is built-in; fallback indicates a system issue

### "Runtime data directory is inside repository tree"

This warning appears if `HEALTHCLAW_DATA_DIR` (or the default) resolves to a path inside the git repository.

**Solution**: Set `HEALTHCLAW_DATA_DIR` to an external location for cleaner repository management.

### Authentication fails after upgrade

If authentication fails after upgrading from a legacy version:

1. Check if migration completed: Look for startup logs indicating migration status
2. Verify secret backend is working: Check startup diagnostics for backend type
3. Check device metadata: `GET /admin/device-info` should show `tokenStored: true`

If migration failed, you may need to re-pair the device (generate new pairing token and pair again).

## References

- [Path Resolver Source](../src/persistence/path-resolver.js)
- [Secret Store Source](../src/persistence/secret-store.js)
- [Credential Service Source](../src/persistence/credential-service.js)
- [Bootstrap Source](../src/persistence/persistence-bootstrap.js)
