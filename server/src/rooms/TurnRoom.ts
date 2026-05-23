import type { Client } from '@colyseus/core'
import { BaseRoom } from './BaseRoom'
import { decideNPCAction, resolveAction, applyResult } from 'rules-engine'
import { rollInitiativeOrder } from './logic/turn-logic'
import type { CombatState, ActorState, Action, CombatPhase } from 'shared-types'

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
    const ordered = rollInitiativeOrder(options.actors)
    const actors: Record<string, ActorState> = {}
    for (const actor of options.actors) {
      actors[actor.id] = actor
    }
    // Build one phase per actor in initiative order
    const phases: CombatPhase[] = ordered.map((id) => ({
      id,
      isPlayers: !actors[id].isNPC,
      actorIds: [id],
      label: actors[id].name,
    }))
    this.combatState = {
      roomId: options.roomId,
      phases,
      currentPhaseIndex: 0,
      isPlayerTurn: phases[0]?.isPlayers ?? true,
      actors,
      round: 1,
      log: [],
      isOver: false,
      activeEnemyIds: options.actors.filter(a => a.isNPC).map(a => a.id),
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
    const phase = this.combatState.phases[this.combatState.currentPhaseIndex]
    const currentActorId = phase?.actorIds[0]
    const actor = currentActorId ? this.combatState.actors[currentActorId] : undefined
    if (!actor || actor.isNPC) return

    const result = resolveAction(currentActorId, action, this.combatState)
    this.combatState = applyResult(result, this.combatState)
    this.broadcast('ACTION_RESULT', result)

    if (this.combatState.isOver) {
      this.broadcastState()
      return
    }

    this.advancePhase()
    this.processNPCTurns()
    this.broadcastState()
  }

  protected processNPCTurns(): void {
    let safetyLimit = this.combatState.phases.length * 2
    while (safetyLimit-- > 0) {
      const phase = this.combatState.phases[this.combatState.currentPhaseIndex]
      const currentActorId = phase?.actorIds[0]
      const actor = currentActorId ? this.combatState.actors[currentActorId] : undefined
      if (!actor || !actor.isNPC) break

      const action = decideNPCAction(currentActorId, this.combatState)
      const result = resolveAction(currentActorId, action, this.combatState)
      this.combatState = applyResult(result, this.combatState)
      this.broadcast('ACTION_RESULT', result)

      if (this.combatState.isOver) break

      this.advancePhase()
    }
  }

  private advancePhase(): void {
    const total = this.combatState.phases.length
    const next = (this.combatState.currentPhaseIndex + 1) % total
    const newRound = next === 0
    this.combatState = {
      ...this.combatState,
      currentPhaseIndex: next,
      isPlayerTurn: this.combatState.phases[next]?.isPlayers ?? false,
      round: newRound ? this.combatState.round + 1 : this.combatState.round,
    }
  }
}
