import 'simple-quest'
import { onMount, onCleanup } from 'solid-js'

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'simple-quest': { ref?: HTMLElement; 'attr:content'?: string; 'attr:character'?: string }
    }
  }
}

export { sampleContent } from 'simple-quest'
export type { SimpleQuestContent, CharacterData } from 'simple-quest'

export function SimpleQuestHUD(props: {
  content: string
  character?: string
  onAbilityActivate?: (title: string, energyCost: number) => void
}) {
  let el!: HTMLElement

  onMount(() => {
    function handler(e: Event) {
      const { title, energyCost } = (e as CustomEvent<{ title: string; energyCost: number }>).detail
      props.onAbilityActivate?.(title, energyCost)
    }
    el.addEventListener('abilityactivate', handler)
    onCleanup(() => el.removeEventListener('abilityactivate', handler))
  })

  return (
    <simple-quest
      ref={el}
      attr:content={props.content}
      attr:character={props.character ?? ''}
    />
  )
}
