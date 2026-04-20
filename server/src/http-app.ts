// server/src/http-app.ts
import { Hono } from 'hono'
import { heroRoutes } from './routes/heroes'

export const httpApp = new Hono()

httpApp.get('/health', (c) => c.json({ status: 'ok' }))
httpApp.route('/heroes', heroRoutes)

// Backward-compatible factory for index.ts and tests
export function createHttpApp(): Hono {
  const app = new Hono()
  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/heroes', heroRoutes)
  return app
}
