import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
} from '@babylonjs/core'

export class SceneManager {
  readonly engine: Engine
  readonly scene: Scene

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true)
    this.scene = new Scene(this.engine)

    const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3, 20, Vector3.Zero(), this.scene)
    camera.attachControl(canvas, true)

    new HemisphericLight('light', new Vector3(0, 1, 0), this.scene)

    this.engine.runRenderLoop(() => {
      this.scene.render()
    })
  }

  resize(): void {
    this.engine.resize()
  }

  dispose(): void {
    this.engine.dispose()
  }
}
