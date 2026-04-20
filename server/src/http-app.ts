import { Hono } from 'hono'

export function createHttpApp(): Hono {
  const app = new Hono()
  app.get('/health', (c) => c.json({ status: 'ok' }))
  return app
}
