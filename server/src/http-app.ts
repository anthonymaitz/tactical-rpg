// server/src/http-app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { heroRoutes } from './routes/heroes'
import { contentRoutes } from './routes/content'
import { inventoryRoutes } from './routes/inventory'

export function createHttpApp(): Hono {
  const app = new Hono()
  app.use('*', cors({ origin: (origin) => origin?.startsWith('http://localhost:') ? origin : 'http://localhost:5173' }))
  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/heroes', heroRoutes)
  app.route('/content', contentRoutes)
  app.route('/inventory', inventoryRoutes)
  return app
}
