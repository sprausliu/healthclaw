import { promises as fs } from 'fs'

export interface DeviceMetadata {
  readonly tokenStored?: boolean
  readonly permanentToken?: string
  readonly [key: string]: unknown
}

export interface PairingState {
  readonly [key: string]: unknown
}

export interface RuntimeConfig {
  readonly pairing: PairingState | null
  readonly device: DeviceMetadata | null
}

interface NodeError extends Error {
  readonly code?: string
}

const isNodeError = (error: unknown): error is NodeError => error instanceof Error

export class RuntimeConfigRepository {
  private readonly configFilePath: string

  constructor(configFilePath: string) {
    this.configFilePath = configFilePath
  }

  async load(): Promise<RuntimeConfig> {
    try {
      const content = await fs.readFile(this.configFilePath, 'utf8')
      return JSON.parse(content) as RuntimeConfig
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return this.getDefaultConfig()
      }
      throw error
    }
  }

  async save(config: RuntimeConfig): Promise<void> {
    // Ensure no secret fields are persisted
    const sanitized = this.sanitizeConfig(config)
    await fs.writeFile(this.configFilePath, JSON.stringify(sanitized, null, 2), 'utf8')
  }

  private getDefaultConfig(): RuntimeConfig {
    return {
      pairing: null,
      device: null,
    }
  }

  private sanitizeConfig(config: RuntimeConfig): RuntimeConfig {
    const sanitized: RuntimeConfig = { ...config }

    // Remove any permanentToken field that might have leaked in
    if (sanitized.device && sanitized.device.permanentToken) {
      const { permanentToken: _permanentToken, ...rest } = sanitized.device
      return {
        ...sanitized,
        device: {
          ...rest,
          tokenStored: true, // Metadata indicating token exists in secret store
        },
      }
    }

    return sanitized
  }

  async updateDeviceMetadata(deviceMetadata: DeviceMetadata): Promise<void> {
    const config = await this.load()
    const updated: RuntimeConfig = {
      ...config,
      device: {
        ...config.device,
        ...deviceMetadata,
        tokenStored: true,
      },
    }
    await this.save(updated)
  }

  async updatePairingState(pairingState: PairingState): Promise<void> {
    const config = await this.load()
    const updated: RuntimeConfig = {
      ...config,
      pairing: pairingState,
    }
    await this.save(updated)
  }

  async getDeviceMetadata(): Promise<DeviceMetadata | null> {
    const config = await this.load()
    return config.device ?? null
  }

  async getPairingState(): Promise<PairingState | null> {
    const config = await this.load()
    return config.pairing ?? null
  }

  async isDevicePaired(): Promise<boolean> {
    const config = await this.load()
    return !!(config.device?.tokenStored ?? false)
  }
}

export const createRuntimeConfigRepository = (configFilePath: string): RuntimeConfigRepository => {
  return new RuntimeConfigRepository(configFilePath)
}
