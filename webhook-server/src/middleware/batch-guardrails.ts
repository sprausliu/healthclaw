import type { Request, Response, NextFunction } from 'express'

export interface BatchGuardrailsConfig {
  readonly maxItems: number
  readonly maxBodyBytes: number
}

export const createBatchGuardrails = (config: BatchGuardrailsConfig) => {
  return function batchGuardrails(req: Request, res: Response, next: NextFunction): void {
    const items = req.body?.items

    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items must be an array' })
      return
    }

    if (items.length < 1) {
      res.status(400).json({ error: 'items must contain at least one record' })
      return
    }

    if (items.length > config.maxItems) {
      res.status(400).json({
        error: 'Batch item limit exceeded',
        maxItems: config.maxItems,
      })
      return
    }

    const contentLength = Number(req.headers['content-length'] ?? 0)
    if (contentLength > config.maxBodyBytes) {
      res.status(413).json({
        error: 'Batch body size limit exceeded',
        maxBodyBytes: config.maxBodyBytes,
      })
      return
    }

    next()
  }
}
