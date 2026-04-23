import { createMemo, onMount, onCleanup, createEffect, on } from 'solid-js'
import 'playsets-board'
import { SceneManager } from './SceneManager'
import { ActorRenderer } from './ActorRenderer'
import { getGridTiles } from './GridRenderer'
import type { PlaysetBoardProps } from './types'
import { MeshBuilder, Vector3 } from '@babylonjs/core'

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'playsets-board': { ref?: HTMLElement; walls: string; tokens: string; style?: string }
    }
  }
}

const TILE_SIZE = 1
const VISIBLE_RADIUS = 10

export function PlaysetBoard(props: PlaysetBoardProps) {
  if (props.mode === 'explore') return <ExploreBoard {...props} />
  return <BattleBoard {...props} />
}

function ExploreBoard(props: PlaysetBoardProps) {
  let boardEl!: HTMLElement

  const wallsJson = createMemo(() => JSON.stringify(props.exploreMap?.walls ?? []))
  const tokensJson = createMemo(() => JSON.stringify(props.exploreMap?.tokens ?? []))

  onMount(() => {
    function onCellClick(e: Event) {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail
      props.onCellClick?.(x, y)
    }
    boardEl.addEventListener('cellclick', onCellClick)
    onCleanup(() => boardEl.removeEventListener('cellclick', onCellClick))
  })

  return (
    <playsets-board
      ref={boardEl}
      walls={wallsJson()}
      tokens={tokensJson()}
      style="width:100%;height:100%;display:block;"
    />
  )
}

function BattleBoard(props: PlaysetBoardProps) {
  let canvas!: HTMLCanvasElement
  let actorRenderer: ActorRenderer | null = null

  createEffect(on(() => [props.mode, props.seed ?? 0n] as const, () => {
    const sm = new SceneManager(canvas)
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
  }))

  createEffect(() => {
    const cs = props.combatState
    if (cs && actorRenderer) actorRenderer.update(cs)
  })

  return <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} />
}
