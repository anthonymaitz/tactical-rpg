import { MeshBuilder, StandardMaterial, Color3, Vector3, type Scene } from '@babylonjs/core'
import type { CombatState } from 'shared-types'

const TILE_SIZE = 1

export class ActorRenderer {
  private scene: Scene
  private meshIds = new Set<string>()

  constructor(scene: Scene) {
    this.scene = scene
  }

  update(combatState: CombatState): void {
    const existingIds = new Set(this.meshIds)

    for (const actor of Object.values(combatState.actors)) {
      const meshName = `actor-${actor.id}`
      existingIds.delete(meshName)

      let mesh = this.scene.getMeshByName(meshName)
      if (!mesh) {
        mesh = MeshBuilder.CreateSphere(meshName, { diameter: 0.8 }, this.scene)
        const mat = new StandardMaterial(`mat-${actor.id}`, this.scene)
        mat.diffuseColor = actor.isNPC ? new Color3(1, 0, 0) : new Color3(0, 0.5, 1)
        mesh.material = mat
        this.meshIds.add(meshName)
      }

      mesh.position = new Vector3(
        actor.position.x * TILE_SIZE,
        0.4,
        actor.position.y * TILE_SIZE,
      )
    }

    for (const staleId of existingIds) {
      this.scene.getMeshByName(staleId)?.dispose()
      this.meshIds.delete(staleId)
    }
  }

  dispose(): void {
    for (const id of this.meshIds) {
      this.scene.getMeshByName(id)?.dispose()
    }
    this.meshIds.clear()
  }
}
