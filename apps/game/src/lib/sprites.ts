const base = (import.meta.env.BASE_URL ?? '').replace(/\/$/, '')

export function classToSpriteId(cls?: string): string | undefined {
  if (!cls) return undefined
  const c = cls.toLowerCase()
  if (c === 'fighter' || c === 'warrior') return `${base}/assets/sprites/tokens/warrior.svg`
  if (c === 'mage' || c === 'wizard') return `${base}/assets/sprites/tokens/mage.svg`
  if (c === 'rogue' || c === 'thief') return `${base}/assets/sprites/tokens/rogue.svg`
  return undefined
}
