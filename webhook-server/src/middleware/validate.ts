import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'

export function validate<T>(
  schema: ZodSchema<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      res.status(400).json({ errors: result.error.flatten() })
      return
    }

    req.body = result.data
    next()
  }
}
