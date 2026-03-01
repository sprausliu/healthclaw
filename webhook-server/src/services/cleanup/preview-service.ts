import { streamRecords } from '../../storage/health-log-store'
import { buildDedupeKey } from '../../dedupe/key-builder'
import { buildCleanupMatcher, type CleanupCriteria } from './filter-engine'

interface HealthRecord {
  readonly type?: string
  readonly timestamp?: string
  readonly [key: string]: unknown
}

export interface CleanupSummary {
  readonly preview: boolean
  readonly matched: number
  readonly removed: number
  readonly kept: number
  readonly failed: number
  readonly backupPath: string | null
  readonly byType: Readonly<Record<string, number>>
}

export const collectRecords = async (dataFilePath: string): Promise<readonly HealthRecord[]> => {
  const records: HealthRecord[] = []
  for await (const record of streamRecords(dataFilePath)) {
    records.push(record)
  }
  return records
}

export const detectDuplicateIndexes = (records: readonly HealthRecord[]): ReadonlySet<number> => {
  const seen = new Set<string>()
  const duplicates = new Set<number>()

  records.forEach((record, index) => {
    const key = buildDedupeKey(record as { type: string; timestamp: string })
    if (seen.has(key)) {
      duplicates.add(index)
      return
    }
    seen.add(key)
  })

  return duplicates
}

export const summarize = (
  records: readonly HealthRecord[],
  matcher: (record: HealthRecord, index: number) => boolean,
  preview = true
): CleanupSummary => {
  let matched = 0
  const byType: Record<string, number> = {}

  records.forEach((record, index) => {
    if (!matcher(record, index)) {
      return
    }

    matched += 1
    const key = record.type ?? 'unknown'
    byType[key] = (byType[key] ?? 0) + 1
  })

  return {
    preview,
    matched,
    removed: preview ? 0 : matched,
    kept: records.length - (preview ? 0 : matched),
    failed: 0,
    backupPath: null,
    byType,
  }
}

export const previewCleanup = async (
  criteria: CleanupCriteria,
  dataFilePath: string
): Promise<CleanupSummary> => {
  const records = await collectRecords(dataFilePath)
  const duplicateIndexes = detectDuplicateIndexes(records)
  const matcher = buildCleanupMatcher(criteria, duplicateIndexes)
  return summarize(records, matcher, true)
}
