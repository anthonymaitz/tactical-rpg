import { createMemo, onMount, onCleanup, createEffect, on } from 'solid-js'
import 'playsets-board'
import { SceneManager } from './SceneManager'
import { ActorRenderer } from './ActorRenderer'
import { getGridTiles } from './GridRenderer'
import type { PlaysetBoardProps } from './types'
import { MeshBuilder, Vector3 } from '@babylonjs/core'

function classToSpriteId(cls?: string): string | undefined {
  if (!cls) return undefined
  const c = cls.toLowerCase()
  if (c === 'fighter' || c === 'warrior') return '/assets/sprites/tokens/warrior.svg'
  if (c === 'mage' || c === 'wizard') return '/assets/sprites/tokens/mage.svg'
  if (c === 'rogue' || c === 'thief') return '/assets/sprites/tokens/rogue.svg'
  return undefined
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'playsets-board': {
        ref?: HTMLElement
        'attr:scene'?: string
        'attr:entities'?: string
        'attr:mode'?: string
        'attr:highlights'?: string
        style?: string
      }
    }
  }
}

const TILE_SIZE = 1
const VISIBLE_RADIUS = 10

export function PlaysetBoard(props: PlaysetBoardProps) {
  if (props.mode === 'explore' || props.mode === 'combat') return <ExploreBoard {...props} />
  return <BattleBoard {...props} />
}

function ExploreBoard(props: PlaysetBoardProps) {
  let boardEl!: HTMLElement

  const sceneJson = createMemo(() => {
    if (props.sceneJson) return props.sceneJson
    const walls = props.exploreMap?.walls ?? []
    const buildings: Array<{ col: number; row: number; tileId: string }> = []
    for (let row = 0; row < walls.length; row++) {
      for (let col = 0; col < (walls[row]?.length ?? 0); col++) {
        if (walls[row][col] === 1) buildings.push({ col, row, tileId: 'wall' })
      }
    }
    return JSON.stringify({ buildings, layers: [], props: [], weather: 'none' })
  })

  const entitiesJson = createMemo(() => {
    const tokens = props.exploreMap?.tokens ?? []
    if (props.combatState) {
      const combatActorIds = new Set(Object.keys(props.combatState.actors))
      // Non-combatant explore tokens (NPCs, doors) stay on the board during combat
      const bystanders = tokens
        .filter((t) => !combatActorIds.has(t.id) && (t.type === 'npc' || t.type === 'door'))
        .map((t) => ({ id: t.id, type: t.type, x: t.x, y: t.y, label: t.label, direction: t.direction }))
      const combatants = Object.values(props.combatState.actors).map((a) => ({
        id: a.id,
        type: a.isNPC ? 'enemy' : 'player',
        x: a.position.x,
        y: a.position.y,
        isMe: a.id === props.myActorId,
        label: a.name,
        isGhost: a.isGhost ?? false,
        spriteId: a.isNPC ? undefined : classToSpriteId(a.characterClass),
      }))
      return JSON.stringify([...bystanders, ...combatants])
    }
    return JSON.stringify(
      tokens.map((t) => ({
        id: t.id,
        type: t.type,
        x: t.x,
        y: t.y,
        isMe: t.isMe,
        label: t.label,
        direction: t.direction,
        spriteId: t.spriteId,
      })),
    )
  })

  const highlightsJson = createMemo(() =>
    props.highlights && props.highlights.length > 0
      ? JSON.stringify(props.highlights)
      : undefined,
  )

  onMount(() => {
    function onCellClick(e: Event) {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail
      props.onCellClick?.(x, y)
    }
    function onTokenMove(e: Event) {
      const { x, y } = (e as CustomEvent<{ id: string; x: number; y: number }>).detail
      if (props.onTokenMove) {
        props.onTokenMove(x, y)
      } else {
        props.onCellClick?.(x, y)
      }
    }
    function onTokenDrag(e: Event) {
      const { x, y } = (e as CustomEvent<{ id: string; x: number; y: number }>).detail
      props.onTokenDrag?.(x, y)
    }
    function onTokenFace(e: Event) {
      const { direction } = (e as CustomEvent<{ id: string; direction: string }>).detail
      props.onTokenFace?.(direction)
    }
    boardEl.addEventListener('cellclick', onCellClick)
    boardEl.addEventListener('tokenmove', onTokenMove)
    boardEl.addEventListener('tokendrag', onTokenDrag)
    boardEl.addEventListener('tokenface', onTokenFace)
    onCleanup(() => {
      boardEl.removeEventListener('cellclick', onCellClick)
      boardEl.removeEventListener('tokenmove', onTokenMove)
      boardEl.removeEventListener('tokendrag', onTokenDrag)
      boardEl.removeEventListener('tokenface', onTokenFace)
    })
  })

  return (
    <playsets-board
      ref={boardEl}
      attr:scene={sceneJson()}
      attr:entities={entitiesJson()}
      attr:mode={props.mode}
      attr:highlights={highlightsJson()}
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
