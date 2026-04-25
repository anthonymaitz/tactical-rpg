import 'simple-quest'
import { onMount, onCleanup } from 'solid-js'

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'simple-quest': { ref?: HTMLElement; 'attr:content'?: string; 'attr:character'?: string; style?: string }
    }
  }
}

export { sampleContent } from 'simple-quest'
export type { SimpleQuestContent, CharacterData } from 'simple-quest'

export type CharacterChangeData = {
  name: string
  class: string
  profession: string
  personality: string
  die: string
}

export function SimpleQuestHUD(props: {
  content: string
  character?: string
  onAbilityActivate?: (title: string, energyCost: number) => void
  onCharacterChange?: (data: CharacterChangeData) => void
}) {
  let el!: HTMLElement

  onMount(() => {
    function abilityHandler(e: Event) {
      const { title, energyCost } = (e as CustomEvent<{ title: string; energyCost: number }>).detail
      props.onAbilityActivate?.(title, energyCost)
    }
    function characterHandler(e: Event) {
      props.onCharacterChange?.((e as CustomEvent<CharacterChangeData>).detail)
    }
    el.addEventListener('abilityactivate', abilityHandler)
    el.addEventListener('characterchange', characterHandler)
    onCleanup(() => {
      el.removeEventListener('abilityactivate', abilityHandler)
      el.removeEventListener('characterchange', characterHandler)
    })
  })

  return (
    <simple-quest
      ref={el}
      attr:content={props.content}
      attr:character={props.character ?? ''}
      style="display:block;height:100%;min-height:0;"
    />
  )
}
