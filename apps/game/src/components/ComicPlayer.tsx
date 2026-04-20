import { useEffect, useRef } from 'react'
import { ClickComic } from 'click-comics'
import type { Panel } from 'click-comics'

interface ComicPlayerProps {
  panels: Panel[]
  onComplete: () => void
}

export function ComicPlayer({ panels, onComplete }: ComicPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const comic = new ClickComic(container, panels)
    comic.on('complete', onComplete)
    comic.play()

    return () => {
      container.innerHTML = ''
    }
  }, [panels, onComplete])

  return <div ref={containerRef} />
}
