import { describe, it, expect } from 'vitest'
import { getGridTiles, chunkSeededHash } from '../GridRenderer'

describe('chunkSeededHash', () => {
  it('returns a number', () => {
    expect(typeof chunkSeededHash(12345n, 0, 0)).toBe('number')
  })

  it('returns same value for same inputs (deterministic)', () => {
    const a = chunkSeededHash(42n, 3, 7)
    const b = chunkSeededHash(42n, 3, 7)
    expect(a).toBe(b)
  })

  it('returns different values for different positions', () => {
    const a = chunkSeededHash(42n, 0, 0)
    const b = chunkSeededHash(42n, 1, 0)
    const c = chunkSeededHash(42n, 0, 1)
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('getGridTiles', () => {
  it('returns correct number of tiles for a 3x3 grid', () => {
    const tiles = getGridTiles(0, 0, 3, 3)
    expect(tiles).toHaveLength(9)
  })

  it('each tile has x, y coordinates', () => {
    const tiles = getGridTiles(0, 0, 2, 2)
    for (const tile of tiles) {
      expect(typeof tile.x).toBe('number')
      expect(typeof tile.y).toBe('number')
    }
  })

  it('tiles cover the expected range', () => {
    const tiles = getGridTiles(2, 3, 3, 2)
    const xs = tiles.map(t => t.x).sort((a, b) => a - b)
    const ys = tiles.map(t => t.y).sort((a, b) => a - b)
    expect(xs[0]).toBe(2)
    expect(xs[xs.length - 1]).toBe(4)
    expect(ys[0]).toBe(3)
    expect(ys[ys.length - 1]).toBe(4)
  })
})
