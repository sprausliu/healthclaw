export interface BatchSyncError {
  readonly index: number
  readonly code: string
  readonly message: string
}

export interface BatchSyncResult {
  readonly total: number
  readonly inserted: number
  readonly duplicates: number
  readonly failed: number
  readonly errors: readonly BatchSyncError[]
}

export interface BatchSyncResponse {
  readonly success: boolean
  readonly total: number
  readonly inserted: number
  readonly duplicates: number
  readonly failed: number
  readonly errors: readonly BatchSyncError[]
}

export function buildBatchSyncResponse(result: BatchSyncResult): BatchSyncResponse {
  return {
    success: result.failed === 0,
    total: result.total,
    inserted: result.inserted,
    duplicates: result.duplicates,
    failed: result.failed,
    errors: result.errors,
  }
}
