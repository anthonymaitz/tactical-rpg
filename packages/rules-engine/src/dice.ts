import type { RollResult } from 'shared-types'

export function rollDice(notation: string): RollResult {
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/)
  if (!match) throw new Error(`Invalid dice notation: "${notation}"`)

  const count = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  const modifier = match[3] ? parseInt(match[3], 10) : 0

  const dice = Array.from({ length: count }, () =>
    Math.floor(Math.random() * sides) + 1
  )
  const total = dice.reduce((sum, d) => sum + d, 0) + modifier

  return { total, dice, modifier, notation }
}
