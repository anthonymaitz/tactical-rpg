import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { ComicPlayer } from '../components/ComicPlayer'
import type { Panel } from 'click-comics'

describe('ComicPlayer', () => {
  it('renders the first panel text', () => {
    const panels: Panel[] = [{ text: 'Act 1' }, { text: 'Act 2' }]
    render(() => <ComicPlayer panels={panels} onComplete={() => {}} />)
    expect(screen.getByText('Act 1')).toBeInTheDocument()
  })

  it('calls onComplete after the last panel is clicked', () => {
    let completed = false
    const panels: Panel[] = [{ text: 'Only Panel' }]
    render(() => <ComicPlayer panels={panels} onComplete={() => { completed = true }} />)
    const panel = document.querySelector('.click-comic-panel')!
    fireEvent.click(panel)
    expect(completed).toBe(true)
  })
})
