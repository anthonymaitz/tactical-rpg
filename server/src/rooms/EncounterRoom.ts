import type { Client } from '@colyseus/core'
import { ExploreState } from '../schemas/ExploreState'
import { BaseRoom } from './BaseRoom'
import { EnemyManager } from './EnemyManager'
import { InPlaceCombatEngine } from './InPlaceCombatEngine'
import { buildPartyActors, getActivePartyActorId } from './logic/party-combat'
import { heroService } from '../db/hero-service'
import { inventoryService } from '../db/inventory-service'
import { supabase } from '../db/supabase'
import { CLASS_XP_PER_COMBAT_USE } from '../db/hero-logic'
import { weaponDamageBonus } from './combat-constants'
import type { Position, SceneData, ActorState, CombatState, EncounterEvent, ActionResult, Action } from 'shared-types'

const RECOVERY_HOURS = 8

/**
 * Base class for any room that supports in-place combat.
 * Subclasses provide walls and optional loot logic; everything else is shared.
 */
export abstract class EncounterRoom extends BaseRoom<ExploreState> {
  protected enemyManager!: EnemyManager
  protected _combat: InPlaceCombatEngine | null = null
  protected _combatParticipants = new Set<string>()
  protected _combatHeroActorIds = new Map<string, string[]>()
  protected _sceneData: SceneData = { buildings: [], layers: [], props: [], tokens: [], weather: 'sunny' }

  /** Override to supply walkable walls for the combat grid. Default: open field. */
  protected getCombatWalls(): number[][] { return [] }

  /**
   * Shared READY message handler. Sends SCENE_STATE, PLAYER_LIST, and HERO_STATE.
   * Pass `{ healOnEnter: true }` for rooms that restore HP to full on entry (e.g. the Inn).
   * Without it, hero HP is preserved from the DB.
   */
  protected async handleReadyMessage(
    client: Client,
    opts: { healOnEnter?: boolean } = {},
  ): Promise<void> {
    client.send('SCENE_STATE', this._sceneData)

    const playerList: Array<{ sessionId: string; x: number; y: number; direction: string }> = []
    this.state.players.forEach((player, sid) => {
      playerList.push({ sessionId: sid, x: player.x, y: player.y, direction: player.direction })
    })
    if (playerList.length > 0) client.send('PLAYER_LIST', playerList)

    const userData = client.userData as { userId?: string; heroIds?: string[] }
    let heroIds = userData?.heroIds ?? []
    console.log(`[${this.constructor.name}] READY from ${client.sessionId} userId=${userData?.userId} heroIds=${JSON.stringify(heroIds)}`)

    if (heroIds.length === 0 && userData.userId) {
      const heroes = await heroService.listHeroes(userData.userId)
      heroIds = heroes.map((h) => h.id)
      console.log(`[${this.constructor.name}] resolved heroIds from DB: ${JSON.stringify(heroIds)}`)
      client.userData = { ...userData, heroIds } as typeof client.userData
    }

    if (heroIds.length === 0) { console.log(`[${this.constructor.name}] no heroIds, skipping HERO_STATE`); return }
    const hero = await heroService.getHero(heroIds[0])
    if (!hero) { console.log(`[${this.constructor.name}] hero ${heroIds[0]} not found`); return }

    const maxHp = hero.maxHp > 0 ? hero.maxHp : 10
    const hp = opts.healOnEnter ? maxHp : (hero.currentHp ?? maxHp)
    if (opts.healOnEnter) await heroService.restoreHp(hero.id)

    client.send('HERO_STATE', {
      name: hero.name,
      class: hero.characterClass,
      personality: hero.personality,
      profession: hero.profession ?? '',
      die: hero.die,
      hp,
      maxHp,
      combat: 'inGeneral',
      energy: Array(10).fill(true) as boolean[],
      starRating: hero.starRating ?? 0,
      gear: hero.gear ? { weapon: hero.gear.weapon ?? null, weaponBonus: weaponDamageBonus(hero.gear.weapon) } : undefined,
      level: hero.level,
      secondaryClass: hero.secondaryClass,
    })
  }

