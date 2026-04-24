import { describe, it, expect } from 'vitest'
import { generateSceneFromInn } from '../scene-data'
import { THE_INN } from '../inn-map'

describe('generateSceneFromInn', () => {
  it('converts wall cells to SceneBuilding entries', () => {
    const scene = generateSceneFromInn(THE_INN)
    const wallCount = THE_INN.walls.flat().filter(v => v === 1).length
    expect(scene.buildings).toHaveLength(wallCount)
    expect(scene.buildings[0]).toMatchObject({ tileId: 'wall-wood' })
  })

  it('converts npcs to npc tokens', () => {
    const scene = generateSceneFromInn(THE_INN)
    const npcTokens = scene.tokens.filter(t => t.type === 'npc')
    expect(npcTokens).toHaveLength(THE_INN.npcs.length)
    expect(npcTokens[0]).toMatchObject({
      type: 'npc',
      id: THE_INN.npcs[0].id,
      col: THE_INN.npcs[0].x,
      row: THE_INN.npcs[0].y,
      role: THE_INN.npcs[0].role,
      name: THE_INN.npcs[0].name,
    })
  })

  it('converts doors to door tokens', () => {
    const scene = generateSceneFromInn(THE_INN)
    const doorTokens = scene.tokens.filter(t => t.type === 'door')
    expect(doorTokens).toHaveLength(THE_INN.doors.length)
    expect(doorTokens[0]).toMatchObject({
      type: 'door',
      id: THE_INN.doors[0].id,
      biomeId: THE_INN.doors[0].biomeId,
    })
  })

  it('returns defaults for layers, props, weather', () => {
    const scene = generateSceneFromInn(THE_INN)
    expect(scene.layers).toEqual([{ id: 1, background: 'grass' }])
    expect(scene.props).toEqual([])
    expect(scene.weather).toBe('sunny')
  })
})
