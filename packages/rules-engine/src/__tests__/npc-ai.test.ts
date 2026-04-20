import { describe, it, expect } from 'vitest'
import { decideNPCAction } from '../npc-ai'
import type { CombatState, ActorState, AbilityDefinition } from 'shared-types'

const strikeAbility: AbilityDefinition = {
  id: 'strike', name: 'Strike', energyCost: 2,
  diceNotation: { kind: 'notation', value: '1d8' },
  targetType: 'enemy', effect: 'damage', context: 'inCombat',
}
const healAbility: AbilityDefinition = {
  id: 'heal', name: 'Heal', energyCost: 2,
  diceNotation: { kind: 'notation', value: '1d6' },
  targetType: 'self', effect: 'heal', context: 'inCombat',
}

const makeActor = (id: string, o: Partial<ActorState> = {}): ActorState => ({
  id, name: id, personality: 'calculating', characterClass: 'fighter', die: 'd8',
  hp: 20, maxHp: 20, energy: 5, maxEnergy: 5, speed: 2,
  position: { x: 0, y: 0 }, statusEffects: [], isNPC: true, abilities: [],
  ...o,
})

const makeState = (actors: Record<string, ActorState>): CombatState => ({
  roomId: 'r1', turnQueue: Object.keys(actors), currentActorIndex: 0,
  actors, round: 1, log: [], isOver: false,
})

describe('decideNPCAction', () => {
  it('returns skip when NPC is dead', () => {
    const state = makeState({ n1: makeActor('n1', { hp: 0 }) })
    expect(decideNPCAction('n1', state).type).toBe('skip')
  })

  it('passionate NPC uses ability when available', () => {
    const npc = makeActor('n1', { personality: 'passionate', abilities: [strikeAbility] })
    const player = makeActor('p1', { isNPC: false, position: { x: 3, y: 0 } })
    const state = makeState({ n1: npc, p1: player })
    const action = decideNPCAction('n1', state)
    expect(action.type).toBe('ability')
  })

  it('passionate NPC moves toward enemy when no ability available', () => {
    const npc = makeActor('n1', { personality: 'passionate', position: { x: 0, y: 0 }, speed: 2 })
    const player = makeActor('p1', { isNPC: false, position: { x: 10, y: 0 } })
    const state = makeState({ n1: npc, p1: player })
    const action = decideNPCAction('n1', state)
    expect(action.type).toBe('move')
    // Should move closer to player (positive x direction)
    expect(action.type === 'move' && action.destination.x).toBeGreaterThan(0)
  })

  it('selfish NPC heals self when low HP', () => {
    const npc = makeActor('n1', {
      personality: 'selfish',
      hp: 4, maxHp: 20,
      abilities: [healAbility, strikeAbility],
    })
    const player = makeActor('p1', { isNPC: false, position: { x: 3, y: 0 } })
    const state = makeState({ n1: npc, p1: player })
    const action = decideNPCAction('n1', state)
    expect(action.type).toBe('ability')
    expect(action.type === 'ability' && action.ability.effect).toBe('heal')
  })

  it('wild NPC returns a valid action type', () => {
    const npc = makeActor('n1', { personality: 'wild', abilities: [strikeAbility] })
    const player = makeActor('p1', { isNPC: false, position: { x: 2, y: 0 } })
    const state = makeState({ n1: npc, p1: player })
    const action = decideNPCAction('n1', state)
    expect(['move', 'ability', 'skip']).toContain(action.type)
  })

  it('calculating NPC uses ability when available', () => {
    const npc = makeActor('n1', { personality: 'calculating', abilities: [strikeAbility] })
    const player = makeActor('p1', { isNPC: false, position: { x: 2, y: 0 } })
    const state = makeState({ n1: npc, p1: player })
    const action = decideNPCAction('n1', state)
    expect(action.type).toBe('ability')
  })

  it('righteous NPC heals ally before attacking', () => {
    const healAllyAbility: AbilityDefinition = {
      id: 'heal-ally', name: 'Heal Ally', energyCost: 2,
      diceNotation: { kind: 'notation', value: '1d6' },
      targetType: 'ally', effect: 'heal', context: 'inCombat',
    }
    const npc1 = makeActor('n1', {
      personality: 'righteous',
      abilities: [strikeAbility, healAllyAbility],
    })
    const npc2 = makeActor('n2', { isNPC: true, position: { x: 1, y: 0 } })
    const player = makeActor('p1', { isNPC: false, position: { x: 5, y: 0 } })
    const state = makeState({ n1: npc1, n2: npc2, p1: player })
    const action = decideNPCAction('n1', state)
    expect(action.type).toBe('ability')
    expect(action.type === 'ability' && action.ability.effect).toBe('heal')
    expect(action.type === 'ability' && action.targetIds).not.toContain('n1')
  })
})
