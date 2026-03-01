# HealthClaw API Specification

**Version:** 1.0.0  
**Last Updated:** 2026-02-16

This document defines the communication protocol between the HealthClaw iOS app and the webhook server.

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Pairing Flow](#pairing-flow)
- [Health Data Sync](#health-data-sync)
- [Data Types](#data-types)
- [Error Handling](#error-handling)
- [Versioning](#versioning)

---

## Overview

### Base URL

The webhook server URL is provided during pairing. Format:
```
https://{hostname}/api
```

Example:
```
https://machine-name.tail123456.ts.net/api
```

### Transport

- Protocol: HTTPS (required in production)
- Method: POST (for data operations)
- Content-Type: `application/json`
- Character Encoding: UTF-8

---

## Authentication

### Pairing Token (Short-lived)

Used only during the pairing process.

**Location:** Query parameter  
**Parameter Name:** `token`  
**Format:** 64-character hexadecimal string  
**Validity:** 2 minutes from generation  
**Usage:** Single-use only

Example:
```
POST /api/pair?token=abc123def456...
```

### Permanent Token (Long-lived)

Used for all health data sync operations.

**Location:** HTTP Header  
**Header Name:** `X-API-Token`  
**Format:** 64-character hexadecimal string  
**Validity:** Does not expire (until device re-pairs)

Example:
```
POST /api/health-sync
X-API-Token: xyz789abc123...
```

---

## Pairing Flow

### 1. Generate Pairing Token (Server-side)

**Endpoint:** `POST /admin/generate-pairing`

**Request:** None

**Response:**
```json
{
  "success": true,
  "pairingToken": "abc123def456...",
  "expiresAt": "2026-02-16T09:25:00Z",
  "expiresInSeconds": 120
}
```

### 2. Build Pairing URL

**URL Scheme:** `healthclaw://pair`

**Parameters:**
- `url` (required): Base URL of the webhook server
- `token` (required): Pairing token

**Example:**
```
healthclaw://pair?url=https://machine.tail123456.ts.net&token=abc123def456...
```

**Encoding:**
- URL must be properly URL-encoded
- Token should be transmitted as-is (hex string)

### 3. Pairing Request (iOS → Server)

**Endpoint:** `POST /api/pair?token={pairingToken}`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "deviceInfo": {
    "model": "iPhone 15 Pro",
    "os": "iOS 17.3.1",
    "appVersion": "1.0.0"
  }
}
```

**Field Specifications:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deviceInfo` | object | Yes | Device information |
| `deviceInfo.model` | string | Yes | Device model name |
| `deviceInfo.os` | string | Yes | OS version |
| `deviceInfo.appVersion` | string | Yes | App version |

**Success Response (200 OK):**
```json
{
  "success": true,
  "permanentToken": "xyz789abc123...",
  "webhookUrl": "https://machine.tail123456.ts.net/api/health-sync",
  "message": "Device paired successfully"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Missing pairing token | No token in query parameter |
| 401 | Invalid pairing token | Token doesn't match |
| 401 | Pairing token expired | Token older than 2 minutes |
| 401 | Pairing token already used | Token already consumed |
| 500 | Internal server error | Server-side error |

---

## Health Data Sync

### Endpoint

**URL:** `POST /api/health-sync`

**Authentication:** Permanent token in header

**Request Headers:**
```
Content-Type: application/json
X-API-Token: xyz789abc123...
```

### Request Body Format

**Universal Structure:**
```json
{
  "type": "HKQuantityTypeIdentifierStepCount",
  "category": "quantity",
  "timestamp": "2026-02-16T08:30:00Z",
  "source": {
    "name": "HealthKit",
    "version": "iOS 17.3.1",
    "device": "iPhone 15 Pro"
  },
  "data": {
    // Flexible JSON payload - no validation
    // Structure determined by iOS app
  },
  "metadata": {
    // Optional additional information
  }
}
```

**Field Specifications:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Data type identifier (HealthKit identifier or custom string) |
| `category` | string | No | Data category hint (quantity, workout, correlation, etc.) |
| `timestamp` | string | Yes | ISO 8601 timestamp (UTC) |
| `source` | object | No | Data source information |
| `source.name` | string | No | Source name (e.g., "HealthKit", "Manual") |
| `source.version` | string | No | Source version |
| `source.device` | string | No | Device name |
| `data` | object | Yes | **Flexible payload - server does NOT validate structure** |
| `metadata` | object | No | Optional metadata (app-specific) |

**Design Principles:**

1. **Open-ended `type` field**: Can be any string
   - HealthKit identifiers: `HKQuantityTypeIdentifierStepCount`, `HKWorkoutTypeIdentifier`, etc.
   - Custom types: `customSleepScore`, `manualWeight`, etc.
   - Future Apple health types: automatically supported

2. **No data validation**: Server accepts any valid JSON in `data` field
   - Structure is determined by iOS app
   - Server just stores and forwards to OpenClaw

3. **Backward compatible**: Existing data types continue to work

4. **Future-proof**: New HealthKit types work without API changes

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Data received and saved",
  "type": "workout",
  "timestamp": "2026-02-16T08:30:00Z"
}
```

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Missing required fields | Missing `type`, `timestamp`, or `data` |
| 401 | Missing API token | No `X-API-Token` header |
| 401 | Invalid token | Token doesn't match paired device |
| 401 | No device paired | No device has been paired yet |
| 500 | Internal server error | Server-side error |

---

## Common Data Type Examples

**Note:** These are suggested formats, NOT requirements. The server accepts any valid JSON structure in the `data` field. iOS app is free to send data in any format that makes sense.

### 1. Workout

**Type:** `HKWorkoutTypeIdentifier` or `workout`

**Suggested Data Payload:**
```json
{
  "activityType": "running",
  "startTime": "2026-02-16T08:00:00Z",
  "endTime": "2026-02-16T08:30:00Z",
  "duration": 1800,
  "distance": 5000,
  "distanceUnit": "meters",
  "calories": 350,
  "avgHeartRate": 145,
  "maxHeartRate": 165,
  "metadata": {
    "source": "Apple Watch",
    "indoor": false
  }
}
```

**Note:** iOS app can include any fields that make sense for the workout. Future HealthKit fields will be automatically supported.

### 2. Steps

**Type:** `HKQuantityTypeIdentifierStepCount` or `steps`

**Suggested Data Payload:**
```json
{
  "count": 8523,
  "date": "2026-02-16",
  "startTime": "2026-02-16T00:00:00Z",
  "endTime": "2026-02-16T23:59:59Z"
}
```

### 3. Heart Rate

**Type:** `HKQuantityTypeIdentifierHeartRate` or `heartRate`

**Suggested Data Payload:**
```json
{
  "bpm": 72,
  "context": "resting",
  "measuredAt": "2026-02-16T14:30:00Z"
}
```

### 4. Sleep Analysis

**Type:** `HKCategoryTypeIdentifierSleepAnalysis` or `sleep`

**Suggested Data Payload:**
```json
{
  "startTime": "2026-02-15T23:30:00Z",
  "endTime": "2026-02-16T07:00:00Z",
  "duration": 27000,
  "quality": "good",
  "stages": [
    {
      "stage": "deep",
      "startTime": "2026-02-16T00:00:00Z",
      "endTime": "2026-02-16T02:00:00Z",
      "duration": 7200
    }
  ]
}
```

### 5. Body Mass

**Type:** `HKQuantityTypeIdentifierBodyMass` or `bodyMass`

**Suggested Data Payload:**
```json
{
  "value": 70.5,
  "unit": "kg",
  "measuredAt": "2026-02-16T07:00:00Z"
}
```

### 6. Future Health Types

**Any new HealthKit type** can be sent without API changes:

```json
{
  "type": "HKQuantityTypeIdentifierBloodGlucose",
  "timestamp": "2026-02-16T10:00:00Z",
  "data": {
    "value": 95,
    "unit": "mg/dL"
  }
}
```

**Server behavior:**
- Accepts and stores any type
- No validation on data structure
- Forwards to OpenClaw for processing

---

## Error Handling

### Error Response Format

All errors follow this structure:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional details (optional)"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_PAIRING_TOKEN` | 400 | Pairing token not provided |
| `INVALID_PAIRING_TOKEN` | 401 | Pairing token doesn't match |
| `PAIRING_TOKEN_EXPIRED` | 401 | Pairing token older than 2 minutes |
| `PAIRING_TOKEN_USED` | 401 | Pairing token already consumed |
| `MISSING_API_TOKEN` | 401 | Permanent token not in header |
| `INVALID_API_TOKEN` | 401 | Permanent token invalid |
| `NO_DEVICE_PAIRED` | 401 | No device has been paired |
| `MISSING_REQUIRED_FIELDS` | 400 | Required fields missing |
| `INVALID_DATA_TYPE` | 400 | Unknown data type |
| `INVALID_TIMESTAMP` | 400 | Timestamp not ISO 8601 |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Versioning

### Current Version

**API Version:** 1.0.0

### Version Header (Future)

Future versions may include a version header:
```
X-API-Version: 1.0.0
```

### Compatibility

**Breaking Changes:**
- Will result in major version increment (2.0.0)
- Server will maintain backward compatibility for at least one major version

**Non-breaking Changes:**
- New optional fields: minor version increment (1.1.0)
- Bug fixes: patch version increment (1.0.1)

### Deprecation Policy

- Deprecated features will be announced at least 90 days in advance
- Deprecated endpoints will return a warning header:
  ```
  X-Deprecation-Warning: This endpoint is deprecated. Use /api/v2/endpoint instead.
  ```

---

## Complete Examples

### Example 1: Full Pairing Flow

**Step 1: Generate Pairing Token**
```bash
POST /admin/generate-pairing
```

Response:
```json
{
  "success": true,
  "pairingToken": "a1b2c3d4e5f6...",
  "expiresAt": "2026-02-16T09:27:00Z",
  "expiresInSeconds": 120
}
```

**Step 2: Open Pairing URL**
```
healthclaw://pair?url=https://machine.ts.net&token=a1b2c3d4e5f6...
```

**Step 3: iOS App Sends Pairing Request**
```bash
POST /api/pair?token=a1b2c3d4e5f6...
Content-Type: application/json

{
  "deviceInfo": {
    "model": "iPhone 15 Pro",
    "os": "iOS 17.3.1",
    "appVersion": "1.0.0"
  }
}
```

Response:
```json
{
  "success": true,
  "permanentToken": "xyz789abc123...",
  "webhookUrl": "https://machine.ts.net/api/health-sync",
  "message": "Device paired successfully"
}
```

### Example 2: Sync Workout Data

```bash
POST /api/health-sync
Content-Type: application/json
X-API-Token: xyz789abc123...

{
  "type": "HKWorkoutTypeIdentifier",
  "category": "workout",
  "timestamp": "2026-02-16T08:30:00Z",
  "source": {
    "name": "HealthKit",
    "version": "iOS 17.3.1",
    "device": "iPhone 15 Pro"
  },
  "data": {
    "activityType": "running",
    "startTime": "2026-02-16T08:00:00Z",
    "endTime": "2026-02-16T08:30:00Z",
    "duration": 1800,
    "distance": 5000,
    "distanceUnit": "meters",
    "calories": 350,
    "avgHeartRate": 145,
    "maxHeartRate": 165
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Data received and saved",
  "type": "HKWorkoutTypeIdentifier",
  "timestamp": "2026-02-16T08:30:00Z"
}
```

### Example 3: Sync Daily Steps

```bash
POST /api/health-sync
Content-Type: application/json
X-API-Token: xyz789abc123...

{
  "type": "HKQuantityTypeIdentifierStepCount",
  "category": "quantity",
  "timestamp": "2026-02-16T23:59:59Z",
  "source": {
    "name": "HealthKit",
    "version": "iOS 17.3.1",
    "device": "iPhone 15 Pro"
  },
  "data": {
    "count": 8523,
    "date": "2026-02-16",
    "startTime": "2026-02-16T00:00:00Z",
    "endTime": "2026-02-16T23:59:59Z"
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Data received and saved",
  "type": "HKQuantityTypeIdentifierStepCount",
  "timestamp": "2026-02-16T23:59:59Z"
}
```

### Example 4: Future Health Type (Blood Glucose)

```bash
POST /api/health-sync
Content-Type: application/json
X-API-Token: xyz789abc123...

{
  "type": "HKQuantityTypeIdentifierBloodGlucose",
  "category": "quantity",
  "timestamp": "2026-02-16T10:00:00Z",
  "source": {
    "name": "HealthKit",
    "device": "iPhone 15 Pro"
  },
  "data": {
    "value": 95,
    "unit": "mg/dL",
    "mealContext": "fasting"
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Data received and saved",
  "type": "HKQuantityTypeIdentifierBloodGlucose",
  "timestamp": "2026-02-16T10:00:00Z"
}
```

---

## Change Log

### Version 1.0.0 (2026-02-16)

- Initial API specification
- Pairing flow defined
- Health data types: workout, steps, heartRate, sleep, bodyMass
- Authentication scheme defined
- Error handling standardized

---

## Notes for Implementers

### iOS App

- Store `permanentToken` securely in Keychain
- Store `webhookUrl` in UserDefaults or Keychain
- Always send timestamps in UTC (ISO 8601)
- Handle token expiration gracefully (re-pair if needed)
- Implement exponential backoff for failed requests

### Webhook Server

- Validate all incoming data against this spec
- Log malformed requests for debugging
- Return appropriate HTTP status codes
- Store config.json securely (contains tokens)
- Implement rate limiting (future consideration)

### OpenClaw Integration

- Parse JSONL files from `~/claw-xiaobai/memory/health-data.jsonl`
- Each line is a complete JSON object
- Use `receivedAt` field for processing order
- Handle missing optional fields gracefully

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-02-16  
**Maintained By:** HealthClaw Project
