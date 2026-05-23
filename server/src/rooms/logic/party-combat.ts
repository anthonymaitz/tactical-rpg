import { heroService } from '../../db/hero-service'
import { weaponDamageBonus } from '../combat-constants'
import type { ActorState, Position } from 'shared-types'

/** Load all party heroes and build ActorState entries. Lead hero at `origin`, companions at y+1, y+2, ... */
export async function buildPartyActors(heroIds: string[], origin: Position): Promise<ActorState[]> {
  const heroes = (await Promise.all(heroIds.map((id) => heroService.getHero(id)))).filter(
    (h): h is NonNullable<typeof h> => h !== null,
  )
  return heroes.map((hero, i) => ({
    id: hero.id,
    name: hero.name,
    personality: hero.personality,
    characterClass: hero.characterClass,
    die: hero.die,
    hp: hero.maxHp,
    maxHp: hero.maxHp,
    energy: hero.maxEnergy > 0 ? hero.maxEnergy : 10,
    maxEnergy: hero.maxEnergy > 0 ? hero.maxEnergy : 10,
    speed: hero.speed,
    position: { x: origin.x, y: origin.y + i },
    statusEffects: [],
    isNPC: false,
    abilities: [...hero.abilities, ...hero.secondaryAbilities],
    damageBonus: weaponDamageBonus(hero.gear?.weapon),
  }))
}

/**
 * Return the current actor's ID only if it belongs to this session's party and it's the player phase.
 * Used by rooms to validate that the client is allowed to act.
 */
export function getActivePartyActorId(
  sessionHeroIds: string[],
  cs: { isPlayerTurn: boolean; phases: Array<{ actorIds: string[] }>; currentPhaseIndex: number },
  requestedActorId?: string,
): string | null {
  if (!cs.isPlayerTurn) return null
  const phase = cs.phases[cs.currentPhaseIndex]
  if (!phase) return null
  // If a specific actor was requested, validate it's a party member with AP
  if (requestedActorId) {
    return sessionHeroIds.includes(requestedActorId) ? requestedActorId : null
  }
  // Otherwise return first party actor in the phase
  return phase.actorIds.find(id => sessionHeroIds.includes(id)) ?? null
}
