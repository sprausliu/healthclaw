# Quickstart: Batch Sync, Deduplication, and Cleanup APIs

## Prerequisites
- Webhook server running locally on port `3000`
- Valid device sync token for sync endpoints
- Admin token configured for cleanup endpoints

## 1) Single Sync (existing endpoint, idempotent)
```bash
curl -X POST http://localhost:3000/api/health-sync \
  -H "X-API-Token: <DEVICE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"HKQuantityTypeIdentifierStepCount",
    "timestamp":"2026-02-19T08:00:00Z",
    "category":"activity",
    "data":{"date":"2026-02-19","steps":8123}
  }'
```

Expected: first call inserted, repeated call marked duplicate.

## 2) Batch Sync (new endpoint)
```bash
curl -X POST http://localhost:3000/api/health-sync/batch \
  -H "X-API-Token: <DEVICE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "type":"HKQuantityTypeIdentifierStepCount",
        "timestamp":"2026-02-19T08:00:00Z",
        "category":"activity",
        "data":{"date":"2026-02-19","steps":8123}
      },
      {
        "type":"HKQuantityTypeIdentifierHeartRate",
        "timestamp":"2026-02-19T09:00:00Z",
        "category":"vitals",
        "data":{"avgBpm":88,"minBpm":80,"maxBpm":95,"sampleCount":12}
      }
    ]
  }'
```

Expected response shape:
```json
{
  "success": true,
  "total": 2,
  "inserted": 1,
  "duplicates": 1,
  "failed": 0,
  "errors": []
}
```

## 3) Cleanup Preview (non-destructive)
```bash
curl -X POST http://localhost:3000/admin/cleanup/preview \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"duplicates-only"}'
```

Expected: returns projected `matched/removed` counts and `byType` summary, no file mutation.

## 4) Cleanup Execute (destructive + backup)
```bash
curl -X POST http://localhost:3000/admin/cleanup/execute \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"duplicates-only","confirm":true}'
```

Expected: returns `removed` count and `backupPath`.

## 5) Contract Validation Checklist
- Replaying same payloads does not increase unique record count.
- Batch responses accurately report inserted/duplicate/failed counts.
- Cleanup preview does not modify data.
- Cleanup execute requires admin token and explicit confirm.
- Backup file exists for every execute operation.
