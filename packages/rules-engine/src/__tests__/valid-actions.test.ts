import { describe, it, expect } from 'vitest'
import { getValidActions } from '../valid-actions'
import type { CombatState, ActorState, AbilityDefinition } from 'shared-types'

const strikeAbility: AbilityDefinition = {
  id: 'strike', name: 'Strike', energyCost: 2,
  diceNotation: { kind: 'notation', value: '1d8' },
  targetType: 'enemy', effect: 'damage', context: 'inCombat',
}

const healAbility: AbilityDefinition = {
  id: 'heal', name: 'Heal', energyCost: 3,
  diceNotation: { kind: 'notation', value: '1d6' },
  targetType: 'ally', effect: 'heal', context: 'inCombat',
}

const oocAbility: AbilityDefinition = {
  id: 'read', name: 'Read', energyCost: 0,
  diceNotation: { kind: 'notation', value: '1d6' },
  targetType: 'self', effect: 'buff', context: 'outOfCombat',
}

const makeActor = (id: string, overrides: Partial<ActorState> = {}): ActorState => ({
  id, name: id, personality: 'calculating', characterClass: 'fighter', die: 'd8',
  hp: 20, maxHp: 20, energy: 5, maxEnergy: 5, speed: 2,
  position: { x: 0, y: 0 }, statusEffects: [], isNPC: false, abilities: [],
  ...overrides,
})

const makeState = (actors: Record<string, ActorState>): CombatState => ({
  roomId: 'r1',
  phases: [{ id: 'players', isPlayers: true, actorIds: Object.keys(actors), label: 'Players' }],
  currentPhaseIndex: 0,
  isPlayerTurn: true,
  actors, round: 1, log: [], isOver: false, activeEnemyIds: [],
})

describe('getValidActions', () => {
  it('always includes skip', () => {
    const state = makeState({ a1: makeActor('a1') })
    const actions = getValidActions('a1', state)
    expect(actions.some(a => a.type === 'skip')).toBe(true)
  })

  it('returns empty array for dead actor', () => {
    const state = makeState({ a1: makeActor('a1', { hp: 0 }) })
    expect(getValidActions('a1', state)).toEqual([])
  })

  it('generates move actions within speed range (Manhattan distance)', () => {
    const state = makeState({ a1: makeActor('a1', { speed: 1, position: { x: 5, y: 5 } }) })
    const moves = getValidActions('a1', state).filter(a => a.type === 'move')
    const destinations = moves.map(a => a.type === 'move' ? a.destination : null).filter(Boolean)
    // Speed 1: up/down/left/right (4 tiles)
    expect(destinations).toHaveLength(4)
    destinations.forEach(d => {
      const dist = Math.abs(d!.x - 5) + Math.abs(d!.y - 5)
      expect(dist).toBeLessThanOrEqual(1)
      expect(dist).toBeGreaterThan(0)
    })
  })

  it('excludes occupied tiles from move actions', () => {
    const a1 = makeActor('a1', { speed: 1, position: { x: 0, y: 0 } })
    const a2 = makeActor('a2', { position: { x: 1, y: 0 }, isNPC: true })
    const state = makeState({ a1, a2 })
    const moves = getValidActions('a1', state).filter(a => a.type === 'move')
    const destinations = moves.map(a => a.type === 'move' ? a.destination : null).filter(Boolean)
    expect(destinations.some(d => d!.x === 1 && d!.y === 0)).toBe(false)
  })

  it('includes ability actions when actor has enough energy and enemies exist', () => {
    const a1 = makeActor('a1', { abilities: [strikeAbility], energy: 5 })
    const a2 = makeActor('a2', { isNPC: true, position: { x: 1, y: 0 } })
    const state = makeState({ a1, a2 })
    const abilities = getValidActions('a1', state).filter(a => a.type === 'ability')
    expect(abilities.length).toBeGreaterThan(0)
    expect(abilities[0].type === 'ability' && abilities[0].ability?.id).toBe('strike')
    expect(abilities[0].type === 'ability' && abilities[0].targetIds).toContain('a2')
  })

  it('excludes ability when actor lacks energy', () => {
    const a1 = makeActor('a1', { abilities: [strikeAbility], energy: 1 }) // costs 2
    const a2 = makeActor('a2', { isNPC: true, position: { x: 1, y: 0 } })
    const state = makeState({ a1, a2 })
    const abilities = getValidActions('a1', state).filter(a => a.type === 'ability')
    expect(abilities).toHaveLength(0)
  })

  it('includes ability when both energy and cost are 0', () => {
    const freeAbility: AbilityDefinition = {
      id: 'taunt', name: 'Taunt', energyCost: 0,
      diceNotation: { kind: 'notation', value: '1d4' },
      targetType: 'enemy', effect: 'debuff', context: 'inCombat',
    }
    const a1 = makeActor('a1', { abilities: [freeAbility], energy: 0 })
    const a2 = makeActor('a2', { isNPC: true, position: { x: 1, y: 0 } })
    const state = makeState({ a1, a2 })
    const abilities = getValidActions('a1', state).filter(a => a.type === 'ability')
    expect(abilities.length).toBeGreaterThan(0)
  })

  it('excludes outOfCombat abilities', () => {
    const a1 = makeActor('a1', { abilities: [oocAbility], energy: 5 })
    const state = makeState({ a1 })
    const abilities = getValidActions('a1', state).filter(a => a.type === 'ability')
    expect(abilities).toHaveLength(0)
  })

  it('includes inGeneral abilities', () => {
    const inGeneralAbility: AbilityDefinition = {
      id: 'rally', name: 'Rally', energyCost: 1,
      diceNotation: { kind: 'notation', value: '1d4' },
      targetType: 'self', effect: 'buff', context: 'inGeneral',
    }
    const a1 = makeActor('a1', { abilities: [inGeneralAbility], energy: 5 })
    const state = makeState({ a1 })
    const abilities = getValidActions('a1', state).filter(a => a.type === 'ability')
    expect(abilities.length).toBeGreaterThan(0)
    expect(abilities[0].type === 'ability' && abilities[0].ability.id).toBe('rally')
  })

  it('targets allies with heal ability', () => {
    const a1 = makeActor('a1', { abilities: [healAbility], energy: 5, isNPC: false })
    const a2 = makeActor('a2', { isNPC: false, position: { x: 1, y: 0 } })
    const state = makeState({ a1, a2 })
    const abilities = getValidActions('a1', state).filter(a => a.type === 'ability')
    expect(abilities.some(a => a.type === 'ability' && a.targetIds.includes('a2'))).toBe(true)
  })
})
