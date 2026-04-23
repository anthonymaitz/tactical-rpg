import { createEffect, on, onCleanup } from 'solid-js'
import { SceneManager } from './SceneManager'
import { ActorRenderer } from './ActorRenderer'
import { ExploreRenderer } from './ExploreRenderer'
import { getGridTiles } from './GridRenderer'
import type { PlaysetBoardProps } from './types'
import { MeshBuilder, Vector3 } from '@babylonjs/core'

const TILE_SIZE = 1
const VISIBLE_RADIUS = 10

export function PlaysetBoard(props: PlaysetBoardProps) {
  let canvas!: HTMLCanvasElement
  let actorRenderer: ActorRenderer | null = null
  let exploreRenderer: ExploreRenderer | null = null

  createEffect(on(() => [props.mode, props.seed ?? 0n] as const, () => {
    const sm = new SceneManager(canvas)

    if (props.mode === 'explore') {
      const walls = props.exploreMap?.walls ?? []
      const er = new ExploreRenderer(sm.scene, walls, props.onCellClick)
      exploreRenderer = er
      if (props.exploreMap?.tokens) er.updateTokens(props.exploreMap.tokens)

      const handleResize = () => sm.resize()
      window.addEventListener('resize', handleResize)
      onCleanup(() => {
        window.removeEventListener('resize', handleResize)
        exploreRenderer = null
        er.dispose()
        sm.dispose()
      })
    } else {
      const ar = new ActorRenderer(sm.scene)
      actorRenderer = ar

      const tiles = props.mode === 'combat'
        ? getGridTiles(0, 0, 10, 10)
        : getGridTiles(-VISIBLE_RADIUS, -VISIBLE_RADIUS, VISIBLE_RADIUS * 2, VISIBLE_RADIUS * 2)

      for (const tile of tiles) {
        const box = MeshBuilder.CreateBox(
          `tile-${tile.x}-${tile.y}`,
          { width: TILE_SIZE, height: 0.1, depth: TILE_SIZE },
          sm.scene,
        )
        box.position = new Vector3(tile.x * TILE_SIZE, 0, tile.y * TILE_SIZE)
      }

      const handleResize = () => sm.resize()
      window.addEventListener('resize', handleResize)
      onCleanup(() => {
        window.removeEventListener('resize', handleResize)
        actorRenderer = null
        ar.dispose()
        sm.dispose()
      })
    }
  }))

  createEffect(() => {
    const tokens = props.exploreMap?.tokens
    if (tokens && exploreRenderer) exploreRenderer.updateTokens(tokens)
  })

  createEffect(() => {
    const cs = props.combatState
    if (cs && actorRenderer) actorRenderer.update(cs)
  })

  return (
    <canvas
      ref={canvas}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
