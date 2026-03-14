import { Router, type Request, type Response } from 'express'
import type { UserRegistry } from '../persistence/user-registry'
import { authenticateAdmin } from '../middleware/auth-admin'

export const createAdminUsersRouter = (userRegistry: UserRegistry): Router => {
  const router = Router()

  router.post('/users', authenticateAdmin, async (req: Request, res: Response) => {
    const name: unknown = req.body?.name
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required and must be a string' })
      return
    }

    const result = await userRegistry.createUser(name)
    const users = await userRegistry.listUsers()
    const user = users.find((u) => u.id === result.userId)

    res.status(201).json({
      userId: result.userId,
      token: result.token,
      name: user?.name ?? name,
      createdAt: user?.createdAt ?? new Date().toISOString(),
    })
  })

  router.get('/users', authenticateAdmin, async (_req: Request, res: Response) => {
    const users = await userRegistry.listUsers()
    res.json(
      users.map((u) => ({
        userId: u.id,
        name: u.name,
        createdAt: u.createdAt,
      }))
    )
  })

  return router
}
