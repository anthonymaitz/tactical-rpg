import { describe, it, expect, beforeAll } from 'vitest'
import { SignJWT } from 'jose'
import { verifySupabaseJWT } from '../auth'

const TEST_SECRET = 'super-secret-test-key-at-least-32-chars'

async function signTestJWT(payload: Record<string, unknown>): Promise<string> {
  const secret = new TextEncoder().encode(TEST_SECRET)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

describe('verifySupabaseJWT', () => {
  let validToken: string
  const userId = 'user-uuid-1234'

  beforeAll(async () => {
    validToken = await signTestJWT({
      sub: userId,
      aud: 'authenticated',
      role: 'authenticated',
    })
  })

  it('returns userId for a valid token', async () => {
    const result = await verifySupabaseJWT(validToken, TEST_SECRET)
    expect(result).toBe(userId)
  })

  it('throws for an expired token', async () => {
    const secret = new TextEncoder().encode(TEST_SECRET)
    const expiredToken = await new SignJWT({ sub: userId, aud: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret)
    await expect(verifySupabaseJWT(expiredToken, TEST_SECRET)).rejects.toThrow()
  })

  it('throws for a token signed with the wrong secret', async () => {
    const wrongToken = await signTestJWT({ sub: userId, aud: 'authenticated' })
    await expect(verifySupabaseJWT(wrongToken, 'wrong-secret-key-at-least-32-chars-x')).rejects.toThrow()
  })

  it('throws for a malformed token string', async () => {
    await expect(verifySupabaseJWT('not.a.jwt', TEST_SECRET)).rejects.toThrow()
  })
})
