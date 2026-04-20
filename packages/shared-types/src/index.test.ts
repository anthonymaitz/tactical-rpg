import { describe, it, expectTypeOf } from 'vitest'
import type {
  ActorState, CombatState, Action, ActionResult, RollResult, AbilityDefinition, DiceNotation
} from './index'

describe('shared-types', () => {
  it('ActorState has required fields', () => {
    expectTypeOf<ActorState>().toHaveProperty('id')
    expectTypeOf<ActorState>().toHaveProperty('hp')
    expectTypeOf<ActorState>().toHaveProperty('abilities')
    expectTypeOf<ActorState>().toHaveProperty('characterClass')
    expectTypeOf<ActorState['abilities']>().toEqualTypeOf<AbilityDefinition[]>()
  })

  it('CombatState has actors map and turn queue', () => {
    expectTypeOf<CombatState>().toHaveProperty('actors')
    expectTypeOf<CombatState['actors']>().toEqualTypeOf<Record<string, ActorState>>()
    expectTypeOf<CombatState>().toHaveProperty('turnQueue')
    expectTypeOf<CombatState['turnQueue']>().toEqualTypeOf<string[]>()
  })

  it('ActionResult hpDeltas is a string-keyed number record', () => {
    expectTypeOf<ActionResult['hpDeltas']>().toEqualTypeOf<Record<string, number>>()
  })

  it('DiceNotation is a discriminated union', () => {
    expectTypeOf<DiceNotation>().toMatchTypeOf<{ kind: 'notation'; value: string } | { kind: 'actor' }>()
  })
})
