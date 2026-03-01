import 'dotenv/config'
import express, { type Request, type Response, type NextFunction, type Express } from 'express'
import bodyParser from 'body-parser'
import { randomBytes } from 'crypto'
import { createDedupeRepository, type DedupeRepository } from './dedupe/dedupe-repository'
import { appendRecord } from './storage/health-log-store'
import { createIngestService } from './services/ingest-service'
import { createBatchSyncService } from './services/batch-sync-service'
import { buildBatchSyncResponse } from './contracts/batch-sync-response'
import { createBatchGuardrails } from './middleware/batch-guardrails'
import { authenticateAdmin } from './middleware/auth-admin'
import { validate } from './middleware/validate'
import {
  HealthSyncBodySchema,
  BatchSyncBodySchema,
  PairingRequestBodySchema,
} from './schemas/health-sync.schema'
import { previewCleanup } from './services/cleanup/preview-service'
import { executeCleanup } from './services/cleanup/execute-service'
import { bootstrap, getDiagnostics } from './persistence/persistence-bootstrap'
import { createCredentialService, type CredentialService } from './persistence/credential-service'
import { info, warn, error as logError } from './logger'
import type { RuntimeConfig } from './persistence/runtime-config-repo'
import type { PersistenceContext } from './persistence/persistence-bootstrap'

export interface CreateAppOptions {
  readonly port?: number
  readonly batchMaxItems?: number
  readonly batchMaxBodyMb?: number
  readonly dataDir?: string
  readonly repoRoot?: string
  readonly secretBackend?: 'system' | 'file'
}

export interface AppWithExtensions extends Express {
  start: () => ReturnType<Express['listen']>
  dedupeRepository: DedupeRepository
  paths: {
    readonly CONFIG_FILE: string
    readonly HEALTH_DATA_FILE: string
    readonly DEDUPE_DB_PATH: string
    readonly healthDataFile: string
    readonly configFile: string
    readonly dedupeDbPath: string
  }
}

interface PairLinks {
  readonly baseUrl: string
  readonly deepLink: string
  readonly openUrl: string
}

