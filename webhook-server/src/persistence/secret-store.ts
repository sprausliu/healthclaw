import { createSystemSecretProvider } from './providers/system-secret-provider'
import { createFileSecretProvider, type SecretProvider } from './providers/file-secret-provider'
import { warn } from '../logger'

export type ProviderType = 'system' | 'file'

export interface SecretStoreOptions {
  readonly backend?: ProviderType
  readonly secretFilePath?: string
}

export class SecretStore {
  private readonly provider: SecretProvider
  private readonly providerType: ProviderType

  constructor(provider: SecretProvider, providerType: ProviderType) {
    this.provider = provider
    this.providerType = providerType
  }

  async saveSecret(key: string, value: string): Promise<void> {
    return await this.provider.save(key, value)
  }

  async loadSecret(key: string): Promise<string | null> {
    return await this.provider.load(key)
  }

  async deleteSecret(key: string): Promise<void> {
    return await this.provider.delete(key)
  }

  getProviderType(): ProviderType {
    return this.providerType
  }
}

export const createSecretStore = async (options: SecretStoreOptions = {}): Promise<SecretStore> => {
  const preferredBackend =
    options.backend ??
    (process.env['HEALTHCLAW_SECRET_BACKEND'] as ProviderType | undefined) ??
    'system'
  const secretFilePath = options.secretFilePath

  // Try system provider first if preferred
  if (preferredBackend === 'system') {
    try {
      const systemProvider = createSystemSecretProvider()
      await systemProvider.test()
      return new SecretStore(systemProvider, 'system')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      warn('System keychain unavailable, falling back to file-based storage', {
        reason: message,
      })
    }
  }

  // Fall back to file provider
  if (!secretFilePath) {
    throw new Error('secretFilePath is required for file-based secret storage')
  }

  const fileProvider = createFileSecretProvider(secretFilePath)
  return new SecretStore(fileProvider, 'file')
}
