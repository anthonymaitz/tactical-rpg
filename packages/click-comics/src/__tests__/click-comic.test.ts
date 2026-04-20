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

describe('panel rendering', () => {
  it('renders panel text into the container after play()', () => {
    const container = makeContainer()
    const comic = new ClickComic(container, [{ text: 'Act 1' }])
    comic.play()
    expect(container.textContent).toContain('Act 1')
    cleanup(container)
  })

  it('renders speaker name when provided', () => {
    const container = makeContainer()
    const comic = new ClickComic(container, [{ text: 'Hi', speaker: 'Goblin' }])
    comic.play()
    expect(container.textContent).toContain('Goblin')
    cleanup(container)
  })

  it('renders an img element when image is provided', () => {
    const container = makeContainer()
    const comic = new ClickComic(container, [{ text: 'Scene', image: '/scene.png' }])
    comic.play()
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.src).toContain('scene.png')
    cleanup(container)
  })

  it('advances to the next panel on container click', () => {
    const container = makeContainer()
    const panels: Panel[] = [{ text: 'Panel 1' }, { text: 'Panel 2' }]
    const comic = new ClickComic(container, panels)
    comic.play()
    expect(container.textContent).toContain('Panel 1')
    container.querySelector('.click-comic-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(container.textContent).toContain('Panel 2')
    cleanup(container)
  })

  it('emits complete after clicking past the last panel', () => {
    const container = makeContainer()
    const comic = new ClickComic(container, singlePanel)
    const completeSpy = vi.fn()
    comic.on('complete', completeSpy)
    comic.play()
    container.querySelector('.click-comic-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(completeSpy).toHaveBeenCalledOnce()
    cleanup(container)
  })

  it('emits advance with the panel index that was left', () => {
    const container = makeContainer()
    const panels: Panel[] = [{ text: 'P1' }, { text: 'P2' }]
    const comic = new ClickComic(container, panels)
    const advanceSpy = vi.fn()
    comic.on('advance', advanceSpy)
    comic.play()
    container.querySelector('.click-comic-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(advanceSpy).toHaveBeenCalledWith(0)
    cleanup(container)
  })
})

describe('auto-advance (duration)', () => {
  it('auto-advances to the next panel after the specified duration', async () => {
    const container = makeContainer()
    const panels: Panel[] = [{ text: 'Auto', duration: 50 }, { text: 'Next' }]
    const comic = new ClickComic(container, panels)
    comic.play()
    expect(container.textContent).toContain('Auto')
    await new Promise(r => setTimeout(r, 100))
    expect(container.textContent).toContain('Next')
    cleanup(container)
  })

  it('does not auto-advance when duration is absent', async () => {
    const container = makeContainer()
    const panels: Panel[] = [{ text: 'Manual' }, { text: 'Next' }]
    const comic = new ClickComic(container, panels)
    comic.play()
    await new Promise(r => setTimeout(r, 100))
    expect(container.textContent).toContain('Manual')
    expect(container.textContent).not.toContain('Next')
    cleanup(container)
  })

  it('cancels the timer if advance() is called before it fires', async () => {
    const container = makeContainer()
    const panels: Panel[] = [{ text: 'Slow', duration: 200 }, { text: 'Next' }]
    const comic = new ClickComic(container, panels)
    const completeSpy = vi.fn()
    comic.play()
    // Manually advance before the 200ms timer fires
    comic.advance()
    expect(container.textContent).toContain('Next')
    // Wait past the timer — complete should NOT fire twice
    comic.on('complete', completeSpy)
    comic.advance() // advance off the last panel
    await new Promise(r => setTimeout(r, 300))
    expect(completeSpy).toHaveBeenCalledOnce()
    cleanup(container)
  })
})

describe('choice panels', () => {
  it('renders choice buttons when panel has choices', () => {
    const container = makeContainer()
    const panels: Panel[] = [{
      text: 'What do you do?',
      choices: [
        { label: 'Attack', onSelect: () => {} },
        { label: 'Flee',   onSelect: () => {} },
      ],
    }]
    const comic = new ClickComic(container, panels)
    comic.play()
    const buttons = container.querySelectorAll('.click-comic-choice')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].textContent).toBe('Attack')
    expect(buttons[1].textContent).toBe('Flee')
    cleanup(container)
  })

  it('calls onSelect callback when a choice button is clicked', () => {
    const container = makeContainer()
    const attackSpy = vi.fn()
    const panels: Panel[] = [{
      text: 'Choose',
      choices: [{ label: 'Attack', onSelect: attackSpy }],
    }]
    const comic = new ClickComic(container, panels)
    comic.play()
    const btn = container.querySelector('.click-comic-choice') as HTMLButtonElement
    btn.click()
    expect(attackSpy).toHaveBeenCalledOnce()
    cleanup(container)
  })

  it('advances to the next panel after a choice is selected', () => {
    const container = makeContainer()
    const panels: Panel[] = [
      { text: 'Choose', choices: [{ label: 'Go', onSelect: () => {} }] },
      { text: 'Outcome' },
    ]
    const comic = new ClickComic(container, panels)
    comic.play()
    ;(container.querySelector('.click-comic-choice') as HTMLButtonElement).click()
    expect(container.textContent).toContain('Outcome')
    cleanup(container)
  })

  it('does not advance on panel click for choice panels', () => {
    const container = makeContainer()
    const panels: Panel[] = [
      { text: 'Choose', choices: [{ label: 'Go', onSelect: () => {} }] },
      { text: 'Outcome' },
    ]
    const comic = new ClickComic(container, panels)
    comic.play()
    container.querySelector('.click-comic-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(container.textContent).not.toContain('Outcome')
    cleanup(container)
  })

  it('does not auto-advance choice panels even when duration is set', async () => {
    const container = makeContainer()
    const panels: Panel[] = [
      {
        text: 'Choose',
        duration: 50,
        choices: [{ label: 'Go', onSelect: () => {} }],
      },
      { text: 'Outcome' },
    ]
    const comic = new ClickComic(container, panels)
    comic.play()
    await new Promise(r => setTimeout(r, 100))
    expect(container.textContent).not.toContain('Outcome')
    cleanup(container)
  })
})

describe('edge cases', () => {
  it('advance() after complete does not emit complete again', () => {
    const container = makeContainer()
    const completeSpy = vi.fn()
    const comic = new ClickComic(container, singlePanel).on('complete', completeSpy)
    comic.play()
    container.querySelector('.click-comic-panel')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Comic is complete — call advance() again
    comic.advance()
    comic.advance()
    expect(completeSpy).toHaveBeenCalledOnce()
    cleanup(container)
  })

  it('play() clears a pending duration timer before restarting', async () => {
    const container = makeContainer()
    const panels: Panel[] = [{ text: 'Slow', duration: 200 }, { text: 'Panel 2' }]
    const comic = new ClickComic(container, panels)
    comic.play()
    // Restart immediately before timer fires
    comic.play()
    expect(container.textContent).toContain('Slow')
    // Wait past the original timer — should NOT have advanced
    await new Promise(r => setTimeout(r, 300))
    // After restart, we're on panel 0 again; the new timer fires
    // so panel 2 text should now be showing
    expect(container.textContent).toContain('Panel 2')
    cleanup(container)
  })
})
