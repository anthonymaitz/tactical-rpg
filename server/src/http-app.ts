// server/src/http-app.ts
import { Hono } from 'hono'
import { heroRoutes } from './routes/heroes'

export function createHttpApp(): Hono {
  const app = new Hono()
  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/heroes', heroRoutes)
  return app
}
