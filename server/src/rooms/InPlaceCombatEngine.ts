import { resolveAction, applyResult } from 'rules-engine'
import { getMoveCost } from 'shared-types'
import type { ActorState, CombatState, Action, ActionResult, Position } from 'shared-types'

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function isWalkable(pos: Position, walls: number[][]): boolean {
  if (walls.length === 0) return true
  if (pos.y < 0 || pos.y >= walls.length) return false
  if (pos.x < 0 || pos.x >= (walls[0]?.length ?? 0)) return false
  return walls[pos.y][pos.x] === 0
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

export class InPlaceCombatEngine {
  private state: CombatState
  private walls: number[][]
  private usedAbilities: Map<string, Set<string>> = new Map()

  constructor(actors: ActorState[], walls: number[][], enemyLevel: number, roomId = 'inn') {
    this.walls = walls

    const playerRoll = rollD20()
    const playersWin = playerRoll > enemyLevel

    const players = actors.filter(a => !a.isNPC)
    const npcs = actors.filter(a => a.isNPC)
    const ordered = playersWin ? [...players, ...npcs] : [...npcs, ...players]

    const actorsMap: Record<string, ActorState> = {}
    for (const a of actors) {
      actorsMap[a.id] = playersWin || a.isNPC
        ? a
        : { ...a, energy: Math.floor(a.maxEnergy / 2) }
    }

    this.state = {
      roomId,
      turnQueue: ordered.map(a => a.id),
      currentActorIndex: 0,
      actors: actorsMap,
      round: 1,
      log: [],
      isOver: false,
      activeEnemyIds: npcs.map(a => a.id),
    }
  }

  getCombatState(): CombatState {
    return this.state
  }

  isOver(): boolean {
    return this.state.isOver
  }

  winningSide(): 'players' | 'npcs' | null {
    return this.state.winningSide ?? null
  }

  startTurn(actorId: string): void {
    const actor = this.state.actors[actorId]
    if (!actor) return
    this.state = {
      ...this.state,
      actors: { ...this.state.actors, [actorId]: { ...actor, energy: actor.maxEnergy } },
    }
    this.usedAbilities.set(actorId, new Set())
  }

  handlePlayerAction(actorId: string, action: Action): ActionResult {
    const actor = this.state.actors[actorId]
    if (!actor) throw new Error(`Actor ${actorId} not found`)

    if (action.type === 'move') {
      const cost = getMoveCost(actor.position, action.destination, this.walls)
      if (cost === null) throw new Error('Destination unreachable')
      if (cost > actor.energy) throw new Error('Insufficient energy')
      const result = resolveAction(actorId, action, this.state)
      // resolveAction for move returns empty energyDeltas — inject the cost
      const withEnergy: ActionResult = { ...result, energyDeltas: { [actorId]: -cost } }
      this.state = applyResult(withEnergy, this.state)
      this.markGhosts()
      return withEnergy
    }

    if (action.type === 'ability') {
      const abilityId = action.ability.id
      const used = this.usedAbilities.get(actorId) ?? new Set()
      if (used.has(abilityId)) throw new Error(`Ability ${abilityId} already used this turn`)
      // resolveAction for ability already includes energyDeltas with the cost
      const result = resolveAction(actorId, action, this.state)
      this.state = applyResult(result, this.state)
      used.add(abilityId)
      this.usedAbilities.set(actorId, used)
      this.markGhosts()
      return result
    }

    throw new Error('Unknown action type')
  }

  processNPCTurns(): ActionResult[] {
    const results: ActionResult[] = []
    let safety = this.state.turnQueue.length * 2

    while (safety-- > 0) {
      const actorId = this.state.turnQueue[this.state.currentActorIndex]
      const actor = this.state.actors[actorId]
      if (!actor?.isNPC) break

      this.startTurn(actorId)
      const turnResults = this.runNPCTurn(actorId)
      results.push(...turnResults)

      if (this.state.isOver) break
      this.advanceTurn()
      // Stop if we've wrapped back to a player turn
      const nextId = this.state.turnQueue[this.state.currentActorIndex]
      if (!this.state.actors[nextId]?.isNPC) break
    }

    return results
  }

  addActor(actor: ActorState): void {
    const insertAt = (this.state.currentActorIndex + 1) % this.state.turnQueue.length
    const newQueue = [...this.state.turnQueue]
    newQueue.splice(insertAt, 0, actor.id)
    this.state = {
      ...this.state,
      actors: { ...this.state.actors, [actor.id]: actor },
      turnQueue: newQueue,
    }
  }

  advanceTurn(): void {
    this.state = {
      ...this.state,
      currentActorIndex: (this.state.currentActorIndex + 1) % this.state.turnQueue.length,
    }
  }

  applyHeal(actorId: string, healAmount: number, energyCost: number): void {
    const actor = this.state.actors[actorId]
    if (!actor) return
    const newHp = Math.min(actor.maxHp, actor.hp + healAmount)
    const newEnergy = Math.max(0, actor.energy - energyCost)
    this.state = {
      ...this.state,
      actors: { ...this.state.actors, [actorId]: { ...actor, hp: newHp, energy: newEnergy } },
    }
  }

  private markGhosts(): void {
    const updated: Record<string, ActorState> = {}
    let changed = false
    for (const [id, actor] of Object.entries(this.state.actors)) {
      if (actor.hp === 0 && !actor.isGhost) {
        updated[id] = { ...actor, isGhost: true }
        changed = true
      } else {
        updated[id] = actor
      }
    }
    if (changed) {
      this.state = { ...this.state, actors: updated }
    }
  }

  private runNPCTurn(actorId: string): ActionResult[] {
    const results: ActionResult[] = []

    while (true) {
      const actor = this.state.actors[actorId]
      if (!actor || actor.energy <= 0 || this.state.isOver) break

      const players = Object.values(this.state.actors).filter(a => !a.isNPC && !a.isGhost)
      if (players.length === 0) break

      const adjacent = players.find(p =>
        Math.abs(p.position.x - actor.position.x) + Math.abs(p.position.y - actor.position.y) === 1
      )

      if (adjacent) {
        const ability = actor.abilities.find(ab => actor.energy >= ab.energyCost)
        if (ability) {
          const action: Action = { type: 'ability', actorId, targetIds: [adjacent.id], ability }
          const result = resolveAction(actorId, action, this.state)
          this.state = applyResult(result, this.state)
          this.markGhosts()
          results.push(result)
          if (this.state.isOver) break
          continue
        }
      }

      // Move toward nearest player (1 step)
      const target = players.reduce((closest, p) => {
        const d = Math.abs(p.position.x - actor.position.x) + Math.abs(p.position.y - actor.position.y)
        const bd = Math.abs(closest.position.x - actor.position.x) + Math.abs(closest.position.y - actor.position.y)
        return d < bd ? p : closest
      })

      const occupied = new Set(
        Object.values(this.state.actors)
          .filter(a => a.id !== actorId)
          .map(a => `${a.position.x},${a.position.y}`)
      )

      const step = DIRS
        .map(([dx, dy]) => ({ x: actor.position.x + dx, y: actor.position.y + dy }))
        .filter(p => isWalkable(p, this.walls) && !occupied.has(`${p.x},${p.y}`))
        .sort((a, b) => {
          const da = Math.abs(a.x - target.position.x) + Math.abs(a.y - target.position.y)
          const db = Math.abs(b.x - target.position.x) + Math.abs(b.y - target.position.y)
          return da - db
        })[0]

      if (!step) break

      const action: Action = { type: 'move', actorId, destination: step }
      const result = resolveAction(actorId, action, this.state)
      const withEnergy: ActionResult = { ...result, energyDeltas: { [actorId]: -1 } }
      this.state = applyResult(withEnergy, this.state)
      results.push(withEnergy)
    }

    return results
  }
}
