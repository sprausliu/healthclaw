import { promises as fs } from 'fs'
import * as path from 'path'

export interface DedupeEntry {
  readonly dedupeKey: string
  readonly recordType: string | null
  readonly recordTimestamp: string | null
  readonly firstSeenAt: string
  readonly lastSeenAt: string
  readonly duplicateCount: number
}

export interface UpsertResult {
  readonly created: boolean
  readonly entry: DedupeEntry
}

interface PartialRecord {
  readonly type?: string
  readonly timestamp?: string
}

interface NodeError extends Error {
  readonly code?: string
}

const isNodeError = (error: unknown): error is NodeError => error instanceof Error

export class DedupeRepository {
  private readonly dbPath: string
  private index: Map<string, DedupeEntry>
  private loaded: boolean

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.index = new Map()
    this.loaded = false
  }

  close(): void {
    // no-op for file-backed repository
  }

  async init(): Promise<void> {
    if (this.loaded) return

    await fs.mkdir(path.dirname(this.dbPath), { recursive: true })

    try {
      const content = await fs.readFile(this.dbPath, 'utf8')
      const parsed = JSON.parse(content || '{}') as Record<string, DedupeEntry>
      this.index = new Map(Object.entries(parsed))
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        await this.persist()
      } else {
        throw error
      }
    }

    this.loaded = true
  }

  async has(dedupeKey: string): Promise<boolean> {
    await this.init()
    return this.index.has(dedupeKey)
  }

  async upsert(dedupeKey: string, record: PartialRecord = {}): Promise<UpsertResult> {
    await this.init()

    const now = new Date().toISOString()
    const current = this.index.get(dedupeKey)

    if (current) {
      const updated: DedupeEntry = {
        ...current,
        lastSeenAt: now,
      }
      this.index.set(dedupeKey, updated)
      await this.persist()
      return { created: false, entry: updated }
    }

    const entry: DedupeEntry = {
      dedupeKey,
      recordType: record.type ?? null,
      recordTimestamp: record.timestamp ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
      duplicateCount: 0,
    }

    this.index.set(dedupeKey, entry)
    await this.persist()
    return { created: true, entry }
  }

  async bumpDuplicate(dedupeKey: string): Promise<DedupeEntry> {
    await this.init()

    const now = new Date().toISOString()
    const current = this.index.get(dedupeKey)

    if (!current) {
      const entry: DedupeEntry = {
        dedupeKey,
        recordType: null,
        recordTimestamp: null,
        firstSeenAt: now,
        lastSeenAt: now,
        duplicateCount: 1,
      }
      this.index.set(dedupeKey, entry)
      await this.persist()
      return entry
    }

    const updated: DedupeEntry = {
      ...current,
      duplicateCount: (current.duplicateCount ?? 0) + 1,
      lastSeenAt: now,
    }

    this.index.set(dedupeKey, updated)
    await this.persist()
    return updated
  }

  private async persist(): Promise<void> {
    const obj = Object.fromEntries(this.index.entries())
    await fs.writeFile(this.dbPath, JSON.stringify(obj, null, 2), 'utf8')
  }
}

export const createDedupeRepository = (dbPath: string): DedupeRepository => {
  return new DedupeRepository(dbPath)
}
