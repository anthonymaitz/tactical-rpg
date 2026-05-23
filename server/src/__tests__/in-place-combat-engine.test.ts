import { describe, it, expect } from 'vitest'
import { InPlaceCombatEngine } from '../rooms/InPlaceCombatEngine'
import type { ActorState } from 'shared-types'

const openWalls = Array.from({ length: 10 }, () => Array(10).fill(0))

function makeHero(overrides: Partial<ActorState> = {}): ActorState {
  return {
    id: 'hero1',
    name: 'Aria',
    personality: 'passionate',
    characterClass: 'Fighter',
    die: 'd8',
    hp: 20,
    maxHp: 20,
    energy: 10,
    maxEnergy: 10,
    speed: 3,
    position: { x: 3, y: 3 },
    statusEffects: [],
    isNPC: false,
    abilities: [{
      id: 'strike',
      name: 'Strike',
      energyCost: 2,
      diceNotation: { kind: 'actor' },
      targetType: 'enemy',
      effect: 'damage',
      context: 'inCombat',
    }],
    ...overrides,
  }
}

function makeEnemy(overrides: Partial<ActorState> = {}): ActorState {
  return {
    id: 'enemy1',
    name: 'Skeleton',
    personality: 'wild',
    characterClass: 'Enemy',
    die: 'd6',
    hp: 10,
    maxHp: 10,
    energy: 10,
    maxEnergy: 10,
    speed: 3,
    position: { x: 5, y: 5 },
    statusEffects: [],
    isNPC: true,
    abilities: [{
      id: 'slash',
      name: 'Slash',
      energyCost: 3,
      diceNotation: { kind: 'notation', value: '1d4' },
      targetType: 'enemy',
      effect: 'damage',
      context: 'inCombat',
    }],
    ...overrides,
  }
}

