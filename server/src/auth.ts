import { jwtVerify } from 'jose'

export async function verifySupabaseJWT(token: string, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret)
  const { payload } = await jwtVerify(token, key, { audience: 'authenticated' })
  if (typeof payload.sub !== 'string') {
    throw new Error('JWT missing sub claim')
  }
  return payload.sub
}
