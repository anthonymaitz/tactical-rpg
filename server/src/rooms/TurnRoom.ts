import type { Client } from '@colyseus/core'
import { BaseRoom } from './BaseRoom'
import { decideNPCAction, resolveAction, applyResult } from 'rules-engine'
import { rollInitiativeOrder, advanceTurn } from './logic/turn-logic'
import type { CombatState, ActorState, Action } from 'shared-types'

interface TurnRoomOptions {
  actors: ActorState[]
  roomId: string
}

interface PlayerActionMessage {
  action: Action
}

export class TurnRoom extends BaseRoom<object> {
  protected combatState!: CombatState

  onCreate(options: TurnRoomOptions): void {
    this.setState({})
    const turnQueue = rollInitiativeOrder(options.actors)
    const actors: Record<string, ActorState> = {}
    for (const actor of options.actors) {
      actors[actor.id] = actor
    }
    this.combatState = {
      roomId: options.roomId,
      turnQueue,
      currentActorIndex: 0,
      actors,
      round: 1,
      log: [],
      isOver: false,
      activeEnemyIds: [],
    }
    this.onMessage<PlayerActionMessage>('PLAYER_ACTION', (client, message) => {
      this.handlePlayerAction(client, message.action)
    })
  }

  onJoin(_client: Client, _options: unknown, _auth?: { userId: string }): void {
    this.broadcastState()
  }

  protected broadcastState(): void {
    this.broadcast('STATE_UPDATE', this.combatState)
  }

  protected handlePlayerAction(_client: Client, action: Action): void {
    const currentActorId = this.combatState.turnQueue[this.combatState.currentActorIndex]
    const actor = this.combatState.actors[currentActorId]
    if (!actor || actor.isNPC) return

    const result = resolveAction(currentActorId, action, this.combatState)
    this.combatState = applyResult(result, this.combatState)
    this.broadcast('ACTION_RESULT', result)

    if (this.combatState.isOver) {
      this.broadcastState()
      return
    }

    this.combatState.currentActorIndex = advanceTurn(
      this.combatState.turnQueue,
      this.combatState.currentActorIndex,
    )
    this.processNPCTurns()
    this.broadcastState()
  }

  protected processNPCTurns(): void {
    let safetyLimit = this.combatState.turnQueue.length * 2
    while (safetyLimit-- > 0) {
      const currentActorId = this.combatState.turnQueue[this.combatState.currentActorIndex]
      const actor = this.combatState.actors[currentActorId]
      if (!actor || !actor.isNPC) break

      const action = decideNPCAction(currentActorId, this.combatState)
      const result = resolveAction(currentActorId, action, this.combatState)
      this.combatState = applyResult(result, this.combatState)
      this.broadcast('ACTION_RESULT', result)

      if (this.combatState.isOver) break

      this.combatState.currentActorIndex = advanceTurn(
        this.combatState.turnQueue,
        this.combatState.currentActorIndex,
      )
    }
  }
}