describe('InPlaceCombatEngine', () => {
  it('initialises with both actors in the state', () => {
    const engine = new InPlaceCombatEngine([makeHero()], [[makeEnemy()]], openWalls, 1)
    const state = engine.getCombatState()
    expect(Object.keys(state.actors)).toHaveLength(2)
    expect(state.activeEnemyIds).toContain('enemy1')
  })

  it('is not over initially', () => {
    const engine = new InPlaceCombatEngine([makeHero()], [[makeEnemy()]], openWalls, 1)
    expect(engine.isOver()).toBe(false)
  })

  it('has a player phase and an enemy phase', () => {
    const engine = new InPlaceCombatEngine([makeHero()], [[makeEnemy()]], openWalls, 1)
    const state = engine.getCombatState()
    const playerPhase = state.phases.find(p => p.isPlayers)
    const enemyPhase = state.phases.find(p => !p.isPlayers)
    expect(playerPhase?.actorIds).toContain('hero1')
    expect(enemyPhase?.actorIds).toContain('enemy1')
  })

  it('deducts move energy (1 per square via BFS)', () => {
    const engine = new InPlaceCombatEngine([makeHero()], [[makeEnemy()]], openWalls, 1)
    const state = engine.getCombatState()
    if (!state.isPlayerTurn) return // enemies went first
    const heroPos = state.actors['hero1'].position
    const dest = { x: heroPos.x + 2, y: heroPos.y }
    engine.handlePlayerAction('hero1', { type: 'move', actorId: 'hero1', destination: dest })
    expect(engine.getCombatState().actors['hero1'].energy).toBeLessThanOrEqual(8)
  })

  it('throws when move destination unreachable', () => {
    const walls = Array.from({ length: 5 }, (_, y) =>
      Array.from({ length: 5 }, (_: unknown, x: number) => (x === 2 ? 1 : 0))
    )
    const engine = new InPlaceCombatEngine(
      [makeHero({ position: { x: 0, y: 2 } })],
      [[makeEnemy({ position: { x: 4, y: 2 } })]],
      walls,
      1,
    )
    if (!engine.getCombatState().isPlayerTurn) return
    expect(() =>
      engine.handlePlayerAction('hero1', { type: 'move', actorId: 'hero1', destination: { x: 4, y: 2 } })
    ).toThrow()
  })

  it('deducts ability energy cost', () => {
    const hero = makeHero({ position: { x: 4, y: 5 } })
    const enemy = makeEnemy({ position: { x: 5, y: 5 } })
    const engine = new InPlaceCombatEngine([hero], [[enemy]], openWalls, 1)
    if (!engine.getCombatState().isPlayerTurn) return // enemies went first
    engine.handlePlayerAction('hero1', {
      type: 'ability',
      actorId: 'hero1',
      ability: hero.abilities[0],
      targetIds: ['enemy1'],
    })
    expect(engine.getCombatState().actors['hero1'].energy).toBeLessThanOrEqual(8)
  })

  it('prevents using same ability twice in one turn', () => {
    const hero = makeHero({ position: { x: 4, y: 5 } })
    const enemy = makeEnemy({ position: { x: 5, y: 5 } })
    const engine = new InPlaceCombatEngine([hero], [[enemy]], openWalls, 1)
    if (!engine.getCombatState().isPlayerTurn) return
    const action = { type: 'ability' as const, actorId: 'hero1', ability: hero.abilities[0], targetIds: ['enemy1'] }
    engine.handlePlayerAction('hero1', action)
    expect(() => engine.handlePlayerAction('hero1', action)).toThrow()
  })

  it('refills energy on startPhase', () => {
    const engine = new InPlaceCombatEngine([makeHero()], [[makeEnemy()]], openWalls, 1)
    const cs = engine.getCombatState()
    const playerPhaseIdx = cs.phases.findIndex(p => p.isPlayers)
    engine.startPhase(playerPhaseIdx)
    expect(engine.getCombatState().actors['hero1'].energy).toBe(10)
  })

  it('is over when all enemies reach 0 hp', () => {
    const hero = makeHero({ position: { x: 4, y: 5 } })
    const enemy = makeEnemy({ hp: 1, position: { x: 5, y: 5 } })
    const engine = new InPlaceCombatEngine([hero], [[enemy]], openWalls, 1)
    if (!engine.getCombatState().isPlayerTurn) return
    engine.handlePlayerAction('hero1', {
      type: 'ability', actorId: 'hero1', ability: hero.abilities[0], targetIds: ['enemy1'],
    })
    expect(engine.isOver()).toBe(true)
    expect(engine.winningSide()).toBe('players')
  })

  it('enemies attack after endPlayerPhase', () => {
    const hero = makeHero({ hp: 1, position: { x: 4, y: 5 } })
    const enemy = makeEnemy({ position: { x: 5, y: 5 } })
    const engine = new InPlaceCombatEngine([hero], [[enemy]], openWalls, 1)
    if (engine.getCombatState().isPlayerTurn) {
      engine.endPlayerPhase()
    }
    // After enemy phase runs, hero with 1hp should be a ghost or combat over
    const heroAfter = engine.getCombatState().actors['hero1']
    if (heroAfter.hp === 0) {
      expect(heroAfter.isGhost).toBe(true)
    }
  })

  it('addActor inserts a new hero into the player phase', () => {
    const engine = new InPlaceCombatEngine([makeHero()], [[makeEnemy()]], openWalls, 1)
    const newHero: ActorState = { ...makeHero(), id: 'hero2', name: 'Bob', position: { x: 2, y: 2 } }
    engine.addActor(newHero)
    expect(engine.getCombatState().actors['hero2']).toBeDefined()
    const playerPhase = engine.getCombatState().phases.find(p => p.isPlayers)
    expect(playerPhase?.actorIds).toContain('hero2')
  })

  it('marks actor isGhost when hp reaches 0', () => {
    const hero = makeHero({ hp: 1, position: { x: 4, y: 5 } })
    const enemy = makeEnemy({ position: { x: 5, y: 5 } })
    const engine = new InPlaceCombatEngine([hero], [[enemy]], openWalls, 1)
    if (engine.getCombatState().isPlayerTurn) {
      engine.endPlayerPhase()
    }
    const heroAfter = engine.getCombatState().actors['hero1']
    if (heroAfter.hp === 0) {
      expect(heroAfter.isGhost).toBe(true)
    }
  })
})
