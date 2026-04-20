export interface Choice {
  label: string
  onSelect: () => void
}

export interface Panel {
  image?: string
  text: string
  speaker?: string
  /** Auto-advance delay in milliseconds. If absent, panel waits for click. */
  duration?: number
  /** If present, renders choice buttons instead of click-to-advance. */
  choices?: Choice[]
}
