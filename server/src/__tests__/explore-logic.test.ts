import { describe, it, expect } from 'vitest'
import { isValidMove, getManhattanDistance, isWalkable, isAdjacent } from '../rooms/logic/explore-logic'
import type { Position } from 'shared-types'
import { THE_INN } from 'shared-types'

describe('getManhattanDistance', () => {
  it('returns 0 for same position', () => {
    expect(getManhattanDistance({ x: 3, y: 5 }, { x: 3, y: 5 })).toBe(0)
  })

  it('returns correct distance for non-diagonal move', () => {
    expect(getManhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7)
  })

  it('is symmetric', () => {
    const a: Position = { x: 1, y: 2 }
    const b: Position = { x: 4, y: 6 }
    expect(getManhattanDistance(a, b)).toBe(getManhattanDistance(b, a))
  })
})

describe('isValidMove', () => {
  it('allows move within speed', () => {
    expect(isValidMove({ x: 0, y: 0 }, { x: 3, y: 0 }, 3)).toBe(true)
  })

  it('allows move equal to speed', () => {
    expect(isValidMove({ x: 0, y: 0 }, { x: 2, y: 3 }, 5)).toBe(true)
  })

  it('rejects move beyond speed', () => {
    expect(isValidMove({ x: 0, y: 0 }, { x: 4, y: 0 }, 3)).toBe(false)
  })

  it('rejects move to current position (no-op)', () => {
    expect(isValidMove({ x: 2, y: 2 }, { x: 2, y: 2 }, 5)).toBe(false)
  })
})

describe('isWalkable', () => {
  it('returns true for a floor tile', () => {
    expect(isWalkable(THE_INN, { x: 10, y: 7 })).toBe(true)
  })

  it('returns false for a wall tile', () => {
    expect(isWalkable(THE_INN, { x: 0, y: 0 })).toBe(false)
  })

  it('returns false for out-of-bounds position', () => {
    expect(isWalkable(THE_INN, { x: -1, y: 0 })).toBe(false)
    expect(isWalkable(THE_INN, { x: 0, y: 100 })).toBe(false)
  })
})

describe('isAdjacent', () => {
  it('returns true for orthogonally adjacent positions', () => {
    expect(isAdjacent({ x: 5, y: 5 }, { x: 6, y: 5 })).toBe(true)
    expect(isAdjacent({ x: 5, y: 5 }, { x: 5, y: 6 })).toBe(true)
    expect(isAdjacent({ x: 5, y: 5 }, { x: 4, y: 5 })).toBe(true)
  })

  it('returns false for diagonal positions', () => {
    expect(isAdjacent({ x: 5, y: 5 }, { x: 6, y: 6 })).toBe(false)
  })

  it('returns false for same position', () => {
    expect(isAdjacent({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(false)
  })

  it('returns false for positions 2 steps away', () => {
    expect(isAdjacent({ x: 5, y: 5 }, { x: 7, y: 5 })).toBe(false)
  })
})
