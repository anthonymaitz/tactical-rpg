import { describe, it, expect } from 'vitest'
import { resolveAction, applyResult } from '../actions'
import type { CombatState, ActorState, Action, AbilityDefinition } from 'shared-types'

const makeActor = (overrides: Partial<ActorState> = {}): ActorState => ({
  id: 'actor-1',
  name: 'Test Actor',
  personality: 'calculating',
  characterClass: 'fighter',
  die: 'd8',
  hp: 20,
  maxHp: 20,
  energy: 5,
  maxEnergy: 5,
  speed: 3,
  position: { x: 0, y: 0 },
  statusEffects: [],
  isNPC: false,
  abilities: [],
  ...overrides,
})

const makeState = (actors: Record<string, ActorState>): CombatState => ({
  roomId: 'room-1',
  phases: [{ id: 'players', isPlayers: true, actorIds: Object.keys(actors), label: 'Players' }],
  currentPhaseIndex: 0,
  isPlayerTurn: true,
  actors,
  round: 1,
  log: [],
  isOver: false,
  activeEnemyIds: [],
})

const strikeAbility: AbilityDefinition = {
  id: 'strike',
  name: 'Strike',
  energyCost: 2,
  diceNotation: { kind: 'notation', value: '1d8' },
  targetType: 'enemy',
  effect: 'damage',
  context: 'inCombat',
}

const healAbility: AbilityDefinition = {
  id: 'heal',
  name: 'Heal',
  energyCost: 3,
  diceNotation: { kind: 'notation', value: '1d6' },
  targetType: 'ally',
  effect: 'heal',
  context: 'inCombat',
}

describe('resolveAction — skip', () => {
  it('returns empty deltas and logs the skip', () => {
    const state = makeState({ 'actor-1': makeActor() })
    const action: Action = { type: 'skip', actorId: 'actor-1' }
    const result = resolveAction('actor-1', action, state)
    expect(result.hpDeltas).toEqual({})
    expect(result.energyDeltas).toEqual({})
    expect(result.description).toContain('Test Actor')
  })
})

describe('resolveAction — move', () => {
  it('returns empty deltas and logs the move destination', () => {
    const state = makeState({ 'actor-1': makeActor() })
    const action: Action = { type: 'move', actorId: 'actor-1', destination: { x: 2, y: 1 } }
    const result = resolveAction('actor-1', action, state)
    expect(result.hpDeltas).toEqual({})
    expect(result.energyDeltas).toEqual({})
    expect(result.description).toMatch(/2.*1/)
  })
})

describe('resolveAction — ability (damage)', () => {
  it('rolls dice and assigns negative hp delta to target', () => {
    const attacker = makeActor({ id: 'actor-1', isNPC: false })
    const defender = makeActor({ id: 'actor-2', name: 'Enemy', isNPC: true, position: { x: 1, y: 0 } })
    const state = makeState({ 'actor-1': attacker, 'actor-2': defender })
    const action: Action = {
      type: 'ability',
      actorId: 'actor-1',
      ability: strikeAbility,
      targetIds: ['actor-2'],
    }
    const result = resolveAction('actor-1', action, state)
    expect(result.hpDeltas['actor-2']).toBeLessThan(0)
    expect(result.energyDeltas['actor-1']).toBe(-2)
    expect(result.rolls).toHaveLength(1)
    expect(result.rolls[0].total).toBeGreaterThanOrEqual(1)
  })

  it('substitutes actor die when diceNotation is { kind: "actor" }', () => {
    const actor = makeActor({ id: 'actor-1', die: 'd12' })
    const target = makeActor({ id: 'actor-2', isNPC: true, position: { x: 1, y: 0 } })
    const state = makeState({ 'actor-1': actor, 'actor-2': target })
    const actorDieAbility: AbilityDefinition = {
      ...strikeAbility,
      diceNotation: { kind: 'actor' },
    }
    const action: Action = {
      type: 'ability',
      actorId: 'actor-1',
      ability: actorDieAbility,
      targetIds: ['actor-2'],
    }
    const result = resolveAction('actor-1', action, state)
    expect(result.rolls[0].notation).toBe('1d12')
  })
})

