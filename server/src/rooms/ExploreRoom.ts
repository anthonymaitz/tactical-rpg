import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition } from '../schemas/ExploreState'
import { BaseRoom } from './BaseRoom'
import { isValidMove } from './logic/explore-logic'
import type { Position } from 'shared-types'

interface MoveMessage {
  characterId: string
  destination: Position
  speed: number
}

export class ExploreRoom extends BaseRoom<ExploreState> {
  onCreate(): void {
    this.setState(new ExploreState())
    this.onMessage<MoveMessage>('MOVE', (client, message) => {
      this.handleMove(client, message)
    })
  }

  onJoin(client: Client, options: { token?: string; heroIds?: string[] }, auth?: { userId: string }): void {
    const pos = new PlayerPosition()
    pos.x = 0
    pos.y = 0
    pos.characterId = auth?.userId ?? client.sessionId
    this.state.players.set(client.sessionId, pos)
    client.userData = { ...(client.userData ?? {}), heroIds: options.heroIds ?? [] }
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId)
  }

  private handleMove(client: Client, message: MoveMessage): void {
    const current = this.state.players.get(client.sessionId)
    if (!current) return

    const currentPos: Position = { x: current.x, y: current.y }
    if (!isValidMove(currentPos, message.destination, message.speed)) {
      client.send('MOVE_REJECTED', { reason: 'out_of_range' })
      return
    }

    current.x = message.destination.x
    current.y = message.destination.y
  }
}
