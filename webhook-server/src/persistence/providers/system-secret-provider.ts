import { execFile } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'

const execFileAsync = promisify(execFile)

const SERVICE_NAME = 'healthclaw-webhook' as const

export interface SecretProvider {
  test(): Promise<boolean>
  save(key: string, value: string): Promise<void>
  load(key: string): Promise<string | null>
  delete(key: string): Promise<void>
}

interface ExecFileError extends Error {
  readonly code?: number
}

export class SystemSecretProvider implements SecretProvider {
  private readonly platform: NodeJS.Platform

  constructor() {
    this.platform = os.platform()
  }

  async test(): Promise<boolean> {
    // Test if we can use the system keychain
    if (this.platform === 'darwin') {
      try {
        await execFileAsync('security', ['find-generic-password', '-h'])
        return true
      } catch {
        throw new Error('macOS security command not available')
      }
    } else if (this.platform === 'linux') {
      try {
        await execFileAsync('secret-tool', ['--version'])
        return true
      } catch {
        throw new Error('libsecret/secret-tool not available on Linux')
      }
    } else if (this.platform === 'win32') {
      // Windows Credential Manager is always available
      return true
    } else {
      throw new Error(`Unsupported platform: ${this.platform}`)
    }
  }

  async save(key: string, value: string): Promise<void> {
    if (this.platform === 'darwin') {
      return await this.saveMacOS(key, value)
    } else if (this.platform === 'linux') {
      return await this.saveLinux(key, value)
    } else if (this.platform === 'win32') {
      return await this.saveWindows(key, value)
    } else {
      throw new Error(`Unsupported platform: ${this.platform}`)
    }
  }

  async load(key: string): Promise<string | null> {
    if (this.platform === 'darwin') {
      return await this.loadMacOS(key)
    } else if (this.platform === 'linux') {
      return await this.loadLinux(key)
    } else if (this.platform === 'win32') {
      return await this.loadWindows(key)
    } else {
      throw new Error(`Unsupported platform: ${this.platform}`)
    }
  }

  async delete(key: string): Promise<void> {
    if (this.platform === 'darwin') {
      return await this.deleteMacOS(key)
    } else if (this.platform === 'linux') {
      return await this.deleteLinux(key)
    } else if (this.platform === 'win32') {
      return await this.deleteWindows(key)
    } else {
      throw new Error(`Unsupported platform: ${this.platform}`)
    }
  }

  private async saveMacOS(key: string, value: string): Promise<void> {
    try {
      // Try to delete existing first
      await this.deleteMacOS(key)
    } catch {
      // Ignore if doesn't exist
    }

    await execFileAsync('security', [
      'add-generic-password',
      '-s',
      SERVICE_NAME,
      '-a',
      key,
      '-w',
      value,
    ])
  }

  private async loadMacOS(key: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('security', [
        'find-generic-password',
        '-s',
        SERVICE_NAME,
        '-a',
        key,
        '-w',
      ])
      return stdout.trim()
    } catch (error) {
      const execError = error as ExecFileError
      if (execError.code === 44) {
        return null // Item not found
      }
      throw error
    }
  }

  private async deleteMacOS(key: string): Promise<void> {
    await execFileAsync('security', ['delete-generic-password', '-s', SERVICE_NAME, '-a', key])
  }

  private async saveLinux(key: string, value: string): Promise<void> {
    const { spawn } = await import('child_process')
    return new Promise((resolve, reject) => {
      const proc = spawn('secret-tool', [
        'store',
        '--label',
        `${SERVICE_NAME}:${key}`,
        'service',
        SERVICE_NAME,
        'key',
        key,
      ])

      let errorOutput = ''
      proc.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      proc.on('error', (error) => {
        reject(error)
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`secret-tool exited with code ${code}: ${errorOutput}`))
        }
      })

      proc.stdin.write(value)
      proc.stdin.end()
    })
  }

  private async loadLinux(key: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('secret-tool', [
        'lookup',
        'service',
        SERVICE_NAME,
        'key',
        key,
      ])
      return stdout.trim()
    } catch (error) {
      const execError = error as ExecFileError
      if (execError.code === 1) {
        return null // Item not found
      }
      throw error
    }
  }

  private async deleteLinux(key: string): Promise<void> {
    await execFileAsync('secret-tool', ['clear', 'service', SERVICE_NAME, 'key', key])
  }

  private async saveWindows(key: string, value: string): Promise<void> {
    const powershell = `
      $password = ConvertTo-SecureString -String "${value.replace(/"/g, '`"')}" -AsPlainText -Force;
      $credential = New-Object System.Management.Automation.PSCredential("${key}", $password);
      $credential.Password | ConvertFrom-SecureString | Out-File -FilePath "$env:LOCALAPPDATA\\healthclaw-webhook\\${key}.cred" -Encoding UTF8
    `
    await execFileAsync('powershell.exe', ['-Command', powershell])
  }

  private async loadWindows(key: string): Promise<string | null> {
    try {
      const powershell = `
        $encrypted = Get-Content -Path "$env:LOCALAPPDATA\\healthclaw-webhook\\${key}.cred" -Raw;
        $secureString = ConvertTo-SecureString -String $encrypted;
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureString);
        [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
      `
      const { stdout } = await execFileAsync('powershell.exe', ['-Command', powershell])
      return stdout.trim() || null
    } catch {
      return null
    }
  }

  private async deleteWindows(key: string): Promise<void> {
    const powershell = `Remove-Item -Path "$env:LOCALAPPDATA\\healthclaw-webhook\\${key}.cred" -ErrorAction SilentlyContinue`
    await execFileAsync('powershell.exe', ['-Command', powershell])
  }
}

export const createSystemSecretProvider = (): SystemSecretProvider => {
  return new SystemSecretProvider()
}
