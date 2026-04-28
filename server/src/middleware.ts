import type { Context, Next } from 'hono'
import { verifySupabaseJWT } from './auth'

export async function authMiddleware(c: Context<{ Variables: { userId: string } }>, next: Next) {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const token = auth.slice(7)
  const projectUrl = process.env.SUPABASE_URL
  if (!projectUrl) return c.json({ error: 'Server misconfigured' }, 500)
  try {
    c.set('userId', await verifySupabaseJWT(token, projectUrl))
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
  await next()
}
