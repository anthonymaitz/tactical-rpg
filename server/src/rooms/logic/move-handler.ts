import type { Position } from 'shared-types'
import { getFrontCell, getMovementDirection } from 'shared-types'
import { isValidMove, isAdjacent } from './explore-logic'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NpcLike = {
  id: string
  name: string
  role: string
  x: number
  y: number
  direction: string
}

export type DoorLike = {
  id: string
  biomeId: string
  label: string
  destinationSlug?: string
  x: number
  y: number
}

export type MoveContext = {
  currentPos: Position
  destination: Position
  maxSpeed: number
  /** Return true if the destination cell is passable. */
  isWalkable: (pos: Position) => boolean
  npcs: Iterable<NpcLike>
  doors: Iterable<DoorLike>
  isCombatActive: boolean
}

export type InteractionEvent =
  | { type: 'npc'; id: string; name: string; role: string }
  | { type: 'door'; id: string; biomeId: string; label: string; destinationSlug?: string }

export type MoveResult =
  | { type: 'rejected'; reason: 'out_of_range' | 'blocked' }
  | { type: 'moved'; newPos: Position; direction: string; interaction: InteractionEvent }
  | { type: 'moved'; newPos: Position; direction: string; encounterCheck: true }

// ---------------------------------------------------------------------------
// Pure function
// ---------------------------------------------------------------------------

/**
 * Validate a move request and determine what happens next.
 *
 * This function has no side-effects and holds no room references.
 * Encounter triggering is deliberately excluded — it depends on EnemyManager
 * state that is room-specific. When the move is clean and combat is not active
 * the caller receives `encounterCheck: true` as a signal to run
 * `enemyManager.onPlayerMove()` itself.
 */
export function processMove(ctx: MoveContext): MoveResult {
  const { currentPos, destination, maxSpeed, isCombatActive } = ctx

  // --- Validation ---
  if (!isValidMove(currentPos, destination, maxSpeed)) {
    return { type: 'rejected', reason: 'out_of_range' }
  }
  if (!ctx.isWalkable(destination)) {
    return { type: 'rejected', reason: 'blocked' }
  }

  const newPos: Position = { x: destination.x, y: destination.y }
  const direction = getMovementDirection(currentPos, destination)

  // --- Interaction checks (only when not in combat) ---
  if (!isCombatActive) {
    // NPC: player steps onto the cell in front of an NPC
    for (const npc of ctx.npcs) {
      const front = getFrontCell({ x: npc.x, y: npc.y }, npc.direction)
      if (newPos.x === front.x && newPos.y === front.y) {
        return {
          type: 'moved',
          newPos,
          direction,
          interaction: { type: 'npc', id: npc.id, name: npc.name, role: npc.role },
        }
      }
    }

    // Door: player steps adjacent to a door
    for (const door of ctx.doors) {
      if (isAdjacent(newPos, { x: door.x, y: door.y })) {
        return {
          type: 'moved',
          newPos,
          direction,
          interaction: { type: 'door', id: door.id, biomeId: door.biomeId, label: door.label, destinationSlug: door.destinationSlug },
        }
      }
    }

    // No interaction found — signal the room to run an encounter check
    return { type: 'moved', newPos, direction, encounterCheck: true }
  }

  // In combat: no interaction or encounter checks needed, just confirm the move
  return { type: 'moved', newPos, direction, encounterCheck: true }
}
