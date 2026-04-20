import { Server } from '@colyseus/core'
import { BunWebSockets } from '@colyseus/bun-websockets'

export function createGameServer(): Server {
  const transport = new BunWebSockets()
  return new Server({ transport })
}
