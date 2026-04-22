import { describe, it, expect, beforeAll, vi } from 'vitest'
import { generateKeyPair, SignJWT, type KeyLike } from 'jose'

const mockGetKey = vi.fn()
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>()
  return { ...actual, createRemoteJWKSet: () => mockGetKey }
})

const { verifySupabaseJWT } = await import('../auth')

describe('verifySupabaseJWT', () => {
  let privateKey: KeyLike
  const userId = 'user-uuid-1234'
  const projectUrl = 'https://test.supabase.co'

  beforeAll(async () => {
    const pair = await generateKeyPair('ES256')
    privateKey = pair.privateKey
    mockGetKey.mockResolvedValue(pair.publicKey)
  })

  async function signToken(payload: Record<string, unknown>, key?: KeyLike) {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key ?? privateKey)
  }

  it('returns userId for a valid token', async () => {
    const token = await signToken({ sub: userId, aud: 'authenticated' })
    expect(await verifySupabaseJWT(token, projectUrl)).toBe(userId)
  })

  it('throws for an expired token', async () => {
    const token = await new SignJWT({ sub: userId, aud: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey)
    await expect(verifySupabaseJWT(token, projectUrl)).rejects.toThrow()
  })

  it('throws for a malformed token string', async () => {
    await expect(verifySupabaseJWT('not.a.jwt', projectUrl)).rejects.toThrow()
  })

  it('throws when sub claim is missing', async () => {
    const token = await signToken({ aud: 'authenticated' })
    await expect(verifySupabaseJWT(token, projectUrl)).rejects.toThrow()
  })
})
