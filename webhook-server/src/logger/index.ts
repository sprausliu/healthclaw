// Structured JSON logger
//
// Emits one JSON object per line to stdout.
// Log level is configurable via LOG_LEVEL env var (default: 'info').

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Readonly<Record<string, unknown>>

interface LogEntry {
  readonly level: LogLevel
  readonly timestamp: string
  readonly message: string
  readonly [key: string]: unknown
}

const LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const isValidLogLevel = (value: unknown): value is LogLevel =>
  typeof value === 'string' && value in LEVEL_PRIORITY

const getConfiguredLevel = (): LogLevel => {
  const env = process.env['LOG_LEVEL']
  const normalized = typeof env === 'string' ? env.toLowerCase() : undefined
  return isValidLogLevel(normalized) ? normalized : 'info'
}

export const log = (level: LogLevel, message: string, ctx?: LogContext): void => {
  const threshold = getConfiguredLevel()
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[threshold]) {
    return
  }

  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...ctx,
  }

  process.stdout.write(JSON.stringify(entry) + '\n')
}

export const debug = (message: string, ctx?: LogContext): void => log('debug', message, ctx)

export const info = (message: string, ctx?: LogContext): void => log('info', message, ctx)

export const warn = (message: string, ctx?: LogContext): void => log('warn', message, ctx)

export const error = (message: string, ctx?: LogContext): void => log('error', message, ctx)
