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

  advance(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const left = this.currentIndex
    this.currentIndex++
    this.emit('advance', left)
    this.renderCurrent()
  }

  private renderCurrent(): void {
    if (this.currentIndex >= this.panels.length) {
      this.container.innerHTML = ''
      this.emit('complete')
      return
    }
    const panel = this.panels[this.currentIndex]
    this.render(panel)

    if (!panel.choices?.length && panel.duration !== undefined) {
      this.timer = setTimeout(() => {
        this.timer = null
        this.advance()
      }, panel.duration)
    }
  }

  private render(panel: Panel): void {
    this.container.innerHTML = ''
    const el = document.createElement('div')
    el.className = 'click-comic-panel'

    if (panel.speaker) {
      const speakerEl = document.createElement('div')
      speakerEl.className = 'click-comic-speaker'
      speakerEl.textContent = panel.speaker
      el.appendChild(speakerEl)
    }

    if (panel.image) {
      const img = document.createElement('img')
      img.src = panel.image
      img.className = 'click-comic-image'
      el.appendChild(img)
    }

    const textEl = document.createElement('div')
    textEl.className = 'click-comic-text'
    textEl.textContent = panel.text
    el.appendChild(textEl)

    if (!panel.choices?.length) {
      el.addEventListener('click', () => this.advance())
    }

    this.container.appendChild(el)
  }

  protected emit(event: string, ...args: unknown[]): void {
    for (const handler of this.listeners.get(event) ?? []) {
      handler(...args)
    }
  }
}
