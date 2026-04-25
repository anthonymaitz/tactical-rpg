import { describe, it, expect } from 'vitest'
import { getMoveCost, getReachableCells } from '../combat-bfs'

// 5x5 open grid (all zeros)
const openWalls = Array.from({ length: 5 }, () => Array(5).fill(0))

// Grid with a wall at (2,2)
const walledGrid = openWalls.map((row, y) =>
  row.map((_: number, x: number) => (x === 2 && y === 2 ? 1 : 0))
)

describe('getMoveCost', () => {
  it('returns 0 for same cell', () => {
    expect(getMoveCost({ x: 0, y: 0 }, { x: 0, y: 0 }, openWalls)).toBe(0)
  })

  it('returns manhattan distance on open grid', () => {
    expect(getMoveCost({ x: 0, y: 0 }, { x: 3, y: 0 }, openWalls)).toBe(3)
    expect(getMoveCost({ x: 0, y: 0 }, { x: 2, y: 2 }, openWalls)).toBe(4)
  })

  it('routes around walls', () => {
    expect(getMoveCost({ x: 0, y: 2 }, { x: 4, y: 2 }, walledGrid)).toBe(6)
  })

  it('returns null for wall destination', () => {
    expect(getMoveCost({ x: 0, y: 0 }, { x: 2, y: 2 }, walledGrid)).toBeNull()
  })

  it('returns null when out of bounds', () => {
    expect(getMoveCost({ x: 0, y: 0 }, { x: 10, y: 10 }, openWalls)).toBeNull()
  })
})

describe('getReachableCells', () => {
  it('returns cells within energy budget', () => {
    const cells = getReachableCells({ x: 2, y: 2 }, openWalls, 2)
    expect(cells.length).toBeGreaterThan(0)
    for (const c of cells) {
      const cost = getMoveCost({ x: 2, y: 2 }, c, openWalls)
      expect(cost).not.toBeNull()
      expect(cost!).toBeLessThanOrEqual(2)
    }
  })

  it('excludes origin', () => {
    const cells = getReachableCells({ x: 2, y: 2 }, openWalls, 3)
    expect(cells.every(c => !(c.x === 2 && c.y === 2))).toBe(true)
  })

  it('excludes walls', () => {
    const cells = getReachableCells({ x: 0, y: 2 }, walledGrid, 5)
    expect(cells.every(c => !(c.x === 2 && c.y === 2))).toBe(true)
  })
})
