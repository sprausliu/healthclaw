import { z } from 'zod'

/**
 * Schema for the `data` payload within a health record.
 * Accepts any JSON object with string keys and non-null values.
 */
const HealthDataSchema = z.record(z.string(), z.unknown()).refine(
  (val): val is Record<string, unknown> => {
    return val !== null && typeof val === 'object' && !Array.isArray(val)
  },
  { message: 'Data must be a JSON object' }
)

/**
 * ISO 8601 timestamp string that must be parseable by Date.parse().
 */
const Iso8601Timestamp = z
  .string()
  .refine((val) => !Number.isNaN(Date.parse(val)), { message: 'Timestamp must be ISO 8601 format' })

// ---------------------------------------------------------------------------
// Individual health record (used by POST /api/health-sync)
// ---------------------------------------------------------------------------

export const HealthSyncBodySchema = z
  .object({
    type: z.string().min(1),
    timestamp: Iso8601Timestamp,
    data: HealthDataSchema,
  })
  .readonly()

export type HealthSyncBody = Readonly<z.infer<typeof HealthSyncBodySchema>>

// ---------------------------------------------------------------------------
// Batch item (same shape as a single health record)
// Note: Uses lenient validation to support partial success.
// Individual items are validated by batch processing logic.
// ---------------------------------------------------------------------------

export const BatchSyncItemSchema = z
  .object({
    type: z.string().min(1),
    timestamp: z.string(), // Lenient: accept any string, validated during processing
    data: HealthDataSchema,
  })
  .readonly()

export type BatchSyncItem = Readonly<z.infer<typeof BatchSyncItemSchema>>

// ---------------------------------------------------------------------------
// Batch sync body (used by POST /api/health-sync/batch)
// ---------------------------------------------------------------------------

export const BatchSyncBodySchema = z
  .object({
    items: z.array(BatchSyncItemSchema).min(1),
    clientRequestId: z.string().optional(),
  })
  .readonly()

export type BatchSyncBody = Readonly<z.infer<typeof BatchSyncBodySchema>>

// ---------------------------------------------------------------------------
// Device pairing request (used by POST /api/pair)
// ---------------------------------------------------------------------------

export const PairingRequestBodySchema = z
  .object({
    deviceInfo: z.record(z.string(), z.unknown()).optional(),
  })
  .readonly()

export type PairingRequestBody = Readonly<z.infer<typeof PairingRequestBodySchema>>
