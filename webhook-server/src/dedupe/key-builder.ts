import { createHash } from 'crypto'

type SortableValue = unknown

const sortObject = (value: SortableValue): SortableValue => {
  if (Array.isArray(value)) {
    return value.map(sortObject)
  }
  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = sortObject((value as Record<string, unknown>)[key])
        return acc
      },
      {} as Record<string, SortableValue>
    )
}

const toIso = (timestamp: string): string => {
  return new Date(timestamp).toISOString()
}

interface HealthRecord {
  readonly type: string
  readonly timestamp: string
  readonly category?: string
  readonly source?: unknown
  readonly data?: unknown
}

const buildCanonicalIdentity = (record: HealthRecord): string => {
  const normalized = {
    type: record.type,
    timestamp: toIso(record.timestamp),
    category: record.category ?? null,
    source: sortObject(record.source ?? {}),
    data: sortObject(record.data ?? {}),
  }

  return JSON.stringify(normalized)
}

export const buildDedupeKey = (record: HealthRecord): string => {
  const canonical = buildCanonicalIdentity(record)
  return createHash('sha256').update(canonical).digest('hex')
}

export { buildCanonicalIdentity }
