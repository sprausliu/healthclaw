import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'
import { warn } from '../../logger'

export interface SecretProvider {
  readonly test: () => Promise<boolean>
  readonly save: (key: string, value: string) => Promise<void>
  readonly load: (key: string) => Promise<string | null>
  readonly delete: (key: string) => Promise<void>
}

export class FileSecretProvider implements SecretProvider {
  private readonly secretDir: string

  constructor(secretFilePath: string) {
    this.secretDir = path.dirname(secretFilePath)
  }

  async test(): Promise<boolean> {
    // Always available
    return true
  }

  async save(key: string, value: string): Promise<void> {
    await fs.mkdir(this.secretDir, { recursive: true })

    // Set restrictive permissions on directory (Unix-like systems)
    if (os.platform() !== 'win32') {
      try {
        await fs.chmod(this.secretDir, 0o700)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        warn('Could not set directory permissions', { provider: 'file-secret', error: message })
      }
    }

    const filePath = this.getSecretPath(key)
    await fs.writeFile(filePath, value, { encoding: 'utf8', mode: 0o600 })

    // Double-check file permissions were set correctly
    if (os.platform() !== 'win32') {
      try {
        await fs.chmod(filePath, 0o600)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        warn('Could not set file permissions', { provider: 'file-secret', error: message })
      }
    }
  }

  async load(key: string): Promise<string | null> {
    try {
      const filePath = this.getSecretPath(key)
      const value = await fs.readFile(filePath, 'utf8')
      return value
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getSecretPath(key)
      await fs.unlink(filePath)
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return // Already deleted
      }
      throw error
    }
  }

  private getSecretPath(key: string): string {
    // Use key as filename with safe encoding
    const safeName = key.replace(/[^a-zA-Z0-9\-_]/g, '_')
    return path.join(this.secretDir, safeName)
  }
}

interface NodeError extends Error {
  readonly code?: string
}

const isNodeError = (error: unknown): error is NodeError => error instanceof Error

export const createFileSecretProvider = (secretFilePath: string): FileSecretProvider =>
  new FileSecretProvider(secretFilePath)
