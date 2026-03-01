import { promises as fs } from 'fs'

// Migration states:
// - pending: Not yet attempted
// - in_progress: Migration started but not confirmed complete
// - completed: Migration finished successfully
// - failed: Migration attempted but failed
// - not_needed: No legacy config found

export type MigrationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'not_needed'

export interface MigrationStateData {
  readonly status: MigrationStatus
  readonly attemptedAt: string | null
  readonly completedAt: string | null
  readonly error: string | null
  readonly version: number
}

interface NodeError extends Error {
  readonly code: string
}

const isNodeError = (value: unknown): value is NodeError =>
  value instanceof Error && 'code' in value

const DEFAULT_STATE: MigrationStateData = {
  status: 'pending',
  attemptedAt: null,
  completedAt: null,
  error: null,
  version: 1,
}

export class MigrationState {
  private readonly statePath: string
  private state: MigrationStateData

  constructor(statePath: string) {
    this.statePath = statePath
    this.state = { ...DEFAULT_STATE }
  }

  async load(): Promise<MigrationStateData> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8')
      this.state = JSON.parse(data) as MigrationStateData
      return this.state
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === 'ENOENT') {
        // No state file yet, use default pending state
        return this.state
      }
      throw err
    }
  }

  async save(): Promise<void> {
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8')
  }

  async markInProgress(): Promise<void> {
    this.state = { ...this.state, status: 'in_progress', attemptedAt: new Date().toISOString() }
    await this.save()
  }

  async markCompleted(): Promise<void> {
    this.state = {
      ...this.state,
      status: 'completed',
      completedAt: new Date().toISOString(),
      error: null,
    }
    await this.save()
  }

  async markFailed(err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err)
    this.state = { ...this.state, status: 'failed', error: message }
    await this.save()
  }

  async markNotNeeded(): Promise<void> {
    this.state = { ...this.state, status: 'not_needed', completedAt: new Date().toISOString() }
    await this.save()
  }

  isComplete(): boolean {
    return this.state.status === 'completed' || this.state.status === 'not_needed'
  }

  shouldAttemptMigration(): boolean {
    // Attempt if pending, or retry if previously failed
    return this.state.status === 'pending' || this.state.status === 'failed'
  }

  getState(): MigrationStateData {
    return { ...this.state }
  }
}

export const createMigrationState = (statePath: string): MigrationState => {
  return new MigrationState(statePath)
}
