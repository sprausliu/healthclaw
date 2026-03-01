import type { IngestService, IngestResult } from './ingest-service'

export interface BatchSyncError {
  readonly index: number
  readonly code: string
  readonly message: string
}

export interface BatchSummary {
  readonly total: number
  readonly inserted: number
  readonly duplicates: number
  readonly failed: number
  readonly errors: readonly BatchSyncError[]
}

// Pure function dependencies (injected I/O)
export interface BatchDeps {
  readonly ingestOne: (item: unknown) => Promise<IngestResult>
}

// Pure business logic function
export const processBatch = async (
  items: readonly unknown[],
  deps: BatchDeps
): Promise<BatchSummary> => {
  const summary: {
    total: number
    inserted: number
    duplicates: number
    failed: number
    errors: BatchSyncError[]
  } = {
    total: items.length,
    inserted: 0,
    duplicates: 0,
    failed: 0,
    errors: [],
  }

  for (let index = 0; index < items.length; index += 1) {
    try {
      const result = await deps.ingestOne(items[index] as unknown)
      if (result.status === 'inserted') summary.inserted += 1
      else if (result.status === 'duplicate') summary.duplicates += 1
      else {
        summary.failed += 1
        summary.errors.push({
          index,
          code: result.code ?? 'VALIDATION_ERROR',
          message: result.message ?? 'Invalid record',
        })
      }
    } catch (error: unknown) {
      summary.failed += 1
      const message = error instanceof Error ? error.message : String(error)
      summary.errors.push({ index, code: 'INTERNAL_ERROR', message })
    }
  }

  return summary
}

// Factory for backwards compatibility with existing route handlers
export interface BatchSyncService {
  processBatch(items: readonly unknown[]): Promise<BatchSummary>
}

export interface BatchSyncServiceDeps {
  readonly ingestService: IngestService
}

export const createBatchSyncService = (serviceDeps: BatchSyncServiceDeps): BatchSyncService => {
  return {
    processBatch: async (items: readonly unknown[]) => {
      // Wire up concrete dependency
      const pureDeps: BatchDeps = {
        ingestOne: (item: unknown) => serviceDeps.ingestService.ingest(item),
      }

      return processBatch(items, pureDeps)
    },
  }
}
