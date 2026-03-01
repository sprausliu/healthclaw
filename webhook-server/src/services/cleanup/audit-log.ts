import * as path from 'path'
import { promises as fs } from 'fs'

const getBackupsDir = (dataFilePath: string): string => {
  return path.join(path.dirname(dataFilePath), 'backups')
}

export const createBackup = async (dataFilePath: string): Promise<string> => {
  const backupsDir = getBackupsDir(dataFilePath)
  await fs.mkdir(backupsDir, { recursive: true })

  const backupName = `health-data.${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`
  const backupPath = path.join(backupsDir, backupName)
  await fs.copyFile(dataFilePath, backupPath)

  return backupPath
}

export const writeCleanupAudit = async (
  dataFilePath: string,
  entry: Readonly<Record<string, unknown>>
): Promise<void> => {
  const auditPath = path.join(path.dirname(dataFilePath), 'cleanup-audit.log')
  await fs.appendFile(
    auditPath,
    `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
    'utf8'
  )
}
