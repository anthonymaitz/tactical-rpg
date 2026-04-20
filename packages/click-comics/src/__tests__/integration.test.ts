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

describe('ClickComic full playthrough', () => {
  it('plays a mixed sequence: auto, manual, choice, manual — fires complete once', async () => {
    const container = makeContainer()
    const choiceSpy = vi.fn()
    const completeSpy = vi.fn()
    const advanceSpy = vi.fn()

    const panels: Panel[] = [
      { text: 'Intro', duration: 30 },                            // auto-advance
      { text: 'Scene', speaker: 'Narrator' },                    // manual click
      {
        text: 'What do you do?',
        choices: [{ label: 'Fight', onSelect: choiceSpy }],
      },                                                           // choice
      { text: 'Outcome' },                                        // manual click → complete
    ]

    const comic = new ClickComic(container, panels)
      .on('complete', completeSpy)
      .on('advance', advanceSpy)

    comic.play()

    // Panel 0: auto-advance
    expect(container.textContent).toContain('Intro')
    await new Promise(r => setTimeout(r, 60))

    // Panel 1: manual click
    expect(container.textContent).toContain('Scene')
    container.querySelector('.click-comic-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    // Panel 2: choice
    expect(container.textContent).toContain('What do you do?')
    ;(container.querySelector('.click-comic-choice') as HTMLButtonElement).click()
    expect(choiceSpy).toHaveBeenCalledOnce()

    // Panel 3: manual → complete
    expect(container.textContent).toContain('Outcome')
    container.querySelector('.click-comic-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(completeSpy).toHaveBeenCalledOnce()
    expect(advanceSpy).toHaveBeenCalledTimes(4) // panels 0→1, 1→2, 2→3, 3→complete
    cleanup(container)
  })

  it('play() is idempotent — calling it twice restarts from panel 0', () => {
    const container = makeContainer()
    const completeSpy = vi.fn()
    const panels: Panel[] = [{ text: 'Start' }, { text: 'End' }]
    const comic = new ClickComic(container, panels).on('complete', completeSpy)

    comic.play()
    container.querySelector('.click-comic-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Now at panel 1 (End)
    comic.play() // restart
    expect(container.textContent).toContain('Start')
    expect(container.textContent).not.toContain('End')
    expect(completeSpy).not.toHaveBeenCalled()
    cleanup(container)
  })

  it('multiple on() listeners for the same event all fire', () => {
    const container = makeContainer()
    const spy1 = vi.fn()
    const spy2 = vi.fn()
    const comic = new ClickComic(container, [{ text: 'P' }])
      .on('complete', spy1)
      .on('complete', spy2)
    comic.play()
    container.querySelector('.click-comic-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(spy1).toHaveBeenCalledOnce()
    expect(spy2).toHaveBeenCalledOnce()
    cleanup(container)
  })
})
