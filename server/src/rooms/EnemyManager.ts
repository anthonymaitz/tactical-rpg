import type { SceneToken, EncounterEvent } from 'shared-types'

interface EnemyLike {
  id: string
  name: string
  x: number
  y: number
  hp: number
  maxHp: number
  level: number
  fromSpawnPoint: boolean
}

interface EnemyMapLike {
  get(id: string): EnemyLike | undefined
  set(id: string, e: EnemyLike): void
  delete(id: string): void
  forEach(cb: (v: EnemyLike, k: string) => void): void
}

interface SpawnPoint {
  id: string
  x: number
  y: number
  radius: number
  triggered: boolean
}

export class EnemyManager {
  private spawnPoints: SpawnPoint[] = []

  constructor(
    private enemies: EnemyMapLike,
    private makeEnemy: (partial: Partial<EnemyLike>) => EnemyLike,
    tokens: SceneToken[],
  ) {
    for (const t of tokens) {
      if (t.type === 'enemy') {
        const level = t.level ?? 1
        this.enemies.set(t.id, makeEnemy({
          id: t.id,
          name: t.name ?? 'Enemy',
          x: t.col,
          y: t.row,
          level,
          hp: level * 10,
          maxHp: level * 10,
          fromSpawnPoint: false,
        }))
      } else if (t.type === 'spawn-point') {
        this.spawnPoints.push({
          id: t.id,
          x: t.col,
          y: t.row,
          radius: t.spawnRadius ?? 5,
          triggered: false,
        })
      }
    }
  }

  onPlayerMove(px: number, py: number): EncounterEvent | null {
    for (const sp of this.spawnPoints) {
      if (sp.triggered) continue
      const dist = Math.abs(px - sp.x) + Math.abs(py - sp.y)
      if (dist <= sp.radius) {
        sp.triggered = true
        const id = `spawned-${sp.id}`
        this.enemies.set(id, this.makeEnemy({
          id,
          name: 'Enemy',
          x: sp.x,
          y: sp.y,
          level: 1,
          hp: 10,
          maxHp: 10,
          fromSpawnPoint: true,
        }))
      }
    }

    let found: EncounterEvent | null = null
    this.enemies.forEach((enemy) => {
      if (found) return
      const dist = Math.abs(px - enemy.x) + Math.abs(py - enemy.y)
      if (dist === 1) {
        found = { enemyId: enemy.id, enemyName: enemy.name, x: enemy.x, y: enemy.y }
      }
    })
    return found
  }

  getEnemy(id: string): { id: string; name: string; hp: number; maxHp: number; level: number } | undefined {
    const found = this.enemies.get(id)
    return found ? { id: found.id, name: found.name, hp: found.hp, maxHp: found.maxHp, level: found.level } : undefined
  }

  removeEnemy(id: string): void {
    this.enemies.delete(id)
  }
}
