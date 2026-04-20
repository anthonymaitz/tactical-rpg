import { describe, it, expect } from 'vitest'
import { rollInitiativeOrder, advanceTurn } from '../rooms/logic/turn-logic'
import type { ActorState } from 'shared-types'

function makeActor(id: string, speed: number): ActorState {
  return {
    id,
    name: id,
    personality: 'calculating',
    characterClass: 'warrior',
    die: 'd6',
    hp: 10,
    maxHp: 10,
    energy: 4,
    maxEnergy: 4,
    speed,
    position: { x: 0, y: 0 },
    statusEffects: [],
    isNPC: false,
    abilities: [],
  }
}

describe('rollInitiativeOrder', () => {
  it('returns all actor ids sorted by speed descending', () => {
    const actors = [makeActor('slow', 2), makeActor('fast', 5), makeActor('mid', 3)]
    const result = rollInitiativeOrder(actors)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('fast')
    expect(result[1]).toBe('mid')
    expect(result[2]).toBe('slow')
  })

  it('handles a single actor', () => {
    const result = rollInitiativeOrder([makeActor('solo', 3)])
    expect(result).toEqual(['solo'])
  })

  it('returns empty array for no actors', () => {
    expect(rollInitiativeOrder([])).toEqual([])
  })
})

describe('advanceTurn', () => {
  it('increments index within queue', () => {
    expect(advanceTurn(['a', 'b', 'c'], 0)).toBe(1)
    expect(advanceTurn(['a', 'b', 'c'], 1)).toBe(2)
  })

  it('wraps to 0 at end of queue', () => {
    expect(advanceTurn(['a', 'b', 'c'], 2)).toBe(0)
  })
})
