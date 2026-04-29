// server/src/http-app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { heroRoutes } from './routes/heroes'
import { contentRoutes } from './routes/content'
import { inventoryRoutes } from './routes/inventory'
import { debugRoutes } from './routes/debug'

export function createHttpApp(): Hono {
  const app = new Hono()
  app.use('*', cors({
    origin: (origin) => {
      if (!origin) return '*'
      if (origin.startsWith('http://localhost:')) return origin
      if (origin === 'https://anthony.maitz.work') return origin
      if (origin.endsWith('.railway.app')) return origin
      return null
    }
  }))
  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/heroes', heroRoutes)
  app.route('/content', contentRoutes)
  app.route('/inventory', inventoryRoutes)
  app.route('/debug', debugRoutes)
  return app
}
