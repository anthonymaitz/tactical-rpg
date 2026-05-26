import { Server } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { ExploreRoom } from './rooms/ExploreRoom'
import { BiomeRoom } from './rooms/BiomeRoom'

export function createGameServer(): Server {
  const transport = new WebSocketTransport()
  const server = new Server({ transport })

  server.define('ExploreRoom', ExploreRoom)
  server.define('BiomeRoom', BiomeRoom)

  return server
}
