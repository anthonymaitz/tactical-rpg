import { Room } from '@colyseus/core'
import { verifySupabaseJWT } from '../auth'

export abstract class BaseRoom<State extends object = any> extends Room<State> {
  protected async verifyToken(token: string | undefined): Promise<string> {
    if (!token) throw new Error('Missing auth token')
    const projectUrl = process.env.SUPABASE_URL
    if (!projectUrl) throw new Error('SUPABASE_URL is not set')
    return verifySupabaseJWT(token, projectUrl)
  }
}
