import { promises as fs } from 'fs'
import { info, warn } from '../logger'
import type { RuntimeConfigRepository } from './runtime-config-repo'

export interface LegacyData {
  readonly permanentToken: string | null
  readonly deviceInfo: Record<string, unknown>
  readonly pairedAt: string | null
  readonly lastSync: string | null
  readonly pairingToken: string | null
  readonly pairingExpiresAt: string | null
  readonly pairingUsed: boolean
}

export interface MigrationResult {
  readonly needed: boolean
  readonly migratedToken?: boolean
  readonly migratedDevice?: boolean
  readonly pairedAt?: string | null
}

interface CredentialService {
  saveDeviceToken(token: string): Promise<void>
}

export class LegacyConfigMigrator {
  private readonly legacyConfigPath: string

  constructor(legacyConfigPath: string) {
    this.legacyConfigPath = legacyConfigPath
  }

  async hasLegacyConfig(): Promise<boolean> {
    try {
      await fs.access(this.legacyConfigPath)
      return true
    } catch {
      return false
    }
  }

  async extractLegacyData(): Promise<LegacyData> {
    try {
      const data = await fs.readFile(this.legacyConfigPath, 'utf-8')
      const config = JSON.parse(data) as Record<string, unknown>

      const device = config['device'] as Record<string, unknown> | undefined
      const pairing = config['pairing'] as Record<string, unknown> | undefined

      return {
        permanentToken: (device?.['permanentToken'] as string) ?? null,
        deviceInfo: (device?.['deviceInfo'] as Record<string, unknown>) ?? {},
        pairedAt: (device?.['pairedAt'] as string) ?? null,
        lastSync: (device?.['lastSync'] as string) ?? null,
        pairingToken: (pairing?.['token'] as string) ?? null,
        pairingExpiresAt: (pairing?.['expiresAt'] as string) ?? null,
        pairingUsed: (pairing?.['used'] as boolean) ?? false,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to read legacy config: ${message}`)
    }
  }

  async redactLegacyToken(): Promise<void> {
    try {
      const data = await fs.readFile(this.legacyConfigPath, 'utf-8')
      const config = JSON.parse(data) as Record<string, unknown>

      const device = config['device'] as Record<string, unknown> | undefined
      if (device?.['permanentToken']) {
        // Remove the permanent token but preserve other device data
        const { permanentToken: _permanentToken, ...rest } = device
        config['device'] = rest

        // Add migration marker
        config['_migrated'] = {
          migratedAt: new Date().toISOString(),
          note: 'Permanent token migrated to secure storage. See docs/persistence.md',
        }

        await fs.writeFile(this.legacyConfigPath, JSON.stringify(config, null, 2), 'utf-8')

        info('Redacted permanentToken from legacy config', { component: 'legacy-migrator' })
      }
    } catch (error: unknown) {
      // Non-fatal: log but don't fail migration if we can't redact
      const message = error instanceof Error ? error.message : String(error)
      warn('Could not redact legacy config', { component: 'legacy-migrator', error: message })
    }
  }

  async migrate(
    credentialService: CredentialService,
    runtimeConfigRepo: RuntimeConfigRepository
  ): Promise<MigrationResult> {
    info('Starting legacy config migration', { component: 'legacy-migrator' })

    const hasLegacy = await this.hasLegacyConfig()
    if (!hasLegacy) {
      info('No legacy config found, migration not needed', { component: 'legacy-migrator' })
      return { needed: false }
    }

    // Extract legacy data
    const legacyData = await this.extractLegacyData()

    if (!legacyData.permanentToken) {
      info('Legacy config exists but has no permanentToken', { component: 'legacy-migrator' })
      return { needed: false }
    }

    info('Found legacy permanentToken, migrating to secure storage', {
      component: 'legacy-migrator',
    })

    // Step 1: Save token to secret store
    await credentialService.saveDeviceToken(legacyData.permanentToken)

    // Step 2: Save non-secret device metadata to new runtime config
    const config = await runtimeConfigRepo.load()
    const updatedConfig = {
      ...config,
      device: {
        deviceInfo: legacyData.deviceInfo,
        pairedAt: legacyData.pairedAt,
        lastSync: legacyData.lastSync,
        tokenStored: true,
      },
      // Preserve pairing state if present
      pairing: legacyData.pairingToken
        ? {
            token: legacyData.pairingToken,
            expiresAt: legacyData.pairingExpiresAt,
            used: legacyData.pairingUsed,
          }
        : config.pairing,
    }

    await runtimeConfigRepo.save(updatedConfig)

    // Step 3: Redact token from legacy file
    await this.redactLegacyToken()

    info('Migration completed successfully', { component: 'legacy-migrator' })
    return {
      needed: true,
      migratedToken: true,
      migratedDevice: true,
      pairedAt: legacyData.pairedAt,
    }
  }
}

export const createLegacyConfigMigrator = (legacyConfigPath: string): LegacyConfigMigrator => {
  return new LegacyConfigMigrator(legacyConfigPath)
}
