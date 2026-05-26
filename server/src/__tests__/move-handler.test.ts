import { describe, it, expect } from 'vitest'
import { processMove } from '../rooms/logic/move-handler'
import type { MoveContext } from '../rooms/logic/move-handler'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A 5×5 wall-free grid (all floor). */
function openMap(): (pos: { x: number; y: number }) => boolean {
  return (pos) => pos.x >= 0 && pos.x < 5 && pos.y >= 0 && pos.y < 5
}

/** Minimal context with sane defaults. */
function ctx(overrides: Partial<MoveContext> = {}): MoveContext {
  return {
    currentPos: { x: 2, y: 2 },
    destination: { x: 3, y: 2 },
    maxSpeed: 5,
    isWalkable: openMap(),
    npcs: [],
    doors: [],
    isCombatActive: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processMove', () => {
  it('accepts a valid move within speed and open terrain', () => {
    const result = processMove(ctx({ destination: { x: 3, y: 2 } }))
    expect(result.type).toBe('moved')
    if (result.type === 'moved') {
      expect(result.newPos).toEqual({ x: 3, y: 2 })
      expect(result.direction).toBe('e')
      expect('encounterCheck' in result).toBe(true)
    }
  })

  it('rejects a move that exceeds maxSpeed', () => {
    const result = processMove(ctx({ destination: { x: 2, y: 9 }, maxSpeed: 3 }))
    expect(result).toEqual({ type: 'rejected', reason: 'out_of_range' })
  })

  it('rejects a move to the same cell (zero-distance)', () => {
    const result = processMove(ctx({ currentPos: { x: 2, y: 2 }, destination: { x: 2, y: 2 } }))
    expect(result).toEqual({ type: 'rejected', reason: 'out_of_range' })
  })

  it('rejects a move blocked by the walkability predicate', () => {
    // Wall at exactly (3, 2)
    const wallAt = (pos: { x: number; y: number }) => !(pos.x === 3 && pos.y === 2)
    const result = processMove(ctx({ destination: { x: 3, y: 2 }, isWalkable: wallAt }))
    expect(result).toEqual({ type: 'rejected', reason: 'blocked' })
  })

  it('triggers NPC interaction when player lands on the NPC front cell', () => {
    // NPC at (4,2) facing west → front cell is (3,2)
    const npcs = [{ id: 'npc-1', name: 'Innkeeper', role: 'innkeeper', x: 4, y: 2, direction: 'w' }]
    const result = processMove(ctx({ destination: { x: 3, y: 2 }, npcs }))
    expect(result.type).toBe('moved')
    if (result.type === 'moved' && 'interaction' in result) {
      expect(result.interaction).toEqual({ type: 'npc', id: 'npc-1', name: 'Innkeeper', role: 'innkeeper' })
    } else {
      throw new Error('Expected an NPC interaction event')
    }
  })

  it('triggers door interaction when player steps adjacent to a door', () => {
    // Door at (4,2); player moves to (3,2) which is adjacent
    const doors = [{ id: 'door-forest', biomeId: 'verdant-forest', label: 'Verdant Forest', x: 4, y: 2 }]
    const result = processMove(ctx({ destination: { x: 3, y: 2 }, doors }))
    expect(result.type).toBe('moved')
    if (result.type === 'moved' && 'interaction' in result) {
      expect(result.interaction).toEqual({
        type: 'door',
        id: 'door-forest',
        biomeId: 'verdant-forest',
        label: 'Verdant Forest',
      })
    } else {
      throw new Error('Expected a door interaction event')
    }
  })

  it('skips interaction checks when combat is active', () => {
    // NPC adjacent to destination — but combat is active so no INTERACTION_START
    const npcs = [{ id: 'npc-1', name: 'Innkeeper', role: 'innkeeper', x: 4, y: 2, direction: 'w' }]
    const result = processMove(ctx({ destination: { x: 3, y: 2 }, npcs, isCombatActive: true }))
    expect(result.type).toBe('moved')
    // Should have encounterCheck, not interaction
    if (result.type === 'moved') {
      expect('interaction' in result).toBe(false)
      expect('encounterCheck' in result).toBe(true)
    }
  })

  it('returns correct direction for a northward move', () => {
    const result = processMove(ctx({ currentPos: { x: 2, y: 3 }, destination: { x: 2, y: 2 } }))
    expect(result.type).toBe('moved')
    if (result.type === 'moved') expect(result.direction).toBe('n')
  })

  it('NPC takes priority over door when both conditions are met', () => {
    // NPC at (4,2) facing west → front cell is (3,2)
    // Door at (3,3) → adjacent to (3,2)
    const npcs = [{ id: 'npc-1', name: 'Innkeeper', role: 'innkeeper', x: 4, y: 2, direction: 'w' }]
    const doors = [{ id: 'door-1', biomeId: 'verdant-forest', label: 'Forest', x: 3, y: 3 }]
    const result = processMove(ctx({ destination: { x: 3, y: 2 }, npcs, doors }))
    expect(result.type).toBe('moved')
    if (result.type === 'moved' && 'interaction' in result) {
      expect(result.interaction.type).toBe('npc')
    } else {
      throw new Error('Expected NPC interaction')
    }
  })
})
