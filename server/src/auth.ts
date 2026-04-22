import { jwtVerify, createRemoteJWKSet } from 'jose'

export async function verifySupabaseJWT(token: string, projectUrl: string): Promise<string> {
  const JWKS = createRemoteJWKSet(new URL(`${projectUrl}/auth/v1/.well-known/jwks.json`))
  const { payload } = await jwtVerify(token, JWKS, { audience: 'authenticated' })
  if (typeof payload.sub !== 'string') {
    throw new Error('JWT missing sub claim')
  }
  return payload.sub
}
