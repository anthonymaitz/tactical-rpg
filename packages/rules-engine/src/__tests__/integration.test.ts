import { describe, it, expect } from 'vitest'
import { resolveAction, applyResult, getValidActions, decideNPCAction } from '../index'
import type { CombatState, ActorState, AbilityDefinition } from 'shared-types'

const strikeAbility: AbilityDefinition = {
  id: 'strike', name: 'Strike', energyCost: 2,
  diceNotation: { kind: 'notation', value: '1d8' },
  targetType: 'enemy', effect: 'damage', context: 'inCombat',
}

const makePlayer = (): ActorState => ({
  id: 'player', name: 'Hero', personality: 'passionate', characterClass: 'fighter', die: 'd8',
  hp: 20, maxHp: 20, energy: 5, maxEnergy: 5, speed: 3,
  position: { x: 0, y: 0 }, statusEffects: [], isNPC: false,
  abilities: [strikeAbility],
})

const makeNPC = (): ActorState => ({
  id: 'goblin', name: 'Goblin', personality: 'passionate', characterClass: 'fighter', die: 'd6',
  hp: 8, maxHp: 8, energy: 3, maxEnergy: 3, speed: 2,
  position: { x: 3, y: 0 }, statusEffects: [], isNPC: true,
  abilities: [{ ...strikeAbility, energyCost: 1 }],
})

function makeInitialState(): CombatState {
  const player = makePlayer()
  const goblin = makeNPC()
  return {
    roomId: 'integration-room',
    phases: [
      { id: 'players', isPlayers: true, actorIds: [player.id], label: 'Players' },
      { id: 'group-0', isPlayers: false, actorIds: [goblin.id], label: 'Goblin' },
    ],
    currentPhaseIndex: 0,
    isPlayerTurn: true,
    actors: { [player.id]: player, [goblin.id]: goblin },
    round: 1,
    log: [],
    isOver: false,
    activeEnemyIds: [],
  }
}

/** Restore each actor's energy to maxEnergy at the start of their turn (simulates per-turn regen). */
function regenEnergy(actorId: string, state: CombatState): CombatState {
  const a = state.actors[actorId]
  if (!a) return state
  return { ...state, actors: { ...state.actors, [actorId]: { ...a, energy: a.maxEnergy } } }
}

describe('full combat simulation', () => {
  it('runs to completion without throwing', () => {
    let state = makeInitialState()
    let iterations = 0
    const maxIterations = 100
    const actorIds = Object.keys(state.actors)
    let actorIndex = 0

    while (!state.isOver && iterations < maxIterations) {
      const actorId = actorIds[actorIndex % actorIds.length]
      state = regenEnergy(actorId, state)
      const actor = state.actors[actorId]

      let action
      if (actor.isNPC) {
        action = decideNPCAction(actorId, state)
      } else {
        const valid = getValidActions(actorId, state)
        action =
          valid.find(a => a.type === 'ability') ??
          valid.find(a => a.type === 'move') ??
          valid.find(a => a.type === 'skip')!
      }

      const result = resolveAction(actorId, action, state)
      state = applyResult(result, state)
      actorIndex++
      iterations++
    }

    expect(state.isOver).toBe(true)
    expect(state.winningSide).toMatch(/^(players|npcs)$/)
    expect(state.log.length).toBeGreaterThan(0)
  })

  it('log entries are non-empty strings', () => {
    let state = makeInitialState()
    const abilityAction = getValidActions('player', state).find(a => a.type === 'ability')!
    expect(abilityAction).toBeDefined()
    const result = resolveAction('player', abilityAction, state)
    state = applyResult(result, state)
    expect(state.log.every(entry => typeof entry === 'string' && entry.length > 0)).toBe(true)
  })

  it('hp never goes below 0 or above maxHp during simulation', () => {
    let state = makeInitialState()
    let iterations = 0
    const actorIds = Object.keys(state.actors)
    let actorIndex = 0

    while (!state.isOver && iterations < 100) {
      const actorId = actorIds[actorIndex % actorIds.length]
      state = regenEnergy(actorId, state)
      const actor = state.actors[actorId]
      const valid = getValidActions(actorId, state)
      const action = actor.isNPC
        ? decideNPCAction(actorId, state)
        : valid[0]

      const result = resolveAction(actorId, action, state)
      state = applyResult(result, state)
      actorIndex++

      for (const a of Object.values(state.actors)) {
        expect(a.hp).toBeGreaterThanOrEqual(0)
        expect(a.hp).toBeLessThanOrEqual(a.maxHp)
      }
      iterations++
    }

    expect(state.isOver).toBe(true)
  })
})
