import { describe, it, expect } from 'vitest'
import { THE_INN } from '../inn-map'

describe('THE_INN', () => {
  it('has valid dimensions', () => {
    expect(THE_INN.walls.length).toBe(THE_INN.height)
    THE_INN.walls.forEach(row => expect(row.length).toBe(THE_INN.width))
  })

  it('has a walkable spawn point', () => {
    expect(THE_INN.walls[THE_INN.spawnY][THE_INN.spawnX]).toBe(0)
  })

  it('all NPC positions are on walkable tiles', () => {
    for (const npc of THE_INN.npcs) {
      expect(THE_INN.walls[npc.y][npc.x]).toBe(0)
    }
  })

  it('all door positions are on walkable tiles', () => {
    for (const door of THE_INN.doors) {
      expect(THE_INN.walls[door.y][door.x]).toBe(0)
    }
  })

  it('border tiles are all walls', () => {
    const lastRow = THE_INN.height - 1
    const lastCol = THE_INN.width - 1
    THE_INN.walls[0].forEach(t => expect(t).toBe(1))
    THE_INN.walls[lastRow].forEach(t => expect(t).toBe(1))
    THE_INN.walls.forEach(row => {
      expect(row[0]).toBe(1)
      expect(row[lastCol]).toBe(1)
    })
  })
})
