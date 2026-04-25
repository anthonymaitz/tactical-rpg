import { describe, it, expect } from 'vitest'
import { EnemyManager } from '../rooms/EnemyManager'
import type { SceneToken } from 'shared-types'

function makeMapSchema() {
  const store = new Map<string, ReturnType<typeof makeEnemy>>()
  return {
    set(id: string, e: ReturnType<typeof makeEnemy>) { store.set(id, e) },
    delete(id: string) { store.delete(id) },
    forEach(cb: (v: ReturnType<typeof makeEnemy>, k: string) => void) { store.forEach(cb) },
    get size() { return store.size },
  }
}

function makeEnemy(partial: {
  id?: string; name?: string; x?: number; y?: number
  hp?: number; maxHp?: number; level?: number; fromSpawnPoint?: boolean
}) {
  return {
    id: partial.id ?? '',
    name: partial.name ?? 'Enemy',
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    hp: partial.hp ?? 10,
    maxHp: partial.maxHp ?? 10,
    level: partial.level ?? 1,
    fromSpawnPoint: partial.fromSpawnPoint ?? false,
  }
}

describe('EnemyManager — fixed enemies', () => {
  it('loads enemy tokens into the MapSchema on construction', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'e1', type: 'enemy', col: 5, row: 3, name: 'Skeleton', level: 2 },
    ]
    new EnemyManager(enemies as never, makeEnemy, tokens)
    expect(enemies.size).toBe(1)
  })

  it('returns ENCOUNTER when player moves adjacent to a fixed enemy', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'e1', type: 'enemy', col: 5, row: 5, name: 'Goblin', level: 1 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    const result = mgr.onPlayerMove(4, 5)
    expect(result).not.toBeNull()
    expect(result!.enemyId).toBe('e1')
    expect(result!.enemyName).toBe('Goblin')
  })

  it('returns null when player is not adjacent to any enemy', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'e1', type: 'enemy', col: 5, row: 5, name: 'Goblin', level: 1 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    expect(mgr.onPlayerMove(10, 10)).toBeNull()
  })

  it('returns null when player is on the same cell as an enemy (dist 0)', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'e1', type: 'enemy', col: 5, row: 5, name: 'Goblin', level: 1 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    expect(mgr.onPlayerMove(5, 5)).toBeNull()
  })
})

describe('EnemyManager — spawn points', () => {
  it('does not pre-populate enemies from spawn-point tokens', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'sp1', type: 'spawn-point', col: 10, row: 10, spawnRadius: 3 },
    ]
    new EnemyManager(enemies as never, makeEnemy, tokens)
    expect(enemies.size).toBe(0)
  })

  it('spawns an enemy when player enters spawn radius', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'sp1', type: 'spawn-point', col: 10, row: 10, spawnRadius: 3 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    mgr.onPlayerMove(10, 12) // dist = 2, within radius 3
    expect(enemies.size).toBe(1)
  })

  it('does not spawn twice from the same spawn point', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'sp1', type: 'spawn-point', col: 10, row: 10, spawnRadius: 3 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    mgr.onPlayerMove(10, 12)
    mgr.onPlayerMove(10, 12)
    expect(enemies.size).toBe(1)
  })

  it('does not spawn when player is outside radius', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'sp1', type: 'spawn-point', col: 10, row: 10, spawnRadius: 3 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    mgr.onPlayerMove(10, 20) // dist = 10, outside radius 3
    expect(enemies.size).toBe(0)
  })

  it('returns ENCOUNTER when player moves adjacent to a spawned enemy', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'sp1', type: 'spawn-point', col: 10, row: 10, spawnRadius: 5 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    mgr.onPlayerMove(10, 8) // triggers spawn at (10,10), dist=2, not adjacent
    const result = mgr.onPlayerMove(10, 9) // adjacent to (10,10), dist=1
    expect(result).not.toBeNull()
    expect(result!.enemyId).toBe('spawned-sp1')
  })
})

describe('EnemyManager — removeEnemy', () => {
  it('removes an enemy from the map', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'e1', type: 'enemy', col: 5, row: 5, name: 'Goblin', level: 1 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    expect(enemies.size).toBe(1)
    mgr.removeEnemy('e1')
    expect(enemies.size).toBe(0)
  })
})
