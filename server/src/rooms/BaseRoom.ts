import { Room } from '@colyseus/core'
import { verifyToken } from '../auth'

export abstract class BaseRoom<State extends object = any> extends Room<State> {
  protected async verifyToken(token: string | undefined): Promise<string> {
    if (!token) throw new Error('Missing auth token')
    return verifyToken(token)
  }
}
