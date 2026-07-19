import { Hono } from 'hono'
import { signup, login } from '../auth'

export const authRoutes = new Hono()

// POST /auth/signup — Body: { email, password }
authRoutes.post('/signup', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>()
  if (!body.email || !body.password) return c.json({ error: 'email and password are required' }, 400)
  if (body.password.length < 8) return c.json({ error: 'password must be at least 8 characters' }, 400)
  try {
    const { token, userId } = await signup(body.email, body.password)
    return c.json({ token, userId }, 201)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Signup failed' }, 400)
  }
})

// POST /auth/login — Body: { email, password }
authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>()
  if (!body.email || !body.password) return c.json({ error: 'email and password are required' }, 400)
  try {
    const { token, userId } = await login(body.email, body.password)
    return c.json({ token, userId })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Login failed' }, 401)
  }
})
