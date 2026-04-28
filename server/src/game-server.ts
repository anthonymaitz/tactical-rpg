import { Server } from '@colyseus/core'
import { BunWebSockets } from '@colyseus/bun-websockets'
import { ExploreRoom } from './rooms/ExploreRoom'
import { BiomeRoom } from './rooms/BiomeRoom'
import { TurnRoom } from './rooms/TurnRoom'
import { CombatRoom } from './rooms/CombatRoom'

export function createGameServer(): Server {
  const transport = new BunWebSockets()
  const server = new Server({ transport })

  server.define('ExploreRoom', ExploreRoom)
  server.define('BiomeRoom', BiomeRoom)
  server.define('TurnRoom', TurnRoom)
  server.define('CombatRoom', CombatRoom)

  return server
}
