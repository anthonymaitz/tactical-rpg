import type { Client } from '@colyseus/core'
import { TurnRoom } from './TurnRoom'
import { buildCombatOverPayload } from './logic/combat-logic'
import type { Action } from 'shared-types'

const TURN_TIMEOUT_MS = 30_000

interface JoinRequestMessage {
  characterId: string
}

export class CombatRoom extends TurnRoom {
  private turnTimer: ReturnType<typeof setTimeout> | null = null

  onCreate(options: Parameters<TurnRoom['onCreate']>[0]): void {
    super.onCreate(options)
    this.onMessage<JoinRequestMessage>('JOIN_REQUEST', (client, message) => {
      this.broadcast('JOIN_ACK', { characterId: message.characterId, sessionId: client.sessionId })
    })
  }

  onJoin(client: Client, options: unknown, auth?: { userId: string }): void {
    super.onJoin(client, options, auth)
    this.scheduleTurnTimer()
  }

  onLeave(_client: Client): void {
    this.clearTurnTimer()
  }

  protected override handlePlayerAction(client: Client, action: Action): void {
    this.clearTurnTimer()
    super.handlePlayerAction(client, action)
    if (this.combatState.isOver) {
      this.broadcast('COMBAT_OVER', buildCombatOverPayload(this.combatState))
      void this.disconnect()
    } else {
      this.scheduleTurnTimer()
    }
  }

  private scheduleTurnTimer(): void {
    this.clearTurnTimer()
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null
      this.autoSkipCurrentActor()
    }, TURN_TIMEOUT_MS)
  }

  private clearTurnTimer(): void {
    if (this.turnTimer !== null) {
      clearTimeout(this.turnTimer)
      this.turnTimer = null
    }
  }

  private autoSkipCurrentActor(): void {
    const currentActorId = this.combatState.turnQueue[this.combatState.currentActorIndex]
    const skipAction: Action = { type: 'skip', actorId: currentActorId }
    this.handlePlayerAction({ sessionId: 'server' } as Client, skipAction)
  }
}
