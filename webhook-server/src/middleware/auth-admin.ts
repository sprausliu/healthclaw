import type { Request, Response, NextFunction } from 'express'

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const expected = process.env['ADMIN_TOKEN']
  const token = req.headers['x-admin-token']

  if (!expected) {
    res.status(500).json({ error: 'Admin token is not configured' })
    return
  }

  if (!token || token !== expected) {
    res.status(401).json({ error: 'Unauthorized admin request' })
    return
  }

  next()
}
