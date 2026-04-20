import { describe, it, expect } from 'vitest'
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
