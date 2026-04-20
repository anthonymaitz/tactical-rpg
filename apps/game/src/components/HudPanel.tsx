import type React from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'simple-quest': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { content?: string }, HTMLElement>
    }
  }
}

interface HudPanelProps {
  content: string
}

export function HudPanel({ content }: HudPanelProps) {
  return <simple-quest content={content} />
}
