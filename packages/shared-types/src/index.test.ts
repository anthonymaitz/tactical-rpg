import { describe, it, expectTypeOf } from 'vitest'
import type {
  ActorState, CombatState, Action, ActionResult, RollResult, AbilityDefinition
} from './index'

describe('shared-types', () => {
  it('ActorState has required fields', () => {
    expectTypeOf<ActorState>().toHaveProperty('id')
    expectTypeOf<ActorState>().toHaveProperty('hp')
    expectTypeOf<ActorState>().toHaveProperty('abilities')
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

  it('RollResult contains dice array and total', () => {
    expectTypeOf<RollResult>().toHaveProperty('total')
    expectTypeOf<RollResult>().toHaveProperty('dice')
    expectTypeOf<RollResult['dice']>().toEqualTypeOf<number[]>()
  })
})
