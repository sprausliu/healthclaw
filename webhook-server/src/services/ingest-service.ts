import { validateHealthRecord } from '../validation'
import { buildDedupeKey } from '../dedupe/key-builder'
import type { DedupeRepository } from '../dedupe/dedupe-repository'

// Pure function dependencies (injected I/O operations)
export interface IngestDeps {
  readonly isDuplicate: (key: string) => Promise<boolean>
  readonly save: (record: Readonly<Record<string, unknown>>) => Promise<void>
}

export interface IngestResultFailed {
  readonly status: 'failed'
  readonly code: string
  readonly message: string
}

export interface IngestResultDuplicate {
  readonly status: 'duplicate'
  readonly dedupeKey: string
}

export interface IngestResultInserted {
  readonly status: 'inserted'
  readonly dedupeKey: string
}

export type IngestResult = IngestResultFailed | IngestResultDuplicate | IngestResultInserted

// Pure business logic function
export const ingest = async (record: unknown, deps: IngestDeps): Promise<IngestResult> => {
  // Validation (pure)
  const validation = validateHealthRecord(record)
  if (!validation.ok) {
    return {
      status: 'failed',
      code: validation.error.code,
      message: validation.error.message,
    }
  }

  // Deduplication key (pure)
  const dedupeKey = buildDedupeKey(record as { type: string; timestamp: string })

  // Check for duplicate (injected I/O)
  const exists = await deps.isDuplicate(dedupeKey)
  if (exists) {
    return { status: 'duplicate', dedupeKey }
  }

  // Save record (injected I/O)
  const now = new Date().toISOString()
  await deps.save({
    ...(record as Record<string, unknown>),
    dedupeKey,
    receivedAt: now,
  })

  return { status: 'inserted', dedupeKey }
}

// Factory for backwards compatibility with existing route handlers
export interface IngestService {
  ingest(record: unknown): Promise<IngestResult>
}

export interface IngestServiceDeps {
  readonly dedupeRepository: DedupeRepository
  readonly logStorePath: string
  readonly appendRecord: (path: string, record: unknown) => Promise<void>
}

export const createIngestService = (serviceDeps: IngestServiceDeps): IngestService => {
  return {
    ingest: async (record: unknown) => {
      // Wire up concrete dependencies
      const pureDeps: IngestDeps = {
        isDuplicate: async (key: string) => {
          const exists = await serviceDeps.dedupeRepository.has(key)
          if (exists) {
            await serviceDeps.dedupeRepository.bumpDuplicate(key)
          }
          return exists
        },
        save: async (enrichedRecord: Readonly<Record<string, unknown>>) => {
          await serviceDeps.appendRecord(serviceDeps.logStorePath, enrichedRecord)
          await serviceDeps.dedupeRepository.upsert(
            enrichedRecord.dedupeKey as string,
            record as Record<string, unknown>
          )
        },
      }

      return ingest(record, pureDeps)
    },
  }
}
