import { Server } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { ExploreRoom } from './rooms/ExploreRoom'
import { BiomeRoom } from './rooms/BiomeRoom'
import { DungeonRoom } from './rooms/DungeonRoom'

export function createGameServer(): Server {
  const transport = new WebSocketTransport()
  const server = new Server({ transport })

  server.define('ExploreRoom', ExploreRoom)
  server.define('BiomeRoom', BiomeRoom)
  server.define('DungeonRoom', DungeonRoom)

  return server
}
