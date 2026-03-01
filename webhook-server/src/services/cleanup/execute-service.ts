import { atomicRewrite } from '../../storage/health-log-store'
import { buildCleanupMatcher, type CleanupCriteria } from './filter-engine'
import { createBackup, writeCleanupAudit } from './audit-log'
import { collectRecords, detectDuplicateIndexes } from './preview-service'
import type { CleanupSummary } from './preview-service'

interface HealthRecord {
  readonly type?: string
  readonly [key: string]: unknown
}

export const executeCleanup = async (
  criteria: CleanupCriteria,
  dataFilePath: string
): Promise<CleanupSummary> => {
  const records = await collectRecords(dataFilePath)
  const duplicateIndexes = detectDuplicateIndexes(records)
  const matcher = buildCleanupMatcher(criteria, duplicateIndexes)

  const keptRecords: HealthRecord[] = []
  const byType: Record<string, number> = {}
  let matched = 0

  records.forEach((record, index) => {
    if (matcher(record, index)) {
      matched += 1
      byType[record.type ?? 'unknown'] = (byType[record.type ?? 'unknown'] ?? 0) + 1
      return
    }
    keptRecords.push(record)
  })

  const backupPath = await createBackup(dataFilePath)
  await atomicRewrite(dataFilePath, keptRecords)

  const result: CleanupSummary = {
    preview: false,
    matched,
    removed: matched,
    kept: keptRecords.length,
    failed: 0,
    backupPath,
    byType,
  }

  await writeCleanupAudit(dataFilePath, {
    operation: 'cleanup.execute',
    criteria,
    result,
  })

  return result
}
