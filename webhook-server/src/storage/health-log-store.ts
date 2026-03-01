import fs from 'fs'
import fsp from 'fs/promises'
import readline from 'readline'
import path from 'path'
import * as logger from '../logger'

/** A single NDJSON record — opaque JSON-serialisable object. */
export type HealthRecord = Readonly<Record<string, unknown>>

export async function appendRecord(filePath: string, record: HealthRecord): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8')
}

export async function* streamRecords(
  filePath: string
): AsyncGenerator<HealthRecord, void, undefined> {
  if (!fs.existsSync(filePath)) return

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      yield JSON.parse(line) as HealthRecord
    } catch (err) {
      logger.warn('Skipping malformed NDJSON line', {
        filePath,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

export async function atomicRewrite(
  filePath: string,
  records: readonly HealthRecord[]
): Promise<void> {
  const tmpPath = `${filePath}.tmp`
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  const payload = records.map((r) => JSON.stringify(r)).join('\n')
  await fsp.writeFile(tmpPath, payload ? `${payload}\n` : '', 'utf8')
  await fsp.rename(tmpPath, filePath)
}