export const createApp = async (options: CreateAppOptions = {}): Promise<AppWithExtensions> => {
  const app = express() as AppWithExtensions
  app.set('trust proxy', true)

  const PORT = options.port ?? Number(process.env['PORT'] ?? 3000)
  const BATCH_MAX_ITEMS = options.batchMaxItems ?? Number(process.env['BATCH_MAX_ITEMS'] ?? 5000)
  const BATCH_MAX_BODY_MB = options.batchMaxBodyMb ?? Number(process.env['BATCH_MAX_BODY_MB'] ?? 10)

  // Initialize persistence layer
  const bootstrapOpts: {
    dataDir?: string
    repoRoot?: string
    secretBackend?: 'system' | 'file'
  } = {}
  if (options.dataDir) bootstrapOpts.dataDir = options.dataDir
  if (options.repoRoot ?? __dirname) bootstrapOpts.repoRoot = options.repoRoot ?? __dirname
  if (options.secretBackend) bootstrapOpts.secretBackend = options.secretBackend

  const persistence: PersistenceContext = await bootstrap(bootstrapOpts)

  const { paths, runtimeConfig, secretStore } = persistence
  const credentialService: CredentialService = createCredentialService(secretStore)

  // Log startup diagnostics
  const diagnostics = getDiagnostics()
  info('Persistence initialized', { component: 'healthclaw' })
  info('Data directory configured', {
    component: 'healthclaw',
    dataDir: diagnostics.paths?.appDataRoot,
  })
  info('Secret backend configured', {
    component: 'healthclaw',
    backend: diagnostics.secretBackend,
  })

  // Log migration status
  if (diagnostics.migration) {
    const migStatus = diagnostics.migration.status
    if (migStatus === 'completed') {
      info('Legacy config migration completed', {
        component: 'healthclaw',
        completedAt: diagnostics.migration.completedAt,
      })
    } else if (migStatus === 'not_needed') {
      info('Legacy config migration not needed', { component: 'healthclaw' })
    } else if (migStatus === 'failed') {
      warn('Legacy config migration FAILED', {
        component: 'healthclaw',
        error: diagnostics.migration.error,
        note: 'Service will continue, but you may need to re-pair your device',
      })
    } else if (migStatus === 'in_progress') {
      warn('Legacy config migration incomplete from previous run', { component: 'healthclaw' })
    }
  }

  // Use resolved paths
  const CONFIG_FILE = paths.configFile
  const HEALTH_DATA_FILE = paths.healthDataFile
  const DEDUPE_DB_PATH = paths.dedupeDbPath

  const dedupeRepository = createDedupeRepository(DEDUPE_DB_PATH)
  await dedupeRepository.init()

  const ingestService = createIngestService({
    dedupeRepository,
    logStorePath: HEALTH_DATA_FILE,
    appendRecord: (path: string, record: unknown) =>
      appendRecord(path, record as Readonly<Record<string, unknown>>),
  })
  const batchSyncService = createBatchSyncService({ ingestService })

  app.use(bodyParser.json({ limit: `${BATCH_MAX_BODY_MB}mb` }))

  const loadConfig = async (): Promise<RuntimeConfig> => {
    return await runtimeConfig.load()
  }

  const saveConfig = async (config: RuntimeConfig): Promise<void> => {
    await runtimeConfig.save(config)
  }

  const generateToken = (): string => {
    return randomBytes(32).toString('hex')
  }

  const buildPairLinks = (req: Request, token: string): PairLinks => {
    const baseUrl = `${req.protocol}://${req.get('host')}`
    const deepLink = `healthclaw://pair?url=${encodeURIComponent(baseUrl)}&token=${token}`
    const openUrl = `${baseUrl}/pair/open?token=${encodeURIComponent(token)}`
    return { baseUrl, deepLink, openUrl }
  }

  const authenticatePermanent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const token = req.headers['x-api-token'] as string | undefined
    if (!token) {
      res.status(401).json({ error: 'Missing API token' })
      return
    }

    try {
      const isValid = await credentialService.verifyToken(token)
      if (!isValid) {
        res.status(401).json({ error: 'Invalid or expired token' })
        return
      }
      next()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logError('Token verification failed', { component: 'auth', error: message })
      res.status(500).json({ error: 'Authentication system error' })
    }
  }

  app.get('/health', async (_req: Request, res: Response) => {
    const isPaired = await runtimeConfig.isDevicePaired()
    res.json({
      status: 'ok',
      server: 'HealthClaw Webhook Server',
      version: '0.2.0',
      timestamp: new Date().toISOString(),
      paired: isPaired,
    })
  })

  app.post('/admin/generate-pairing', async (req: Request, res: Response) => {
    const token = generateToken()
    const expiresAt = Date.now() + 2 * 60 * 1000
    const config = await loadConfig()

    await saveConfig({
      ...config,
      pairing: { token, expiresAt, used: false },
    })

    const { deepLink, openUrl } = buildPairLinks(req, token)
    res.json({
      success: true,
      pairingToken: token,
      deepLink,
      openUrl,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresInSeconds: 120,
    })
  })

  app.get('/pair/open', async (req: Request, res: Response) => {
    const token = String(req.query['token'] ?? '')
    const config = await loadConfig()

    let status = 'invalid'
    if (config.pairing && token && config.pairing['token'] === token) {
      const pairing = config.pairing as { used?: boolean; expiresAt?: number }
      if (pairing.used) status = 'used'
      else if (Date.now() > (pairing.expiresAt ?? 0)) status = 'expired'
      else status = 'valid'
    }

    const { deepLink } = buildPairLinks(req, token)
    const canOpen = status === 'valid'
    const title = canOpen ? 'Open HealthClaw App to Pair' : 'Pairing Link Unavailable'
    const subtitle = canOpen
      ? 'Tap the button below to continue pairing in HealthClaw.'
      : status === 'expired'
        ? 'This pairing link has expired. Please generate a new link.'
        : status === 'used'
          ? 'This pairing link was already used. Please generate a new one.'
          : 'Invalid pairing token. Please generate a new link.'

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>HealthClaw Pairing</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif; background: #0b1020; color: #e5e7eb; margin: 0; }
      .wrap { min-height: 100vh; display: grid; justify-items: center; align-items: start; padding: 12px 24px 24px; }
      .card { width: min(560px, 100%); background: #111827; border: 1px solid #374151; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
      h1 { margin: 0 0 8px; font-size: 22px; }
      p { margin: 0 0 20px; color: #9ca3af; line-height: 1.5; }
      .btn { display: inline-block; padding: 12px 16px; border-radius: 10px; text-decoration: none; font-weight: 600; }
      .btn-primary { background: #3b82f6; color: white; }
      .btn-primary[aria-disabled='true'] { pointer-events: none; opacity: .5; }
      .hint { margin-top: 16px; font-size: 13px; color: #9ca3af; word-break: break-all; }
      code { color: #cbd5e1; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <a class="btn btn-primary" href="${canOpen ? deepLink : '#'}" aria-disabled="${canOpen ? 'false' : 'true'}">Open HealthClaw</a>
        <div class="hint">If the app does not open, copy this link manually:<br/><code>${deepLink}</code></div>
      </div>
    </div>
  </body>
</html>`)
  })

  app.post('/api/pair', validate(PairingRequestBodySchema), async (req: Request, res: Response) => {
    const pairingToken = req.query['token'] as string | undefined
    const config = await loadConfig()

    if (!pairingToken) {
      res.status(400).json({ error: 'Missing pairing token' })
      return
    }
    if (!config.pairing) {
      res.status(401).json({ error: 'No pairing token generated' })
      return
    }

    const pairing = config.pairing as { token?: string; used?: boolean; expiresAt?: number }
    if (pairing.token !== pairingToken) {
      res.status(401).json({ error: 'Invalid pairing token' })
      return
    }
    if (pairing.used) {
      res.status(401).json({ error: 'Pairing token already used' })
      return
    }
    if (Date.now() > (pairing.expiresAt ?? 0)) {
      res.status(401).json({ error: 'Pairing token expired' })
      return
    }

    const permanentToken = generateToken()

    // Store token in secret backend
    await credentialService.saveDeviceToken(permanentToken)

    // Store only metadata in config (no secret token)
    await saveConfig({
      ...config,
      pairing: { ...pairing, used: true },
      device: {
        deviceInfo: req.body?.deviceInfo ?? {},
        pairedAt: new Date().toISOString(),
        lastSync: null,
        tokenStored: true,
      },
    })

    const webhookUrl = `${req.protocol}://${req.get('host')}/api/health-sync`
    res.json({ success: true, permanentToken, webhookUrl, message: 'Device paired successfully' })
  })

  app.post(
    '/api/health-sync',
    authenticatePermanent,
    validate(HealthSyncBodySchema),
    async (req: Request, res: Response) => {
      const result = await ingestService.ingest(req.body)
      if (result.status === 'failed') {
        res.status(400).json({ error: result.message, code: result.code })
        return
      }
      res.json({
        success: true,
        status: result.status,
        type: req.body.type,
        timestamp: req.body.timestamp,
      })
    }
  )

  app.post(
    '/api/health-sync/batch',
    authenticatePermanent,
    validate(BatchSyncBodySchema),
    createBatchGuardrails({
      maxItems: BATCH_MAX_ITEMS,
      maxBodyBytes: BATCH_MAX_BODY_MB * 1024 * 1024,
    }),
    async (req: Request, res: Response) => {
      const startedAt = Date.now()
      const summary = await batchSyncService.processBatch(req.body.items ?? [])

      info('Batch sync completed', {
        component: 'batch-sync',
        clientRequestId: req.body.clientRequestId ?? null,
        total: summary.total,
        inserted: summary.inserted,
        duplicates: summary.duplicates,
        failed: summary.failed,
        durationMs: Date.now() - startedAt,
      })

      res.json(buildBatchSyncResponse(summary))
    }
  )

  app.post('/admin/cleanup/preview', authenticateAdmin, async (req: Request, res: Response) => {
    try {
      res.json(await previewCleanup(req.body ?? {}, HEALTH_DATA_FILE))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      res.status(400).json({ error: message })
    }
  })

  app.post('/admin/cleanup/execute', authenticateAdmin, async (req: Request, res: Response) => {
    try {
      if (req.body?.confirm !== true) {
        res.status(400).json({ error: 'confirm=true is required for execute' })
        return
      }
      res.json(await executeCleanup(req.body ?? {}, HEALTH_DATA_FILE))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      res.status(400).json({ error: message })
    }
  })

  app.get('/admin/device-info', async (_req: Request, res: Response) => {
    const config = await loadConfig()
    if (!config.device) {
      res.json({ paired: false })
      return
    }

    const hasToken = await credentialService.hasDeviceToken()
    const device = config.device as {
      deviceInfo?: unknown
      pairedAt?: string
      lastSync?: string | null
    }
    const response = {
      paired: true,
      deviceInfo: device.deviceInfo,
      pairedAt: device.pairedAt,
      lastSync: device.lastSync,
      tokenStored: hasToken,
    }

    res.json(response)
  })

  const start = () => {
    return app.listen(PORT, () => info('Server started', { component: 'healthclaw', port: PORT }))
  }

  app.locals['dedupeRepository'] = dedupeRepository
  app.locals['paths'] = {
    healthDataFile: HEALTH_DATA_FILE,
    configFile: CONFIG_FILE,
    dedupeDbPath: DEDUPE_DB_PATH,
  }

  app.start = start
  app.dedupeRepository = dedupeRepository
  app.paths = {
    CONFIG_FILE,
    HEALTH_DATA_FILE,
    DEDUPE_DB_PATH,
    healthDataFile: HEALTH_DATA_FILE,
    configFile: CONFIG_FILE,
    dedupeDbPath: DEDUPE_DB_PATH,
  }

  return app
}

// Entry point when run directly
if (require.main === module) {
  createApp()
    .then((app) => {
      app.start()
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      logError('Failed to start server', { component: 'healthclaw', error: message })
      process.exit(1)
    })
}

export default createApp
