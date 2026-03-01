# HealthClaw Webhook Server

Node.js server that receives health data from the iOS app and integrates with OpenClaw.

## Features

- 🔐 Secure pairing flow with time-limited tokens
- 📱 Single device support
- 💾 JSONL data storage
- 🔄 Automatic token management
- 📊 Health data tracking
- ⚡ Batch sync endpoint for fast backfill (`/api/health-sync/batch`)
- ♻️ Deterministic dedupe on single + batch ingest

## Quick Start

### Option 1: Run via npx (Recommended)

Run directly from npm without installation:

```bash
npx healthclaw-webhook-server
```

The server will automatically create a user-level data directory for configuration and health data:

- **macOS**: `~/Library/Application Support/healthclaw-webhook`
- **Linux**: `~/.local/share/healthclaw-webhook`
- **Windows**: `%APPDATA%\healthclaw-webhook`

You can customize the data location:

```bash
HEALTHCLAW_DATA_DIR=~/custom/path npx healthclaw-webhook-server
```

### Option 2: Local Development

1. Install dependencies:

```bash
npm install
```

2. Build the TypeScript code:

```bash
npm run build
```

3. Configure environment (optional):

```bash
cp .env.example .env
# Edit .env if you want to customize paths and limits
```

Important environment variables:
- `HEALTHCLAW_DATA_DIR`: Override default data directory
- `HEALTHCLAW_SECRET_BACKEND`: Force secret backend (`system` or `file`)
- `PORT`: Server port (default: 3000)
- `BATCH_MAX_ITEMS`: Max items per batch (default: 5000)
- `BATCH_MAX_BODY_MB`: Max request body MB (default: 10)
- `ADMIN_TOKEN`: Admin/cleanup endpoint token

4. Start server:

```bash
npm start
```

### Data Storage

All runtime data is stored **outside the repository** in a user-level directory:

- **Runtime config**: `config.json` (non-secret metadata)
- **Health data**: `health-data.jsonl` (JSONL append-only log)
- **Dedupe index**: `dedupe.db` (duplicate detection)
- **Device token**: Stored in OS keychain (macOS/Linux/Windows) or encrypted file fallback

See [docs/persistence.md](docs/persistence.md) for detailed persistence architecture.

## Pairing Flow

### Step 1: Generate Pairing Token

```bash
curl -X POST http://localhost:3000/admin/generate-pairing
```

Response:
```json
{
  "success": true,
  "pairingToken": "abc123...",
  "expiresAt": "2026-02-16T09:25:00Z",
  "expiresInSeconds": 120
}
```

### Step 2: Build Pairing URL

```
healthclaw://pair?url=https://your-server.ts.net&token=abc123...
```

### Step 3: User Opens URL on iPhone

iOS app will automatically:
1. Extract webhook URL and pairing token
2. Send pairing request
3. Receive and save permanent token

### Step 4: Pairing Request (sent by iOS app)

```bash
curl -X POST "http://localhost:3000/api/pair?token=abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "deviceInfo": {
      "model": "iPhone 15 Pro",
      "os": "iOS 17.3",
      "appVersion": "1.0.0"
    }
  }'
```

Response:
```json
{
  "success": true,
  "permanentToken": "xyz789...",
  "webhookUrl": "https://your-server.ts.net/api/health-sync",
  "message": "Device paired successfully"
}
```

### Step 5: Health Data Sync (automatic)

iOS app will send health data:

```bash
curl -X POST http://localhost:3000/api/health-sync \
  -H "X-API-Token: xyz789..." \
  -H "Content-Type: application/json" \
  -d '{
    "type": "workout",
    "timestamp": "2026-02-16T08:30:00Z",
    "device": {
      "model": "iPhone 15 Pro",
      "os": "iOS 17.3"
    },
    "data": {
      "activityType": "running",
      "duration": 1800,
      "distance": 5000,
      "calories": 350
    }
  }'
```

## API Endpoints

### Health Data Batch Sync
```
POST /api/health-sync/batch
Header: X-API-Token: PERMANENT_TOKEN
```