describe('resolveAction — ability (heal)', () => {
  it('assigns positive hp delta to target', () => {
    const actor = makeActor({ id: 'actor-1' })
    const ally = makeActor({ id: 'actor-2', hp: 5, isNPC: false, position: { x: 1, y: 0 } })
    const state = makeState({ 'actor-1': actor, 'actor-2': ally })
    const action: Action = {
      type: 'ability',
      actorId: 'actor-1',
      ability: healAbility,
      targetIds: ['actor-2'],
    }
    const result = resolveAction('actor-1', action, state)
    expect(result.hpDeltas['actor-2']).toBeGreaterThan(0)
    expect(result.energyDeltas['actor-1']).toBe(-3)
  })
})

describe('applyResult', () => {
  it('clamps hp at 0 on lethal damage', () => {
    const defender = makeActor({ id: 'actor-2', hp: 5, isNPC: true, position: { x: 1, y: 0 } })
    const state = makeState({ 'actor-1': makeActor(), 'actor-2': defender })
    const action: Action = { type: 'ability', actorId: 'actor-1', ability: strikeAbility, targetIds: ['actor-2'] }
    const result = resolveAction('actor-1', action, state)
    const lethalResult = { ...result, hpDeltas: { 'actor-2': -999 } }
    const next = applyResult(lethalResult, state)
    expect(next.actors['actor-2'].hp).toBe(0)
  })

  it('clamps hp at maxHp on over-heal', () => {
    const actor = makeActor({ id: 'actor-1', hp: 18, maxHp: 20 })
    const state = makeState({ 'actor-1': actor })
    const result = {
      action: { type: 'ability' as const, actorId: 'actor-1', targetIds: ['actor-1'], ability: healAbility },
      rolls: [],
      hpDeltas: { 'actor-1': 50 },
      energyDeltas: {},
      statusEffectsApplied: {},
      description: 'healed',
    }
    const next = applyResult(result, state)
    expect(next.actors['actor-1'].hp).toBe(20)
  })

  it('marks isOver and sets winningSide when all NPCs die', () => {
    const player = makeActor({ id: 'p1', isNPC: false })
    const npc = makeActor({ id: 'n1', isNPC: true, hp: 1 })
    const state = makeState({ p1: player, n1: npc })
    const result = {
      action: { type: 'ability' as const, actorId: 'p1', targetIds: ['n1'], ability: strikeAbility },
      rolls: [],
      hpDeltas: { n1: -999 },
      energyDeltas: {},
      statusEffectsApplied: {},
      description: 'lethal blow',
    }
    const next = applyResult(result, state)
    expect(next.isOver).toBe(true)
    expect(next.winningSide).toBe('players')
  })

  it('applies status effects to targets', () => {
    const actor = makeActor({ id: 'a1' })
    const target = makeActor({ id: 'a2', isNPC: true, position: { x: 1, y: 0 } })
    const state = makeState({ a1: actor, a2: target })
    const result = {
      action: { type: 'ability' as const, actorId: 'a1', targetIds: ['a2'], ability: strikeAbility },
      rolls: [],
      hpDeltas: {},
      energyDeltas: {},
      statusEffectsApplied: { a2: ['feared'] },
      description: 'feared',
    }
    const next = applyResult(result, state)
    expect(next.actors['a2'].statusEffects).toContain('feared')
  })

  it('updates actor position on move', () => {
    const actor = makeActor({ id: 'a1', position: { x: 0, y: 0 } })
    const state = makeState({ a1: actor })
    const result = {
      action: { type: 'move' as const, actorId: 'a1', destination: { x: 2, y: 3 } },
      rolls: [],
      hpDeltas: {},
      energyDeltas: {},
      statusEffectsApplied: {},
      description: 'moved',
    }
    const next = applyResult(result, state)
    expect(next.actors['a1'].position).toEqual({ x: 2, y: 3 })
  })

  it('does not set isOver when there are no NPC actors', () => {
    const player = makeActor({ id: 'p1', isNPC: false })
    const state = makeState({ p1: player })
    const result = {
      action: { type: 'skip' as const, actorId: 'p1' },
      rolls: [],
      hpDeltas: {},
      energyDeltas: {},
      statusEffectsApplied: {},
      description: 'skipped',
    }
    const next = applyResult(result, state)
    expect(next.isOver).toBe(false)
    expect(next.winningSide).toBeUndefined()
  })

  it('appends description to log', () => {
    const state = makeState({ a1: makeActor({ id: 'a1' }) })
    const result = {
      action: { type: 'skip' as const, actorId: 'a1' },
      rolls: [],
      hpDeltas: {},
      energyDeltas: {},
      statusEffectsApplied: {},
      description: 'skipped their turn',
    }
    const next = applyResult(result, state)
    expect(next.log).toContain('skipped their turn')
  })
})
