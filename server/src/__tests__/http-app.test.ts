import { describe, it, expect, vi } from 'vitest'

process.env.AUTH_JWT_SECRET ??= 'test-secret-do-not-use-in-prod'

vi.mock('../db/pg', () => {
  const sql = vi.fn(() => Promise.resolve([])) as unknown as { (): Promise<unknown[]>; json: (v: unknown) => unknown }
  sql.json = (v: unknown) => v
  return { sql }
})

import { createHttpApp } from '../http-app'

describe('HTTP app', () => {
  it('GET /health returns 200 with { status: "ok" }', async () => {
    const app = createHttpApp()
    const res = await app.request('/health')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'ok' })
  })

  it('unknown routes return 404', async () => {
    const app = createHttpApp()
    const res = await app.request('/not-a-route')
    expect(res.status).toBe(404)
  })
})
