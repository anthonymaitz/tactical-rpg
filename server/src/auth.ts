import { SignJWT, jwtVerify } from 'jose'
import { sql } from './db/pg'

function secret(): Uint8Array {
  const s = process.env.AUTH_JWT_SECRET
  if (!s) throw new Error('AUTH_JWT_SECRET is not set')
  return new TextEncoder().encode(s)
}

async function issueToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret())
}

export async function signup(email: string, password: string): Promise<{ token: string; userId: string }> {
  const [existing] = await sql`select id from users where email = ${email}`
  if (existing) throw new Error('Email already registered')

  const passwordHash = await Bun.password.hash(password)
  const [user] = await sql<{ id: string }[]>`
    insert into users (email, password_hash) values (${email}, ${passwordHash})
    returning id
  `
  return { token: await issueToken(user.id), userId: user.id }
}

export async function login(email: string, password: string): Promise<{ token: string; userId: string }> {
  const [user] = await sql<{ id: string; password_hash: string }[]>`
    select id, password_hash from users where email = ${email}
  `
  if (!user || !(await Bun.password.verify(password, user.password_hash))) {
    throw new Error('Invalid email or password')
  }
  return { token: await issueToken(user.id), userId: user.id }
}

export async function verifyToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret())
  if (typeof payload.sub !== 'string') {
    throw new Error('JWT missing sub claim')
  }
  return payload.sub
}
