// server/src/http-app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { heroRoutes } from './routes/heroes'

export function createHttpApp(): Hono {
  const app = new Hono()
  app.use('*', cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }))
  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/heroes', heroRoutes)
  return app
}
