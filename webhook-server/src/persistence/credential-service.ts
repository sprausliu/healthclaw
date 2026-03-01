import { info } from '../logger'
import type { SecretStore } from './secret-store'
import type { DeviceToken } from '../types/branded'

const DEVICE_TOKEN_KEY = 'device-permanent-token' as const

export class CredentialService {
  private readonly secretStore: SecretStore

  constructor(secretStore: SecretStore) {
    this.secretStore = secretStore
  }

  async saveDeviceToken(token: string): Promise<void> {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token: must be a non-empty string')
    }

    // Never log the actual token
    info('Saving device token to secret store', { component: 'credential-service' })
    await this.secretStore.saveSecret(DEVICE_TOKEN_KEY, token)
  }

  async loadDeviceToken(): Promise<DeviceToken | null> {
    const token = await this.secretStore.loadSecret(DEVICE_TOKEN_KEY)
    if (token) {
      // Never log the actual token, only indicate it was loaded
      info('Device token loaded from secret store', { component: 'credential-service' })
      return token as DeviceToken
    }
    return null
  }

  async revokeDeviceToken(): Promise<void> {
    info('Revoking device token from secret store', { component: 'credential-service' })
    await this.secretStore.deleteSecret(DEVICE_TOKEN_KEY)
  }

  async hasDeviceToken(): Promise<boolean> {
    const token = await this.loadDeviceToken()
    return token !== null
  }

  async verifyToken(providedToken: string | undefined): Promise<boolean> {
    if (!providedToken) {
      return false
    }

    const storedToken = await this.loadDeviceToken()
    if (!storedToken) {
      return false
    }

    // Constant-time comparison to prevent timing attacks
    return this.constantTimeEqual(providedToken, storedToken)
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  // Redaction helper for safe logging
  static redactToken(token: string | undefined): string {
    if (!token || token.length < 8) {
      return '[REDACTED]'
    }
    return `${token.substring(0, 8)}...[REDACTED]`
  }
}

export const createCredentialService = (secretStore: SecretStore): CredentialService => {
  return new CredentialService(secretStore)
}
