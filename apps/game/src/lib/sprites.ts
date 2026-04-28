export function classToSpriteId(cls?: string): string | undefined {
  if (!cls) return undefined
  const c = cls.toLowerCase()
  if (c === 'fighter' || c === 'warrior') return '/assets/sprites/tokens/warrior.svg'
  if (c === 'mage' || c === 'wizard') return '/assets/sprites/tokens/mage.svg'
  if (c === 'rogue' || c === 'thief') return '/assets/sprites/tokens/rogue.svg'
  return undefined
}
