import { describe, it, expect, beforeAll } from 'vitest'
import { SignJWT } from 'jose'

process.env.AUTH_JWT_SECRET = 'test-secret-do-not-use-in-prod'
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test'

const { verifyToken } = await import('../auth')

describe('verifyToken', () => {
  const userId = 'user-uuid-1234'
  let secret: Uint8Array

  beforeAll(() => {
    secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET)
  })

  async function signToken(payload: Record<string, unknown>) {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret)
  }

  it('returns userId for a valid token', async () => {
    const token = await signToken({ sub: userId })
    expect(await verifyToken(token)).toBe(userId)
  })

  it('throws for an expired token', async () => {
    const token = await new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret)
    await expect(verifyToken(token)).rejects.toThrow()
  })

  it('throws for a malformed token string', async () => {
    await expect(verifyToken('not.a.jwt')).rejects.toThrow()
  })

  it('throws when sub claim is missing', async () => {
    const token = await signToken({})
    await expect(verifyToken(token)).rejects.toThrow()
  })

  it('throws for a token signed with the wrong secret', async () => {
    const wrongSecret = new TextEncoder().encode('a-different-secret')
    const token = await new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrongSecret)
    await expect(verifyToken(token)).rejects.toThrow()
  })
})
