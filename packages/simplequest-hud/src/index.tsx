import 'simple-quest'

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'simple-quest': { content: string; character?: string }
    }
  }
}

export { sampleContent } from 'simple-quest'
export type { SimpleQuestContent, CharacterData } from 'simple-quest'

export function SimpleQuestHUD(props: { content: string; character?: string }) {
  return <simple-quest content={props.content} character={props.character ?? ''} />
}
