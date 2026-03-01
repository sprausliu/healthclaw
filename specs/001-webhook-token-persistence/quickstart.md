# Quickstart: Webhook Config & Token Persistence

## Goal
Run the webhook in a directory-independent way, with token persistence outside repository config files, and safely migrate legacy installs.

## 1) Start service from outside repository
```bash
cd /tmp
npx healthclaw-webhook start
```

Expected:
- Service boots successfully.
- Runtime config/data directories are created in user-level storage.
- No new runtime files appear in repository source tree.

## 2) Pair device and verify token persistence separation
```bash
curl -X POST http://localhost:3000/admin/generate-pairing
# then complete pair flow from device/app
```

Validation checks:
- Pairing succeeds.
- Plain runtime config does not contain permanent token value.
- Single and batch sync endpoints still authenticate with device token.

## 3) Validate migration from legacy config
1. Prepare legacy config containing `device.permanentToken` in old location.
2. Start new server version.
3. Verify migration status and sync continuity.

Expected:
- Migration runs once and records completion state.
- Existing paired device continues syncing without re-pair.
- Legacy plain config no longer holds permanent token.

## 4) Failure-path check for unavailable secret backend
Simulate secret backend unavailable on startup/request auth.

Expected:
- Service remains alive where possible.
- Auth endpoints return standard auth failure for token checks.
- Operator logs indicate secret retrieval issue without exposing sensitive internals.

## 5) Override-path check
Start service with explicit storage override inputs.

Expected:
- Resolved paths use override locations.
- Behavior remains equivalent to default path flow.
- Repository tree stays clean after pair/sync operations.

## 6) Repository Cleanliness Verification

After completing pairing and sync operations, verify no runtime artifacts in repository:

```bash
cd /path/to/healthclaw-repository/webhook-server
git status --short
```

**Expected**: No new untracked files like:
- `config.json` (if not already migrated)
- `health-data.jsonl`
- `dedupe.db`
- `.secrets/`

All runtime data should be in user-level directories:

```bash
# macOS example:
ls ~/Library/Application\ Support/healthclaw-webhook/
# Expected: config.json, health-data.jsonl, dedupe.db, migration-state.json, .secrets/

# Linux example:
ls ~/.local/share/healthclaw-webhook/
# Expected: same files as above
```

**Validation Steps**:

1. **Clean repository check**:
   ```bash
   cd webhook-server
   # Should show no new runtime files, only code changes if any
   git status
   ```

2. **Runtime data location check**:
   ```bash
   # Check diagnostics on startup logs show external data directory
   # Should NOT be inside repository path
   ```

3. **Legacy config marker check** (if migrated):
   ```bash
   cat config.json  # in repository (if exists)
   # Should show _migrated marker and no permanentToken field
   ```

4. **User-level data verification**:
   ```bash
   # macOS:
   ls -la ~/Library/Application\ Support/healthclaw-webhook/

   # Linux:
   ls -la ~/.local/share/healthclaw-webhook/

   # Should contain:
   # - config.json (runtime config, no secrets)
   # - health-data.jsonl (sync logs)
   # - dedupe.db (deduplication database)
   # - migration-state.json (if migration ran)
   # - .secrets/ directory (with restricted permissions)
   ```

5. **Secret storage verification**:
   ```bash
   # Check secret file permissions (if file backend)
   ls -la ~/Library/Application\ Support/healthclaw-webhook/.secrets/
   # Expected: drwx------ (700 permissions on directory)

   ls -la ~/Library/Application\ Support/healthclaw-webhook/.secrets/device-token
   # Expected: -rw------- (600 permissions on file, if file backend used)
   ```

6. **Sync continuity check**:
   ```bash
   # Perform sync after migration
   curl -X POST http://localhost:3000/api/health-sync \
     -H "X-API-Token: <your-token>" \
     -H "Content-Type: application/json" \
     -d '{"records": [...]}'

   # Expected: 200 OK, sync successful
   # Verify health-data.jsonl in user-level directory updated, NOT in repo
   ```

## 7) Multi-Directory Restart Test

Verify directory-independent operation:

```bash
# Start from directory A
cd /tmp/test-dir-a
npx healthclaw-webhook start  # or npm start from repo

# Pair device, perform sync
# ... pairing and sync operations ...

# Stop server, restart from directory B
cd /tmp/test-dir-b
npx healthclaw-webhook start

# Verify:
# - Device still paired (no re-pair needed)
# - Previous sync data still accessible
# - No new files in /tmp/test-dir-a or /tmp/test-dir-b
# - All state in user-level directory
```
