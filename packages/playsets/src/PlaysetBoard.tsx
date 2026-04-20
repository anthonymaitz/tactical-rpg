import { useEffect, useRef } from 'react'
import { SceneManager } from './SceneManager'
import { ActorRenderer } from './ActorRenderer'
import { getGridTiles } from './GridRenderer'
import type { PlaysetBoardProps } from './types'
import { MeshBuilder, Vector3 } from '@babylonjs/core'

const TILE_SIZE = 1
const VISIBLE_RADIUS = 10

export function PlaysetBoard({
  mode,
  roomId: _roomId,
  seed = 0n,
  combatState,
  onAction: _onAction,
  onEncounter: _onEncounter,
  onBuild: _onBuild,
}: PlaysetBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const actorRendererRef = useRef<ActorRenderer | null>(null)

  // Scene initialization — runs only when mode or seed changes, not on every combatState update
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sm = new SceneManager(canvas)
    const actorRenderer = new ActorRenderer(sm.scene)
    actorRendererRef.current = actorRenderer

    const tiles = mode === 'combat'
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

    return () => {
      window.removeEventListener('resize', handleResize)
      actorRendererRef.current = null
      actorRenderer.dispose()
      sm.dispose()
    }
  }, [mode, seed])

  // Actor sync — runs on combatState changes without reinitializing the scene
  useEffect(() => {
    if (combatState && actorRendererRef.current) {
      actorRendererRef.current.update(combatState)
    }
  }, [combatState])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
