import { describe, it, expect } from 'vitest'
import { buildCombatOverPayload } from '../rooms/logic/combat-logic'
import type { CombatState, ActorState } from 'shared-types'

function makeActor(id: string, hp: number, isNPC: boolean): ActorState {
  return {
    id,
    name: id,
    personality: 'calculating',
    characterClass: 'warrior',
    die: 'd6',
    hp,
    maxHp: 10,
    energy: 4,
    maxEnergy: 4,
    speed: 3,
    position: { x: 0, y: 0 },
    statusEffects: [],
    isNPC,
    abilities: [],
  }
}

function makeState(actors: ActorState[], winningSide?: 'players' | 'npcs'): CombatState {
  const actorMap: Record<string, ActorState> = {}
  for (const a of actors) actorMap[a.id] = a
  return {
    roomId: 'test-room',
    phases: [{ id: 'players', isPlayers: true, actorIds: actors.map(a => a.id), label: 'Players' }],
    currentPhaseIndex: 0,
    isPlayerTurn: true,
    actors: actorMap,
    round: 3,
    log: ['hit', 'miss'],
    isOver: true,
    winningSide,
    activeEnemyIds: [],
  }
}

describe('buildCombatOverPayload', () => {
  it('includes winningSide and log from CombatState', () => {
    const state = makeState([makeActor('p1', 5, false), makeActor('npc1', 0, true)], 'players')
    const payload = buildCombatOverPayload(state)
    expect(payload.winningSide).toBe('players')
    expect(payload.log).toEqual(['hit', 'miss'])
    expect(payload.round).toBe(3)
  })

  it('handles undefined winningSide (draw / incomplete)', () => {
    const state = makeState([makeActor('p1', 5, false)])
    const payload = buildCombatOverPayload(state)
    expect(payload.winningSide).toBeUndefined()
  })
})
