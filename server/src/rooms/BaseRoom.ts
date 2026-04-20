import { Room } from '@colyseus/core'
import type { IncomingMessage } from 'http'
import { verifySupabaseJWT } from '../auth'

export abstract class BaseRoom<State extends object = any> extends Room<State> {
  static async onAuth(token: string, _req: IncomingMessage): Promise<{ userId: string }> {
    const secret = process.env.SUPABASE_JWT_SECRET
    if (!secret) {
      throw new Error('SUPABASE_JWT_SECRET is not set')
    }
    const userId = await verifySupabaseJWT(token, secret)
    return { userId }
  }
}
