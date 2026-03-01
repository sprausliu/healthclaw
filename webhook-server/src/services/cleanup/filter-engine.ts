export type CleanupMode = 'duplicates-only' | 'before-date' | 'by-type' | 'compound'

export interface CleanupFilters {
  readonly beforeTimestamp?: string
  readonly types?: readonly string[]
  readonly categories?: readonly string[]
}

export interface CleanupCriteria {
  readonly mode: CleanupMode
  readonly filters?: CleanupFilters
}

interface NormalizedFilters {
  readonly beforeTimestamp: string | null
  readonly types: Set<string> | null
  readonly categories: Set<string> | null
}

interface HealthRecord {
  readonly type?: string
  readonly timestamp?: string
  readonly category?: string
}

const normalizeFilters = (filters: CleanupFilters = {}): NormalizedFilters => {
  return {
    beforeTimestamp: filters.beforeTimestamp ?? null,
    types: Array.isArray(filters.types) ? new Set(filters.types) : null,
    categories: Array.isArray(filters.categories) ? new Set(filters.categories) : null,
  }
}

export const buildCleanupMatcher = (
  criteria: CleanupCriteria | null | undefined,
  duplicateIndexes: ReadonlySet<number> = new Set()
): ((record: HealthRecord, index: number) => boolean) => {
  const { mode, filters = {} } = criteria ?? {}
  const normalized = normalizeFilters(filters)

  if (!mode) {
    throw new Error('mode is required')
  }

  return (record: HealthRecord, index: number): boolean => {
    const byType = !normalized.types || normalized.types.has(record.type ?? '')
    const byCategory = !normalized.categories || normalized.categories.has(record.category ?? '')
    const byTimestamp =
      !normalized.beforeTimestamp ||
      (record.timestamp && Date.parse(record.timestamp) < Date.parse(normalized.beforeTimestamp))

    switch (mode) {
      case 'duplicates-only':
        return duplicateIndexes.has(index)
      case 'before-date':
        return Boolean(byTimestamp)
      case 'by-type':
        return Boolean(byType)
      case 'compound':
        return Boolean(byTimestamp && byType && byCategory)
      default:
        throw new Error(`Unsupported cleanup mode: ${mode}`)
    }
  }
}
