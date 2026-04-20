import { describe, it, expect, vi } from 'vitest'
import { ClickComic } from '../click-comic'
import type { Panel } from '../types'

function makeContainer(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function cleanup(el: HTMLElement) {
  document.body.removeChild(el)
}

const singlePanel: Panel[] = [{ text: 'Hello world' }]

describe('ClickComic constructor and events', () => {
  it('can be constructed with a container and panels', () => {
    const container = makeContainer()
    const comic = new ClickComic(container, singlePanel)
    expect(comic).toBeDefined()
    cleanup(container)
  })

  it('on() registers a callback and returns this for chaining', () => {
    const container = makeContainer()
    const comic = new ClickComic(container, singlePanel)
    const result = comic.on('complete', () => {})
    expect(result).toBe(comic)
    cleanup(container)
  })

  it('emits complete when play() is called with empty panel list', () => {
    const container = makeContainer()
    const comic = new ClickComic(container, [])
    const completeSpy = vi.fn()
    comic.on('complete', completeSpy)
    comic.play()
    expect(completeSpy).toHaveBeenCalledOnce()
    cleanup(container)
  })

  it('does not emit complete immediately when panels exist', () => {
    const container = makeContainer()
    const comic = new ClickComic(container, singlePanel)
    const completeSpy = vi.fn()
    comic.on('complete', completeSpy)
    comic.play()
    expect(completeSpy).not.toHaveBeenCalled()
    cleanup(container)
  })
})
