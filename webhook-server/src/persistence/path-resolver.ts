import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'
import { warn } from '../logger'

export interface PathResolverOptions {
  readonly dataDir?: string
  readonly repoRoot?: string
}

export interface Paths {
  readonly appDataRoot: string
  readonly configFile: string
  readonly healthDataFile: string
  readonly dedupeDbPath: string
  readonly migrationStatePath: string
  readonly secretFilePath: string
  readonly legacyConfigPath: string
}

export class PathResolver {
  private readonly customDataDir: string | undefined
  private readonly repoRoot: string

  constructor(options: PathResolverOptions = {}) {
    this.customDataDir = options.dataDir ?? process.env['HEALTHCLAW_DATA_DIR']
    this.repoRoot = options.repoRoot ?? process.cwd()
  }

  getAppDataRoot(): string {
    if (this.customDataDir) {
      return this.customDataDir
    }

    const platform = os.platform()
    const homeDir = os.homedir()

    switch (platform) {
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'healthclaw-webhook')
      case 'win32':
        return path.join(
          process.env['APPDATA'] ?? path.join(homeDir, 'AppData', 'Roaming'),
          'healthclaw-webhook'
        )
      default: // linux and others
        return path.join(
          process.env['XDG_DATA_HOME'] ?? path.join(homeDir, '.local', 'share'),
          'healthclaw-webhook'
        )
    }
  }

  getConfigFilePath(): string {
    return path.join(this.getAppDataRoot(), 'config.json')
  }

  getHealthDataFilePath(): string {
    return path.join(this.getAppDataRoot(), 'health-data.jsonl')
  }

  getDedupeDbPath(): string {
    return path.join(this.getAppDataRoot(), 'dedupe.db')
  }

  getMigrationStatePath(): string {
    return path.join(this.getAppDataRoot(), 'migration-state.json')
  }

  getSecretFilePath(): string {
    return path.join(this.getAppDataRoot(), '.secrets', 'device-token')
  }

  getLegacyConfigPath(): string {
    return path.join(this.repoRoot, 'config.json')
  }

  async ensureDirectories(): Promise<void> {
    const appDataRoot = this.getAppDataRoot()

    // Check if data directory would be inside repository
    const isInsideRepo = appDataRoot.startsWith(this.repoRoot)
    if (isInsideRepo) {
      warn('Runtime data directory is inside repository tree', {
        appDataRoot,
        suggestion: 'Consider setting HEALTHCLAW_DATA_DIR to an external location',
      })
    }

    await fs.mkdir(appDataRoot, { recursive: true })
    await fs.mkdir(path.dirname(this.getSecretFilePath()), { recursive: true })

    // Set restrictive permissions on secrets directory (Unix-like systems)
    if (os.platform() !== 'win32') {
      try {
        await fs.chmod(path.dirname(this.getSecretFilePath()), 0o700)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warn('Could not set permissions on secrets directory', { error: message })
      }
    }
  }

  getPaths(): Paths {
    return {
      appDataRoot: this.getAppDataRoot(),
      configFile: this.getConfigFilePath(),
      healthDataFile: this.getHealthDataFilePath(),
      dedupeDbPath: this.getDedupeDbPath(),
      migrationStatePath: this.getMigrationStatePath(),
      secretFilePath: this.getSecretFilePath(),
      legacyConfigPath: this.getLegacyConfigPath(),
    }
  }
}

export const createPathResolver = (options?: PathResolverOptions): PathResolver => {
  return new PathResolver(options)
}
