import { describe, it, expect } from 'vitest'
import { rollDice } from '../dice'

describe('rollDice', () => {
  it('parses and rolls 1d6', () => {
    const result = rollDice('1d6')
    expect(result.notation).toBe('1d6')
    expect(result.dice).toHaveLength(1)
    expect(result.dice[0]).toBeGreaterThanOrEqual(1)
    expect(result.dice[0]).toBeLessThanOrEqual(6)
    expect(result.modifier).toBe(0)
    expect(result.total).toBe(result.dice[0])
  })

  it('rolls multiple dice and sums them', () => {
    const result = rollDice('3d6')
    expect(result.dice).toHaveLength(3)
    expect(result.total).toBe(result.dice.reduce((a: number, b: number) => a + b, 0))
  })

  it('applies positive modifier', () => {
    const result = rollDice('1d6+3')
    expect(result.modifier).toBe(3)
    expect(result.total).toBe(result.dice[0] + 3)
  })

  it('applies negative modifier', () => {
    const result = rollDice('1d6-2')
    expect(result.modifier).toBe(-2)
    expect(result.total).toBe(result.dice[0] - 2)
  })

  it('each die roll is within valid range', () => {
    const result = rollDice('10d20')
    result.dice.forEach((d: number) => {
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(20)
    })
  })

  it('throws on invalid notation', () => {
    expect(() => rollDice('invalid')).toThrow('Invalid dice notation')
    expect(() => rollDice('d6')).toThrow('Invalid dice notation')
    expect(() => rollDice('')).toThrow('Invalid dice notation')
    expect(() => rollDice('0d6')).toThrow('Invalid dice notation')
    expect(() => rollDice('1d0')).toThrow('Invalid dice notation')
  })
})