Request body:
```json
{
  "items": [
    { "type": "steps", "timestamp": "2026-02-16T08:30:00Z", "data": { "count": 1000 } },
    { "type": "heart-rate", "timestamp": "2026-02-16T08:31:00Z", "data": { "bpm": 72 } }
  ],
  "clientRequestId": "optional-client-id"
}
```

Response body:
```json
{
  "success": true,
  "total": 2,
  "inserted": 2,
  "duplicates": 0,
  "failed": 0,
  "errors": []
}
```


### Health Check
```
GET /health
```

No authentication required.

Response:
```json
{
  "status": "ok",
  "server": "HealthClaw Webhook Server",
  "version": "0.1.0",
  "timestamp": "2026-02-16T09:00:00.000Z",
  "paired": true
}
```

### Generate Pairing Token (Admin)
```
POST /admin/generate-pairing
```

No authentication required. Generates a new 2-minute pairing token.

### Device Pairing
```
POST /api/pair?token=PAIRING_TOKEN
```

Request body:
```json
{
  "deviceInfo": {
    "model": "iPhone 15 Pro",
    "os": "iOS 17.3",
    "appVersion": "1.0.0"
  }
}
```

⏰ Pairing token expires in 2 minutes  
🔒 Token can only be used once  
📱 Only one device can be paired (new pairing overwrites old device)

### Health Data Sync (Single)
```
POST /api/health-sync
Header: X-API-Token: PERMANENT_TOKEN
```

Request body:
```json
{
  "type": "workout",
  "timestamp": "2026-02-16T08:30:00Z",
  "data": { ... },
  "device": { ... }
}
```

Response:
```json
{
  "success": true,
  "status": "inserted",
  "type": "workout",
  "timestamp": "2026-02-16T08:30:00Z"
}
```

`status` can be `inserted` or `duplicate`.

### Health Data Sync (Batch)
```
POST /api/health-sync/batch
Header: X-API-Token: PERMANENT_TOKEN
```

Request body:
```json
{
  "clientRequestId": "optional-client-id",
  "items": [
    {
      "type": "steps",
      "timestamp": "2026-02-16T08:30:00Z",
      "data": { "count": 1200 }
    },
    {
      "type": "heart-rate",
      "timestamp": "2026-02-16T08:31:00Z",
      "data": { "bpm": 74 }
    }
  ]
}
```

Response:
```json
{
  "success": false,
  "total": 2,
  "inserted": 1,
  "duplicates": 0,
  "failed": 1,
  "errors": [
    {
      "index": 1,
      "code": "INVALID_TIMESTAMP",
      "message": "timestamp must be a valid ISO 8601 string"
    }
  ]
}
```

### Cleanup Preview (Admin, non-destructive)
```
POST /admin/cleanup/preview
Header: X-Admin-Token: ADMIN_TOKEN
```

Request body:
```json
{
  "mode": "duplicates-only",
  "filters": {
    "beforeTimestamp": "2026-02-01T00:00:00Z",
    "types": ["steps"],
    "categories": ["activity"]
  }
}
```

Returns projected impact (`matched`, `byType`) and never rewrites data.

### Cleanup Execute (Admin, destructive)
```
POST /admin/cleanup/execute
Header: X-Admin-Token: ADMIN_TOKEN
```

Request body:
```json
{
  "mode": "duplicates-only",
  "confirm": true
}
```

Safety guarantees:
- Requires admin token
- Requires explicit `confirm: true`
- Creates backup file in `data/backups/` before rewrite
- Writes audit entry to `data/cleanup-audit.log`

### Device Info (Admin)
```
GET /admin/device-info
```

Shows currently paired device information (token is partially hidden).

## Deduplication Behavior

- Single sync and batch sync both use the same deterministic dedupe key.
- Replaying the exact same logical record returns `status: "duplicate"` (single) or increments `duplicates` (batch).
- Deduplication metadata is persisted in a local index file with:
  - `firstSeenAt`
  - `lastSeenAt`
  - `duplicateCount`

## Rebuild Deduplication Index

If historical JSONL data exists before dedupe index was introduced, rebuild it:

