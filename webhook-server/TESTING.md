# Testing HealthClaw Webhook Server

This guide shows how to test the webhook server locally before connecting the iOS app.

## Prerequisites

- Node.js 18+ installed
- Terminal access
- `curl` or similar HTTP client

## Setup

1. **Install dependencies:**
   ```bash
   cd webhook-server
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

   You should see:
   ```
   🏥 HealthClaw Webhook Server
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📍 Server running on port 3000
   💓 Health check: GET /health
   🔗 Pairing: POST /api/pair?token=XXX
   📊 Health sync: POST /api/health-sync
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⚠️  No device paired yet
   ```

## Test Sequence

### 1. Health Check

Verify server is running:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "server": "HealthClaw Webhook Server",
  "version": "0.1.0",
  "timestamp": "2026-02-16T09:30:00.000Z",
  "paired": false
}
```

### 2. Generate Pairing Token

```bash
curl -X POST http://localhost:3000/admin/generate-pairing
```

Expected response:
```json
{
  "success": true,
  "pairingToken": "abc123def456...",
  "expiresAt": "2026-02-16T09:32:00Z",
  "expiresInSeconds": 120
}
```

**Important:** Copy the `pairingToken` value for the next step!

### 3. Pair a Device

Replace `YOUR_PAIRING_TOKEN` with the token from step 2:

```bash
curl -X POST "http://localhost:3000/api/pair?token=YOUR_PAIRING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceInfo": {
      "model": "Test Device",
      "os": "curl 1.0",
      "appVersion": "1.0.0"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "permanentToken": "xyz789abc123...",
  "webhookUrl": "http://localhost:3000/api/health-sync",
  "message": "Device paired successfully"
}
```

**Important:** Copy the `permanentToken` for the next step!

### 4. Send Test Health Data

Replace `YOUR_PERMANENT_TOKEN` with the token from step 3:

```bash
curl -X POST http://localhost:3000/api/health-sync \
  -H "X-API-Token: YOUR_PERMANENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "workout",
    "timestamp": "2026-02-16T08:30:00Z",
    "device": {
      "model": "Test Device",
      "os": "curl 1.0"
    },
    "data": {
      "activityType": "running",
      "duration": 1800,
      "distance": 5000,
      "calories": 350,
      "avgHeartRate": 145
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Data received and saved",
  "type": "workout",
  "timestamp": "2026-02-16T08:30:00Z"
}
```

### 5. Verify Data Saved

Check the JSONL file:

```bash
cat ~/claw-xiaobai/memory/health-data.jsonl
```

You should see a line like:
```json
{"type":"workout","timestamp":"2026-02-16T08:30:00Z","data":{"activityType":"running","duration":1800,"distance":5000,"calories":350,"avgHeartRate":145},"device":{"model":"Test Device","os":"curl 1.0"},"receivedAt":"2026-02-16T09:35:00.000Z"}
```

### 6. Check Device Info

```bash
curl http://localhost:3000/admin/device-info
```

Expected response:
```json
{
  "paired": true,
  "deviceInfo": {
    "model": "Test Device",
    "os": "curl 1.0",
    "appVersion": "1.0.0"
  },
  "pairedAt": "2026-02-16T09:31:00.000Z",
  "lastSync": "2026-02-16T09:35:00.000Z",
  "tokenPrefix": "xyz789ab..."
}
```

## Error Cases

### 1. Invalid Pairing Token

```bash
curl -X POST "http://localhost:3000/api/pair?token=invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"deviceInfo": {}}'
```

Expected:
```json
{
  "error": "Invalid pairing token"
}
```

### 2. Expired Pairing Token

Wait 2+ minutes after generating, then try to pair:

Expected:
```json
{
  "error": "Pairing token expired"
}
```

### 3. Reusing Pairing Token

Try pairing twice with the same token:

Expected (second attempt):
```json
{
  "error": "Pairing token already used"
}
```

### 4. Missing Permanent Token

Try syncing without the header:

```bash
curl -X POST http://localhost:3000/api/health-sync \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}'
```

Expected:
```json
{
  "error": "Missing API token"
}
```

### 5. Invalid Permanent Token

```bash
curl -X POST http://localhost:3000/api/health-sync \
  -H "X-API-Token: invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}'
```

Expected:
```json
{
  "error": "Invalid token"
}
```

## Re-pairing

To test re-pairing (old token should be invalidated):

1. Note your current permanent token
2. Generate a new pairing token
3. Pair again with different device info
4. Try using the old permanent token → should fail
5. New permanent token should work

## Cleanup

To reset for fresh testing:

```bash
# Stop the server (Ctrl+C)

# Delete config and data
rm webhook-server/config.json
rm ~/claw-xiaobai/memory/health-data.jsonl

# Restart server
npm start
```

## Next Steps

Once all tests pass, you're ready to:
1. Deploy with Tailscale Funnel
2. Connect the iOS app
3. Test real health data sync

Happy testing! 🎉
