import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  PointerEventTypes,
  ArcRotateCamera,
  type Scene,
} from '@babylonjs/core'
import type { ExploreToken } from 'shared-types'

const TILE_SIZE = 1

const TOKEN_COLORS: Record<string, Color3> = {
  player_me: new Color3(0.88, 0.33, 0.33),  // red
  player:    new Color3(1.0,  0.60, 0.0),   // orange
  npc:       new Color3(0.29, 0.50, 0.76),  // blue
  door:      new Color3(0.30, 0.69, 0.31),  // green
}

export class ExploreRenderer {
  private scene: Scene
  private tokenMeshIds = new Set<string>()
  private pointerObserver: ReturnType<Scene['onPointerObservable']['add']> | null = null

  constructor(
    scene: Scene,
    walls: number[][],
    onCellClick?: (x: number, y: number) => void,
  ) {
    this.scene = scene
    this.buildMap(walls)
    if (onCellClick) this.attachPicking(onCellClick)
    this.positionCamera(walls)
  }

  private buildMap(walls: number[][]): void {
    const floorMat = new StandardMaterial('explore-floor', this.scene)
    floorMat.diffuseColor = new Color3(0.83, 0.77, 0.63)

    const wallMat = new StandardMaterial('explore-wall', this.scene)
    wallMat.diffuseColor = new Color3(0.16, 0.16, 0.16)

    for (let y = 0; y < walls.length; y++) {
      const row = walls[y]
      for (let x = 0; x < row.length; x++) {
        if (row[x] === 1) {
          const mesh = MeshBuilder.CreateBox(
            `wall-${x}-${y}`,
            { width: TILE_SIZE, height: 0.6, depth: TILE_SIZE },
            this.scene,
          )
          mesh.position = new Vector3(x * TILE_SIZE, 0.3, y * TILE_SIZE)
          mesh.material = wallMat
        } else {
          const mesh = MeshBuilder.CreateBox(
            `floor-${x}-${y}`,
            { width: TILE_SIZE * 0.97, height: 0.1, depth: TILE_SIZE * 0.97 },
            this.scene,
          )
          mesh.position = new Vector3(x * TILE_SIZE, 0, y * TILE_SIZE)
          mesh.material = floorMat
        }
      }
    }
  }

  private attachPicking(onCellClick: (x: number, y: number) => void): void {
    this.pointerObserver = this.scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERDOWN) return
      const mesh = info.pickInfo?.pickedMesh
      if (!mesh?.name.startsWith('floor-')) return
      const [, xs, ys] = mesh.name.split('-')
      onCellClick(parseInt(xs, 10), parseInt(ys, 10))
    })
  }

  private positionCamera(walls: number[][]): void {
    const height = walls.length
    const width = walls[0]?.length ?? 0
    const camera = this.scene.activeCamera as ArcRotateCamera | null
    if (!camera) return
    camera.target = new Vector3((width - 1) / 2, 0, (height - 1) / 2)
    camera.radius = Math.max(width, height) * 0.85
    camera.beta = Math.PI / 3.5
  }

  updateTokens(tokens: ExploreToken[]): void {
    const seen = new Set<string>()

    for (const token of tokens) {
      const id = `token-${token.id}`
      seen.add(id)

      let mesh = this.scene.getMeshByName(id)
      if (!mesh) {
        mesh = MeshBuilder.CreateCylinder(
          id,
          { diameter: 0.6, height: 0.7, tessellation: 12 },
          this.scene,
        )
        const mat = new StandardMaterial(`mat-${id}`, this.scene)
        const colorKey = token.type === 'player' && token.isMe ? 'player_me' : token.type
        mat.diffuseColor = TOKEN_COLORS[colorKey] ?? TOKEN_COLORS.npc
        mesh.material = mat
        this.tokenMeshIds.add(id)
      }

      mesh.position = new Vector3(token.x * TILE_SIZE, 0.45, token.y * TILE_SIZE)
    }

    for (const staleId of this.tokenMeshIds) {
      if (!seen.has(staleId)) {
        this.scene.getMeshByName(staleId)?.dispose()
        this.tokenMeshIds.delete(staleId)
      }
    }
  }

  dispose(): void {
    if (this.pointerObserver) {
      this.scene.onPointerObservable.remove(this.pointerObserver)
    }
    for (const id of this.tokenMeshIds) {
      this.scene.getMeshByName(id)?.dispose()
    }
    this.tokenMeshIds.clear()
  }
}
