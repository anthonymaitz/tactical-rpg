import { describe, it, expect } from 'vitest'
import { isValidMove, getManhattanDistance } from '../rooms/logic/explore-logic'
import type { Position } from 'shared-types'

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
