import { resolveAction, applyResult } from 'rules-engine'
import { getMoveCost } from 'shared-types'
import type { ActorState, CombatState, CombatPhase, Action, ActionResult, Position } from 'shared-types'

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

  /**
   * @param playerActors  All party hero actors
   * @param enemyGroups   Each inner array is one group that acts together
   * @param walls         Walkable map (0 = floor)
   * @param enemyLevel    Used for initiative roll (player d20 vs this number)
   * @param roomId
   */
  constructor(
    playerActors: ActorState[],
    enemyGroups: ActorState[][],
    walls: number[][],
    enemyLevel: number,
    roomId = 'inn',
  ) {
    this.walls = walls

    const playerRoll = rollD20()
    const playersFirst = playerRoll > enemyLevel

    const playerPhase: CombatPhase = {
      id: 'players',
      isPlayers: true,
      actorIds: playerActors.map(a => a.id),
      label: 'Players',
    }
    const enemyPhases: CombatPhase[] = enemyGroups.map((group, i) => ({
      id: `group-${i}`,
      isPlayers: false,
      actorIds: group.map(a => a.id),
      label: group.length === 1 ? group[0].name : `${group[0].name} group`,
    }))

    const phases = playersFirst
      ? [playerPhase, ...enemyPhases]
      : [...enemyPhases, playerPhase]

    const actorsMap: Record<string, ActorState> = {}
    for (const a of playerActors) {
      actorsMap[a.id] = playersFirst ? a : { ...a, energy: Math.floor(a.maxEnergy / 2) }
    }
    for (const group of enemyGroups) {
      for (const a of group) {
        actorsMap[a.id] = a
      }
    }

    const activeEnemyIds = enemyGroups.flat().map(a => a.id)

    this.state = {
      roomId,
      phases,
      currentPhaseIndex: 0,
      isPlayerTurn: phases[0].isPlayers,
      actors: actorsMap,
      round: 1,
      log: [],
      isOver: false,
      activeEnemyIds,
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

  /** Restore full AP for all actors in the given phase. Called at start of a phase. */
  startPhase(phaseIndex: number): void {
    const phase = this.state.phases[phaseIndex]
    if (!phase) return
    const updated: Record<string, ActorState> = { ...this.state.actors }
    for (const id of phase.actorIds) {
      const actor = updated[id]
      if (actor) {
        updated[id] = { ...actor, energy: actor.maxEnergy }
        this.usedAbilities.set(id, new Set())
      }
    }
    this.state = { ...this.state, actors: updated }
  }

  /** Called when player clicks End Turn or all party AP is exhausted. Returns NPC results from subsequent enemy phases. */
  endPlayerPhase(): ActionResult[] {
    return this.advancePhase()
  }

  /** Handle a player action during the player phase. Any party actor may act. */
  handlePlayerAction(actorId: string, action: Action): ActionResult {
    if (!this.state.isPlayerTurn) throw new Error('Not player turn')
    const actor = this.state.actors[actorId]
    if (!actor) throw new Error(`Actor ${actorId} not found`)
    if (actor.isGhost) throw new Error('Actor is defeated')

    if (action.type === 'move') {
      const cost = getMoveCost(actor.position, action.destination, this.walls)
      if (cost === null) throw new Error('Destination unreachable')
      if (cost > actor.energy) throw new Error('Insufficient energy')
      const result = resolveAction(actorId, action, this.state)
      const withEnergy: ActionResult = { ...result, energyDeltas: { [actorId]: -cost } }
      this.state = applyResult(withEnergy, this.state)
      this.markGhosts()
      return withEnergy
    }

    if (action.type === 'ability') {
      const abilityId = action.ability.id
      const used = this.usedAbilities.get(actorId) ?? new Set()
      if (used.has(abilityId)) throw new Error(`Ability ${abilityId} already used this turn`)
      const result = resolveAction(actorId, action, this.state)
      this.state = applyResult(result, this.state)
      used.add(abilityId)
      this.usedAbilities.set(actorId, used)
      this.markGhosts()
      return result
    }

    throw new Error('Unknown action type')
  }

  /** Manually add an actor to an existing phase (for join-combat). */
  addActorToPhase(actor: ActorState, phaseId: string): void {
    const phaseIdx = this.state.phases.findIndex(p => p.id === phaseId)
    if (phaseIdx === -1) return
    const phase = this.state.phases[phaseIdx]
    const updatedPhases = [...this.state.phases]
    updatedPhases[phaseIdx] = { ...phase, actorIds: [...phase.actorIds, actor.id] }
    this.state = {
      ...this.state,
      phases: updatedPhases,
      actors: { ...this.state.actors, [actor.id]: actor },
    }
  }

  /** Legacy: add actor for joining an existing combat (inserts into player phase). */
  addActor(actor: ActorState): void {
    this.addActorToPhase(actor, 'players')
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

  /** Advance to the next phase. Auto-processes enemy phases until player phase or combat over. Returns all NPC action results. */
  private advancePhase(): ActionResult[] {
    const results: ActionResult[] = []
    const totalPhases = this.state.phases.length

    let next = (this.state.currentPhaseIndex + 1) % totalPhases
    const newRound = next === 0

    if (newRound) {
      this.state = { ...this.state, round: this.state.round + 1 }
    }

    this.state = {
      ...this.state,
      currentPhaseIndex: next,
      isPlayerTurn: this.state.phases[next].isPlayers,
    }

    if (this.state.phases[next].isPlayers) {
      // Start of player phase — restore AP for all party heroes
      this.startPhase(next)
      return results
    }

    // Auto-process enemy phases until we hit player phase again or run out
    let safety = totalPhases
    while (safety-- > 0) {
      const phase = this.state.phases[this.state.currentPhaseIndex]
      if (phase.isPlayers) break

      // Start phase (restores enemy AP)
      this.startPhase(this.state.currentPhaseIndex)
      const phaseResults = this.runEnemyPhase(phase.actorIds)
      results.push(...phaseResults)

      if (this.state.isOver) return results

      const nextIdx = (this.state.currentPhaseIndex + 1) % totalPhases
      const startingNewRound = nextIdx === 0
      if (startingNewRound) {
        this.state = { ...this.state, round: this.state.round + 1 }
      }
      this.state = {
        ...this.state,
        currentPhaseIndex: nextIdx,
        isPlayerTurn: this.state.phases[nextIdx].isPlayers,
      }
      if (this.state.phases[nextIdx].isPlayers) {
        this.startPhase(nextIdx)
        break
      }
    }

    return results
  }

  private runEnemyPhase(actorIds: string[]): ActionResult[] {
    const results: ActionResult[] = []
    for (const actorId of actorIds) {
      const actor = this.state.actors[actorId]
      if (!actor || actor.isGhost) continue
      this.startActorTurn(actorId)
      const turnResults = this.runNPCTurn(actorId)
      results.push(...turnResults)
      if (this.state.isOver) return results
    }
    return results
  }

  private startActorTurn(actorId: string): void {
    const actor = this.state.actors[actorId]
    if (!actor) return
    this.state = {
      ...this.state,
      actors: { ...this.state.actors, [actorId]: { ...actor, energy: actor.maxEnergy } },
    }
    this.usedAbilities.set(actorId, new Set())
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

    // Check win/loss
    const players = Object.values(this.state.actors).filter(a => !a.isNPC)
    const enemies = Object.values(this.state.actors).filter(a => a.isNPC)
    const allPlayersGhost = players.length > 0 && players.every(a => a.isGhost)
    const allEnemiesGhost = enemies.length > 0 && enemies.every(a => a.isGhost)

    if (allPlayersGhost) {
      this.state = { ...this.state, isOver: true, winningSide: 'npcs' }
    } else if (allEnemiesGhost) {
      this.state = { ...this.state, isOver: true, winningSide: 'players' }
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