  /**
   * Called after enemies are removed and hero HP is saved on a player win.
   * Override to award loot or other room-specific rewards.
   * Returns extra fields merged into the COMBAT_END broadcast payload.
   */
  protected async onCombatWin(_cs: CombatState): Promise<Record<string, unknown>> {
    return {}
  }

  /** Called after all shared combat state is cleared. Override to clean up room-specific fields. */
  protected onCombatCleanup(): void {}

  /** Register shared combat message handlers. Call this in the subclass onCreate. */
  protected registerCombatMessageHandlers(): void {
    this.onMessage<{ action: Action }>('PLAYER_ACTION', (client, msg) => {
      this.handleCombatAction(client, msg.action)
    })
    this.onMessage('END_TURN', (client) => {
      this.handleEndTurn(client)
    })
    this.onMessage('JOIN_COMBAT', async (client) => {
      await this.handleJoinCombat(client)
    })
    this.onMessage('USE_POTION', async (client) => {
      await this.handleUsePotion(client)
    })
  }

  /**
   * Kick off combat once enemy groups have been built by the subclass.
   * Sends ENCOUNTER to the triggering client, creates the engine, broadcasts COMBAT_START,
   * and auto-processes enemy phases if enemies go first.
   */
  protected async beginCombat(
    client: Client,
    encounter: EncounterEvent,
    enemyGroups: ActorState[][],
    enemyLevel: number,
  ): Promise<void> {
    const userData = client.userData as { heroIds?: string[] }
    const heroIds = userData?.heroIds ?? []
    if (heroIds.length === 0) return

    const current = this.state.players.get(client.sessionId)
    if (!current) return

    const heroActors = await buildPartyActors(heroIds, { x: current.x, y: current.y })
    if (heroActors.length === 0) return

    client.send('ENCOUNTER', encounter)

    this._combat = new InPlaceCombatEngine(heroActors, enemyGroups, this.getCombatWalls(), enemyLevel)
    this._combatParticipants.add(client.sessionId)
    this._combatHeroActorIds.set(client.sessionId, heroActors.map(a => a.id))

    const initialState = this._combat.getCombatState()
    this.broadcast('COMBAT_START', initialState)

    if (!initialState.isPlayerTurn) {
      const npcResults = this._combat.endPlayerPhase()
      this.broadcastNpcResults(npcResults)
      if (this._combat.isOver()) { await this.endCombat(); return }
      this.broadcast('COMBAT_STATE', this._combat.getCombatState())
    }
  }