```bash
node -e "const { DedupeRepository } = require('./dist/dedupe/dedupe-repository'); const { rebuildDedupeIndex } = require('./dist/dedupe/rebuild-index'); const repo = new DedupeRepository(process.env.DEDUPE_DB_PATH || './data/health-dedupe-index.json'); rebuildDedupeIndex({ dedupeRepository: repo, healthDataFile: process.env.HEALTH_DATA_FILE || './memory/health-data.jsonl' }).then(console.log).catch(console.error)"
```

## Data Storage

All data is stored in the user-level application directory (platform-specific):

**macOS**: `~/Library/Application Support/healthclaw-webhook/`
**Linux**: `~/.local/share/healthclaw-webhook/`
**Windows**: `%APPDATA%\healthclaw-webhook\`

Files:
- `health-data.jsonl` - Health records (one JSON object per line)
- `config.json` - Runtime configuration (non-secret metadata only)
- `dedupe.db` - Deduplication index
- `.secrets/device-token` - Device permanent token (if file-based backend)

Example health data format:
```json
{"type":"workout","timestamp":"2026-02-16T08:30:00Z","data":{...},"receivedAt":"2026-02-16T08:31:00Z"}
{"type":"steps","timestamp":"2026-02-16T23:59:59Z","data":{...},"receivedAt":"2026-02-16T23:59:59Z"}
```

You can override the default location with `HEALTHCLAW_DATA_DIR` environment variable.

## Deployment

### With npx (Simplest)

Run anywhere without installation:

```bash
npx healthclaw-webhook-server
```

Set custom port and data location:

```bash
PORT=8080 HEALTHCLAW_DATA_DIR=~/my-health-data npx healthclaw-webhook-server
```

### With Tailscale Funnel

1. Start the server via npx:
   ```bash
   npx healthclaw-webhook-server
   ```

2. Enable Tailscale Funnel:
   ```bash
   tailscale funnel --bg 3000
   ```

3. Your webhook URL will be:
   ```
   https://your-machine.tailxxxxxx.ts.net/api/health-sync
   ```

### With PM2 (Production)

For local development:

```bash
npm install -g pm2
npm run build  # Build TypeScript first
pm2 start dist/index.js --name healthclaw
pm2 save
pm2 startup
```

For global installation:

```bash
npm install -g healthclaw-webhook-server
pm2 start healthclaw-webhook-server --name healthclaw
pm2 save
pm2 startup
```

## Development

The webhook server is built with TypeScript in strict mode. Source files are in `src/`, compiled output goes to `dist/`.

### Available Scripts

- `npm run typecheck` - Type-check without emitting files
- `npm run build` - Compile TypeScript to JavaScript
- `npm run lint` - Lint TypeScript source files
- `npm run format` - Format source files with Prettier
- `npm run format:check` - Check formatting without changes
- `npm test` - Run test suite
- `npm run dev` - Run with auto-reload (development)

### TypeScript Architecture

- **Strict mode enabled**: No `any`, no `var`, all types must be explicit
- **Branded types**: DeviceToken, PairingToken, SyncId use branded string types for type safety
- **Zod validation**: All API request bodies validated with Zod schemas
- **Structured logging**: JSON-formatted logs with levels (debug, info, warn, error)
- **Immutability**: All types use `readonly`, pure functions for domain logic

## Security Notes

- 🔒 Pairing tokens expire in 2 minutes
- 🔐 Pairing tokens are single-use
- 💾 Permanent tokens are stored in OS keychain (macOS/Linux/Windows) or encrypted file with restricted permissions
- 🔑 Tokens are NEVER logged in plaintext
- 📱 Only one device can be paired at a time
- 🔄 Re-pairing will invalidate the previous device's token
- 🛡️ Constant-time token comparison prevents timing attacks

**Important**: The `config.json` file does NOT contain the permanent token. It only stores device metadata and pairing state. The actual credential is stored securely in the OS keychain or a restricted-permission file.

## Troubleshooting

### Token Expired
Generate a new pairing token:
```bash
curl -X POST http://localhost:3000/admin/generate-pairing
```

### Device Already Paired
Re-pairing will overwrite the previous device. The old device's token will no longer work.

### "Secret backend unavailable" warning

If you see this on startup, the OS keychain is unavailable and file-based storage is used instead.

**Linux**: Install libsecret:
```bash
sudo apt-get install libsecret-1-0 libsecret-tools
```

**macOS/Windows**: System keychain should always be available. If you see this warning, check system integrity.

### Authentication fails after upgrade

If sync stops working after upgrading from an older version, you may need to re-pair:

1. Check device info:
   ```bash
   curl http://localhost:3000/admin/device-info
   ```

2. If `tokenStored: false` or device is not paired, generate new pairing token and re-pair

### Data directory location

Check where data is being stored:

On startup, look for logs like:
```
[healthclaw] Data directory: /Users/username/Library/Application Support/healthclaw-webhook
[healthclaw] Secret backend: system
```

Override with environment variable:
```bash
HEALTHCLAW_DATA_DIR=~/custom/path npm start
```

## Maintainer Notes

### Repository Cleanliness Expectations

The webhook server is designed to keep the repository directory clean and free of runtime artifacts. This is critical for npm packaging, version control, and distribution.

**Repository should NEVER contain**:
- `health-data.jsonl` (health records)
- `dedupe.db` (deduplication index)
- `.secrets/` directory (secret tokens)
- User-specific runtime `config.json` in repository root

**After normal operations (pair, sync, batch)**, `git status` in the repository should show:
- No untracked runtime files
- No modified runtime data files

All runtime data goes to user-level directories outside the repository.

### Release Packaging Checklist

Before publishing to npm:

1. **Verify Clean Repository**:
   ```bash
   git status --short
   # Should show only intentional code changes, no runtime artifacts
   ```

2. **Test Directory-Independent Operation**:
   ```bash
   cd /tmp/test-deploy
   npx healthclaw-webhook-server
   # Verify service starts, creates user-level data dir, repo stays clean
   ```

3. **Test Migration Path**:
   - Create legacy config with `device.permanentToken`
   - Start new version
   - Verify migration completes, token moves to secret backend
   - Verify legacy config is redacted with `_migrated` marker

4. **Verify `.gitignore` Coverage**:
   - Check `.gitignore` includes runtime artifact patterns
   - Test that accidental local runtime files don't get committed

5. **Test npx Distribution**:
   ```bash
   npm pack  # Creates tarball
   npm install -g ./healthclaw-webhook-server-*.tgz
   healthclaw-webhook-server  # Run from any directory
   # Verify user-level data directory creation
   ```

6. **Documentation Consistency**:
   - README.md reflects current persistence behavior
   - `docs/persistence.md` is up-to-date
   - `.env.example` has current environment variables
   - API contract docs match implementation

### Development Guidelines

**When adding new runtime state**:
- ALWAYS use `PathResolver` to determine storage location
- NEVER hardcode paths relative to `__dirname` for runtime data
- Add new paths to `PathResolver.getPaths()`
- Update `.gitignore` if new file patterns introduced
- Test that new files go to user-level directory, not repo

**When adding new config/secrets**:
- Non-secret config → `RuntimeConfigRepository`
- Secret credentials → `CredentialService` + secret backend
- Never mix secrets with plain runtime config

**Testing repo cleanliness**:
```bash
# Before changes
git status --short > before.txt

# Run operations (pair, sync, etc.)
npm start
# ... perform operations ...

# After changes
git status --short > after.txt
diff before.txt after.txt
# Should show no new untracked runtime files
```

### Migration Compatibility

When making changes to persistence layer:
- Preserve backward compatibility with existing runtime configs
- If schema changes needed, implement migration in `legacy-config-migrator.js`
- Update `migration-state.json` schema version if breaking changes
- Test upgrade path from previous versions
- Document migration behavior in `docs/persistence.md`

### Debugging Runtime Paths

To debug where files are being created:

1. **Check startup diagnostics**:
   ```
   [healthclaw] Data directory: <path>
   [healthclaw] Secret backend: <type>
   ```

2. **Verify path resolution**:
   ```javascript
   const { createPathResolver } = require('./dist/persistence/path-resolver');
   const resolver = createPathResolver();
   console.log(resolver.getPaths());
   ```

3. **Check for warnings**:
   ```
   [path-resolver] WARNING: Runtime data directory is inside repository tree
   ```

If you see the above warning, it means `HEALTHCLAW_DATA_DIR` is set to a location inside the repo, which violates cleanliness expectations.

## License

MIT
