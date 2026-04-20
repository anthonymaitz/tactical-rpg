import { Server } from '@colyseus/core'
import { BunWebSockets } from '@colyseus/bun-websockets'
import { ExploreRoom } from './rooms/ExploreRoom'
import { TurnRoom } from './rooms/TurnRoom'
import { CombatRoom } from './rooms/CombatRoom'

export function createGameServer(): Server {
  const transport = new BunWebSockets()
  const server = new Server({ transport })

  server.define('explore', ExploreRoom)
  server.define('turn', TurnRoom)
  server.define('combat', CombatRoom)

  return server
}
