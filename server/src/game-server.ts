import { Server } from '@colyseus/core'
import { WsTransport } from '@colyseus/ws-transport'
import { ExploreRoom } from './rooms/ExploreRoom'
import { BiomeRoom } from './rooms/BiomeRoom'
import { TurnRoom } from './rooms/TurnRoom'
import { CombatRoom } from './rooms/CombatRoom'

export function createGameServer(): Server {
  const transport = new WsTransport()
  const server = new Server({ transport })

  server.define('ExploreRoom', ExploreRoom)
  server.define('BiomeRoom', BiomeRoom)
  server.define('TurnRoom', TurnRoom)
  server.define('CombatRoom', CombatRoom)

  return server
}