  protected async handleJoinCombat(client: Client): Promise<void> {
    if (!this._combat || this._combatParticipants.has(client.sessionId)) return

    const userData = client.userData as { heroIds?: string[] }
    const heroIds = userData?.heroIds ?? []
    if (heroIds.length === 0) return

    const current = this.state.players.get(client.sessionId)
    if (!current) return

    const joinActors = await buildPartyActors(heroIds, { x: current.x, y: current.y })
    if (joinActors.length === 0) return

    for (const actor of joinActors) this._combat.addActor(actor)
    this._combatParticipants.add(client.sessionId)
    this._combatHeroActorIds.set(client.sessionId, joinActors.map(a => a.id))
    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  protected handleCombatAction(client: Client, action: Action): void {
    if (!this._combat) return
    const sessionHeroIds = this._combatHeroActorIds.get(client.sessionId) ?? []
    const cs = this._combat.getCombatState()
    const actorId = getActivePartyActorId(sessionHeroIds, cs, action.actorId)
    if (!actorId) return

    let actionResult: ActionResult
    try {
      actionResult = this._combat.handlePlayerAction(actorId, action)
    } catch (e) {
      client.send('ACTION_REJECTED', { reason: e instanceof Error ? e.message : 'invalid action' })
      return
    }

    if (action.type === 'ability') {
      heroService.awardClassXp(actorId, action.ability.id, CLASS_XP_PER_COMBAT_USE).catch(() => {})
    }

    if (this._combat.isOver()) { void this.endCombat(); return }
    this.broadcast('ACTION_RESULT', actionResult)
    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  protected handleEndTurn(client: Client): void {
    if (!this._combat) return
    const sessionHeroIds = this._combatHeroActorIds.get(client.sessionId) ?? []
    if (!getActivePartyActorId(sessionHeroIds, this._combat.getCombatState())) return

    const npcResults = this._combat.endPlayerPhase()
    this.broadcastNpcResults(npcResults)
    if (this._combat.isOver()) { void this.endCombat(); return }
    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  protected async handleUsePotion(client: Client): Promise<void> {
    if (!this._combat) return
    const sessionHeroIds = this._combatHeroActorIds.get(client.sessionId) ?? []
    const heroId = getActivePartyActorId(sessionHeroIds, this._combat.getCombatState())
    if (!heroId) { client.send('ACTION_REJECTED', { reason: 'not_your_turn' }); return }

    const actor = this._combat.getCombatState().actors[heroId]
    if (!actor) return
    if (actor.energy < 1) { client.send('ACTION_REJECTED', { reason: 'insufficient_energy' }); return }

    const heroInv = await inventoryService.getHeroInventory(heroId)
    if (heroInv.healthPotions <= 0) { client.send('ACTION_REJECTED', { reason: 'no_potions' }); return }

    this._combat.applyHeal(heroId, actor.maxHp - actor.hp, 1)
    await inventoryService.useHeroPotion(heroId)
    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  protected broadcastNpcResults(results: ActionResult[]): void {
    for (const r of results) {
      if (Object.keys(r.hpDeltas).length > 0) this.broadcast('ACTION_RESULT', r)
    }
  }

  protected async endCombat(): Promise<void> {
    if (!this._combat) return
    const winningSide = this._combat.winningSide()
    const cs = this._combat.getCombatState()

    if (winningSide === 'players') {
      for (const enemyId of cs.activeEnemyIds) {
        if (this.state.enemies.has(enemyId)) this.state.enemies.delete(enemyId)
        this.enemyManager.removeEnemy(enemyId)
      }
      await Promise.all(
        Object.values(cs.actors).filter(a => !a.isNPC).map(a => heroService.updateCurrentHp(a.id, a.hp))
      )
      const extra = await this.onCombatWin(cs)
      this.broadcast('COMBAT_END', { result: 'win', ...extra })
    } else if (winningSide === null) {
      this.broadcast('COMBAT_END', { result: 'cancelled' })
    } else {
      const recoveryEndsAt = new Date(Date.now() + RECOVERY_HOURS * 60 * 60 * 1000).toISOString()
      await Promise.all(
        Object.values(cs.actors)
          .filter(a => !a.isNPC && a.isGhost)
          .map(hero => supabase.from('heroes').update({ recovery_ends_at: recoveryEndsAt }).eq('id', hero.id))
      )
      this.broadcast('COMBAT_END', { result: 'lose', recoveryEndsAt })
    }

    // Sync explore positions to final combat positions so heroes don't snap back
    for (const [sessionId, heroIds] of this._combatHeroActorIds.entries()) {
      const leadActor = cs.actors[heroIds[0]]
      if (leadActor) {
        const pos = this.state.players.get(sessionId)
        if (pos) { pos.x = leadActor.position.x; pos.y = leadActor.position.y }
      }
    }

    this._combat = null
    this._combatParticipants.clear()
    this._combatHeroActorIds.clear()
    this.onCombatCleanup()
  }

  /** Check if a non-participant should auto-join or receive a join offer based on proximity. */
  protected checkCombatProximity(client: Client, pos: Position): void {
    if (!this._combat || this._combatParticipants.has(client.sessionId)) return
    const cs = this._combat.getCombatState()
    const combatEnemies = cs.activeEnemyIds.map(id => cs.actors[id]).filter(Boolean)
    const autoJoin = combatEnemies.some(e =>
      Math.abs(e.position.x - pos.x) + Math.abs(e.position.y - pos.y) === 1
    )
    if (autoJoin) {
      void this.handleJoinCombat(client)
    } else {
      const nearby = Object.values(cs.actors).some(a =>
        Math.abs(a.position.x - pos.x) + Math.abs(a.position.y - pos.y) <= 4
      )
      if (nearby) client.send('COMBAT_JOIN_OFFER')
    }
  }
}
