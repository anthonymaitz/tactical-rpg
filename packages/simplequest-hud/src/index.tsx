import 'simple-quest'

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'simple-quest': { 'attr:content'?: string; 'attr:character'?: string }
    }
  }
}

export { sampleContent } from 'simple-quest'
export type { SimpleQuestContent, CharacterData } from 'simple-quest'

export function SimpleQuestHUD(props: { content: string; character?: string }) {
  return <simple-quest attr:content={props.content} attr:character={props.character ?? ''} />
}
