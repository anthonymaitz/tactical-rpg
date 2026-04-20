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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sm = new SceneManager(canvas)
    const actorRenderer = new ActorRenderer(sm.scene)

    const tiles = mode === 'combat' && combatState
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

    if (combatState) {
      actorRenderer.update(combatState)
    }

    const handleResize = () => sm.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      actorRenderer.dispose()
      sm.dispose()
    }
  }, [mode, seed, combatState])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
