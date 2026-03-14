import { createHash, randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import * as path from 'path'
import { info } from '../logger'

export interface UserRecord {
  readonly id: string
  readonly tokenHash: string
  readonly name: string
  readonly createdAt: string
}

export interface CreateUserResult {
  readonly userId: string
  readonly token: string
}

interface NodeError extends Error {
  readonly code?: string
}

const isNodeError = (error: unknown): error is NodeError => error instanceof Error

export class UserRegistry {
  private readonly filePath: string
  private users: UserRecord[] = []
  private loaded = false

  constructor(filePath: string) {
    this.filePath = filePath
  }

  private async load(): Promise<void> {
    if (this.loaded) return

    try {
      const content = await fs.readFile(this.filePath, 'utf8')
      this.users = JSON.parse(content) as UserRecord[]
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        this.users = []
      } else {
        throw error
      }
    }
    this.loaded = true
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(this.users, null, 2), 'utf8')
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private generateUserId(): string {
    return `usr_${randomBytes(4).toString('hex')}`
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex')
  }

  async createUser(name: string): Promise<CreateUserResult> {
    await this.load()

    const userId = this.generateUserId()
    const token = this.generateToken()
    const tokenHash = this.hashToken(token)

    const record: UserRecord = {
      id: userId,
      tokenHash,
      name,
      createdAt: new Date().toISOString(),
    }

    this.users.push(record)
    await this.persist()

    info('User created', { component: 'user-registry', userId, name })
    return { userId, token }
  }

  async listUsers(): Promise<UserRecord[]> {
    await this.load()
    return [...this.users]
  }

  async findByToken(token: string): Promise<UserRecord | null> {
    await this.load()

    const tokenHash = this.hashToken(token)
    return this.users.find((u) => u.tokenHash === tokenHash) ?? null
  }
}

export const createUserRegistry = (filePath: string): UserRegistry => {
  return new UserRegistry(filePath)
}
