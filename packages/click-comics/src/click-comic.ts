import type { Panel } from './types'

type EventCallback = (...args: unknown[]) => void

export class ClickComic {
  private container: HTMLElement
  private panels: Panel[]
  private currentIndex = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Map<string, EventCallback[]>()

  constructor(container: HTMLElement, panels: Panel[]) {
    this.container = container
    this.panels = panels
  }

  on(event: string, cb: EventCallback): this {
    const handlers = this.listeners.get(event) ?? []
    this.listeners.set(event, [...handlers, cb])
    return this
  }

  play(): this {
    this.currentIndex = 0
    this.renderCurrent()
    return this
  }

  private renderCurrent(): void {
    if (this.currentIndex >= this.panels.length) {
      this.emit('complete')
      return
    }
    // Rendering implemented in Task 3
  }

  protected emit(event: string, ...args: unknown[]): void {
    for (const handler of this.listeners.get(event) ?? []) {
      handler(...args)
    }
  }
}
