import type { Request, Response, NextFunction } from 'express'
import type { UserRegistry } from '../persistence/user-registry'
import type { CredentialService } from '../persistence/credential-service'
import { error as logError } from '../logger'

declare global {
  namespace Express {
    interface Request {
      user?: { readonly id: string }
    }
  }
}

export interface ResolveUserDeps {
  readonly userRegistry: UserRegistry
  readonly credentialService: CredentialService
}

export const createResolveUser = (deps: ResolveUserDeps) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers['x-api-token'] as string | undefined
    if (!token) {
      res.status(401).json({ error: 'Missing API token' })
      return
    }

    try {
      // Try multi-user registry lookup first
      const user = await deps.userRegistry.findByToken(token)
      if (user) {
        req.user = { id: user.id }
        next()
        return
      }

      // Fallback to legacy single-user verification
      const isValid = await deps.credentialService.verifyToken(token)
      if (isValid) {
        next()
        return
      }

      res.status(401).json({ error: 'Invalid or expired token' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logError('User resolution failed', { component: 'resolve-user', error: message })
      res.status(500).json({ error: 'Authentication system error' })
    }
  }
}
