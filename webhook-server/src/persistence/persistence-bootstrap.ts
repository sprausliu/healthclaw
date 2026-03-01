import { createPathResolver, type PathResolver, type Paths } from './path-resolver'
import { createRuntimeConfigRepository, type RuntimeConfigRepository } from './runtime-config-repo'
import { createSecretStore, type SecretStore, type ProviderType } from './secret-store'
import { createCredentialService, type CredentialService } from './credential-service'
import { createMigrationState, type MigrationState } from './migration-state'
import { createLegacyConfigMigrator } from './legacy-config-migrator'
import { info, error as logError } from '../logger'

export interface BootstrapOptions {
  readonly dataDir?: string
  readonly repoRoot?: string
  readonly secretBackend?: ProviderType
}

export interface PersistenceContext {
  readonly pathResolver: PathResolver
  readonly runtimeConfig: RuntimeConfigRepository
  readonly secretStore: SecretStore
  readonly credentialService: CredentialService
  readonly migrationState: MigrationState
  readonly paths: Paths
}

export interface Diagnostics {
  readonly initialized: boolean
  readonly secretBackend?: ProviderType | undefined
  readonly migration?: ReturnType<MigrationState['getState']> | undefined
  readonly paths?:
    | {
        readonly appDataRoot: string
        readonly configFile: string
        readonly healthDataFile: string
        readonly dedupeDbPath: string
      }
    | undefined
}

export class PersistenceBootstrap {
  private pathResolver: PathResolver | null
  private runtimeConfig: RuntimeConfigRepository | null
  private secretStore: SecretStore | null
  private credentialService: CredentialService | null
  private migrationState: MigrationState | null
  private initialized: boolean

  constructor() {
    this.pathResolver = null
    this.runtimeConfig = null
    this.secretStore = null
    this.credentialService = null
    this.migrationState = null
    this.initialized = false
  }

  async initialize(options: BootstrapOptions = {}): Promise<PersistenceContext> {
    if (this.initialized) {
      return this.getContext()
    }

    // Step 1: Resolve paths
    this.pathResolver = createPathResolver(
      options.dataDir || options.repoRoot
        ? {
            ...(options.dataDir ? { dataDir: options.dataDir } : {}),
            ...(options.repoRoot ? { repoRoot: options.repoRoot } : {}),
          }
        : {}
    )

    const paths = this.pathResolver.getPaths()

    // Step 2: Ensure directories exist
    await this.pathResolver.ensureDirectories()

    // Step 3: Initialize secret store
    this.secretStore = await createSecretStore(
      options.secretBackend
        ? {
            backend: options.secretBackend,
            secretFilePath: paths.secretFilePath,
          }
        : {
            secretFilePath: paths.secretFilePath,
          }
    )

    // Step 4: Initialize runtime config
    this.runtimeConfig = createRuntimeConfigRepository(paths.configFile)

    // Step 5: Initialize credential service
    this.credentialService = createCredentialService(this.secretStore)

    // Step 6: Run legacy migration if needed (idempotent, with state tracking)
    this.migrationState = createMigrationState(paths.migrationStatePath)
    await this.migrationState.load()

    if (this.migrationState.shouldAttemptMigration()) {
      await this.runMigration(paths)
    }

    this.initialized = true

    return this.getContext()
  }

  private async runMigration(paths: Paths): Promise<void> {
    if (!this.migrationState || !this.credentialService || !this.runtimeConfig) {
      throw new Error('Dependencies not initialized')
    }

    try {
      await this.migrationState.markInProgress()

      const migrator = createLegacyConfigMigrator(paths.legacyConfigPath)
      const result = await migrator.migrate(this.credentialService, this.runtimeConfig)

      if (result.needed) {
        await this.migrationState.markCompleted()
        info('Legacy config migration completed successfully', {
          component: 'persistence-bootstrap',
        })
      } else {
        await this.migrationState.markNotNeeded()
        info('Legacy config migration not needed', { component: 'persistence-bootstrap' })
      }
    } catch (err: unknown) {
      await this.migrationState.markFailed(err)
      const message = err instanceof Error ? err.message : String(err)
      logError('Migration failed', { component: 'persistence-bootstrap', error: message })
      // Don't throw - allow service to start even if migration fails
      // Operator can investigate and retry on next restart
    }
  }

  getContext(): PersistenceContext {
    if (
      !this.initialized ||
      !this.pathResolver ||
      !this.runtimeConfig ||
      !this.secretStore ||
      !this.credentialService ||
      !this.migrationState
    ) {
      throw new Error('PersistenceBootstrap not initialized. Call initialize() first.')
    }

    return {
      pathResolver: this.pathResolver,
      runtimeConfig: this.runtimeConfig,
      secretStore: this.secretStore,
      credentialService: this.credentialService,
      migrationState: this.migrationState,
      paths: this.pathResolver.getPaths(),
    }
  }

  getDiagnostics(): Diagnostics {
    if (!this.initialized || !this.pathResolver || !this.secretStore) {
      return { initialized: false }
    }

    const paths = this.pathResolver.getPaths()
    const migrationStatus = this.migrationState ? this.migrationState.getState() : undefined

    return {
      initialized: true,
      secretBackend: this.secretStore.getProviderType(),
      migration: migrationStatus,
      paths: {
        appDataRoot: paths.appDataRoot,
        configFile: paths.configFile,
        healthDataFile: paths.healthDataFile,
        dedupeDbPath: paths.dedupeDbPath,
      },
    }
  }
}

let globalBootstrap: PersistenceBootstrap | null = null

export const bootstrap = async (options: BootstrapOptions = {}): Promise<PersistenceContext> => {
  if (!globalBootstrap) {
    globalBootstrap = new PersistenceBootstrap()
  }
  return await globalBootstrap.initialize(options)
}

export const getBootstrap = (): PersistenceContext => {
  if (!globalBootstrap || !globalBootstrap['initialized']) {
    throw new Error('Persistence not bootstrapped. Call bootstrap() first.')
  }
  return globalBootstrap.getContext()
}

export const getDiagnostics = (): Diagnostics => {
  if (!globalBootstrap) {
    return { initialized: false }
  }
  return globalBootstrap.getDiagnostics()
}
