import { onMount, onCleanup } from 'solid-js'
import { ClickComic } from 'click-comics'
import type { Panel } from 'click-comics'

interface ComicPlayerProps {
  panels: Panel[]
  onComplete: () => void
}

export function ComicPlayer(props: ComicPlayerProps) {
  let container!: HTMLDivElement

  onMount(() => {
    const comic = new ClickComic(container, props.panels)
    comic.on('complete', props.onComplete)
    comic.play()
    onCleanup(() => { container.innerHTML = '' })
  })

  return <div ref={container} />
}
