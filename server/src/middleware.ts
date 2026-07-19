import type { Context, Next } from 'hono'
import { verifyToken } from './auth'

export async function authMiddleware(c: Context<{ Variables: { userId: string } }>, next: Next) {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const token = auth.slice(7)
  try {
    c.set('userId', await verifyToken(token))
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
  await next()
}
