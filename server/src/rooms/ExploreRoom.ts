import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition, NpcEntity, DoorEntity, EnemyEntity } from '../schemas/ExploreState'
import { BaseRoom } from './BaseRoom'
import { EnemyManager } from './EnemyManager'
import { InPlaceCombatEngine } from './InPlaceCombatEngine'
import { isValidMove, isWalkable, isAdjacent, getFrontCell, getMovementDirection } from './logic/explore-logic'
import { buildPartyActors, getActivePartyActorId } from './logic/party-combat'
import { heroService } from '../db/hero-service'
import { CLASS_XP_PER_COMBAT_USE } from '../db/hero-logic'
import { supabase } from '../db/supabase'
import { THE_INN, generateSceneFromInn } from 'shared-types'
import type { Position, SceneData, ActorState, EncounterEvent } from 'shared-types'
import { weaponDamageBonus, ENEMY_SLASH } from './combat-constants'

interface MoveMessage {
  destination: Position
}

const INN_MOVE_SPEED = 10
const SCENE_SLUG = 'inn-main'
const RECOVERY_HOURS = 8

export class ExploreRoom extends BaseRoom<ExploreState> {
  private _sceneData: SceneData = generateSceneFromInn(THE_INN)
  private enemyManager!: EnemyManager
  private _combat: InPlaceCombatEngine | null = null
  private _combatParticipants: Set<string> = new Set()
  private _combatHeroActorIds: Map<string, string[]> = new Map()

  async onCreate(): Promise<void> {
    this.setState(new ExploreState())

    const { data, error } = await supabase
      .from('scenes')
      .select('scene_data')
      .eq('slug', SCENE_SLUG)
      .maybeSingle()

    if (error) {
      console.warn(`[ExploreRoom] Failed to fetch scene '${SCENE_SLUG}':`, error.message)
    } else if (data?.scene_data && ((data.scene_data as SceneData).tokens?.length ?? 0) > 0) {
      const stored = data.scene_data as SceneData
      // Always use code-defined NPC and door tokens from THE_INN — stored scene may predate new NPCs
      const canonical = generateSceneFromInn(THE_INN)
      const canonicalIds = new Set(canonical.tokens?.map((t) => t.id) ?? [])
      const extraTokens = (stored.tokens ?? []).filter((t) => !canonicalIds.has(t.id))
      this._sceneData = { ...stored, tokens: [...(canonical.tokens ?? []), ...extraTokens] }
    }

    for (const token of this._sceneData.tokens ?? []) {
      if (token.type === 'npc') {
        const entity = new NpcEntity()
        entity.id = token.id
        entity.name = token.name ?? ''
        entity.role = token.role ?? ''
        entity.x = token.col
        entity.y = token.row
        entity.direction = token.direction ?? 's'
        this.state.npcs.push(entity)
      } else if (token.type === 'door') {
        const entity = new DoorEntity()
        entity.id = token.id
        entity.biomeId = token.biomeId ?? ''
        entity.label = token.label ?? ''
        entity.x = token.col
        entity.y = token.row
        this.state.doors.push(entity)
      }
    }

    this.enemyManager = new EnemyManager(
      this.state.enemies,
      (partial) => Object.assign(new EnemyEntity(), partial),
      this._sceneData.tokens ?? [],
    )

    this.onMessage<{ emote: string }>('EMOTE', (client, msg) => {
      const actorId = (client.userData as { heroIds?: string[] })?.heroIds?.[0]
      if (actorId) this.broadcast('EMOTE_EVENT', { id: actorId, emote: msg.emote })
    })

    this.onMessage<{ speech: string }>('SPEECH', (client, msg) => {
      const actorId = (client.userData as { heroIds?: string[] })?.heroIds?.[0]
      if (actorId) this.broadcast('SPEECH_EVENT', { id: actorId, speech: msg.speech })
    })

    this.onMessage<{ action: string }>('TOKEN_ACTION', (client, msg) => {
      const actorId = (client.userData as { heroIds?: string[] })?.heroIds?.[0]
      if (actorId) this.broadcast('ACTION_EVENT', { id: actorId, action: msg.action })
    })

    this.onMessage<MoveMessage>('MOVE', async (client, message) => {
      await this.handleMove(client, message)
    })

    this.onMessage<{ action: import('shared-types').Action }>('PLAYER_ACTION', (client, msg) => {
      this.handleCombatAction(client, msg.action)
    })

    this.onMessage('END_TURN', (client) => {
      this.handleEndTurn(client)
    })

    this.onMessage('JOIN_COMBAT', async (client) => {
      await this.handleJoinCombat(client)
    })

    this.onMessage('REST', async (client) => {
      const userData = client.userData as { userId?: string; heroIds?: string[] }
      const heroId = (userData?.heroIds ?? [])[0]
      if (!heroId) return
      const hero = await heroService.getHero(heroId)
      if (!hero) return
      const maxHp = hero.maxHp > 0 ? hero.maxHp : 10
      await heroService.restoreHp(heroId)
      client.send('HERO_STATE', {
        name: hero.name,
        class: hero.characterClass,
        personality: hero.personality,
        profession: hero.profession ?? '',
        die: hero.die,
        hp: maxHp,
        maxHp,
        combat: 'inGeneral',
        energy: Array(10).fill(true) as boolean[],
        starRating: hero.starRating ?? 0,
        gear: hero.gear ? { weapon: hero.gear.weapon ?? null, weaponBonus: weaponDamageBonus(hero.gear.weapon) } : undefined,
        level: hero.level,
        secondaryClass: hero.secondaryClass,
      })
    })

    this.onMessage<{ className: string }>('SET_SECONDARY_CLASS', async (client, message) => {
      const userData = client.userData as { heroIds?: string[] }
      const heroId = (userData?.heroIds ?? [])[0]
      if (!heroId) return

      const hero = await heroService.getHero(heroId)
      if (!hero) return
      if (hero.level < 5) {
        client.send('ERROR', { code: 'SECONDARY_CLASS_LOCKED', message: 'Secondary class unlocks at level 5' })
        return
      }

      try {
        const updated = await heroService.setSecondaryClass(heroId, message.className)
        const maxHp = updated.maxHp > 0 ? updated.maxHp : 10
        client.send('HERO_STATE', {
          name: updated.name,
          class: updated.characterClass,
          personality: updated.personality,
          profession: updated.profession ?? '',
          die: updated.die,
          hp: maxHp,
          maxHp,
          combat: 'inGeneral',
          energy: Array(10).fill(true) as boolean[],
          starRating: updated.starRating ?? 0,
          gear: updated.gear ? { weapon: updated.gear.weapon ?? null, weaponBonus: weaponDamageBonus(updated.gear?.weapon) } : undefined,
          level: updated.level,
          secondaryClass: updated.secondaryClass,
        })
      } catch (err) {
        console.error('[ExploreRoom] setSecondaryClass failed:', err)
        client.send('ERROR', { code: 'SET_CLASS_FAILED', message: 'Failed to set secondary class' })
      }
    })

    this.onMessage<{ direction: string }>('FACE', (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (player) {
        player.direction = message.direction
        this.broadcast('PLAYER_MOVED', { sessionId: client.sessionId, x: player.x, y: player.y, direction: player.direction })
      }
    })

    this.onMessage('READY', async (client) => {
      client.send('SCENE_STATE', this._sceneData)

      // Send JSON snapshot of existing players so client can render them without binary schema sync
      const playerList: Array<{ sessionId: string; x: number; y: number; direction: string }> = []
      this.state.players.forEach((player, sid) => {
        playerList.push({ sessionId: sid, x: player.x, y: player.y, direction: player.direction })
      })
      if (playerList.length > 0) client.send('PLAYER_LIST', playerList)

      const userData = client.userData as { userId?: string; heroIds?: string[] }
      let heroIds = userData?.heroIds ?? []
      console.log(`[ExploreRoom] READY from ${client.sessionId} userId=${userData?.userId} heroIds=${JSON.stringify(heroIds)}`)

      // If client session has no heroIds, resolve them from the authenticated user
      if (heroIds.length === 0 && userData.userId) {
        const heroes = await heroService.listHeroes(userData.userId)
        heroIds = heroes.map((h) => h.id)
        console.log(`[ExploreRoom] resolved heroIds from DB: ${JSON.stringify(heroIds)}`)
        client.userData = { ...userData, heroIds } as typeof client.userData
      }

      if (heroIds.length === 0) { console.log(`[ExploreRoom] no heroIds, skipping HERO_STATE`); return }
      const hero = await heroService.getHero(heroIds[0])
      if (!hero) { console.log(`[ExploreRoom] hero ${heroIds[0]} not found`); return }
      const maxHp = hero.maxHp > 0 ? hero.maxHp : 10
      // Inn auto-heals — restore HP to full on every entry
      await heroService.restoreHp(hero.id)
      client.send('HERO_STATE', {
        name: hero.name,
        class: hero.characterClass,
        personality: hero.personality,
        profession: hero.profession ?? '',
        die: hero.die,
        hp: maxHp,
        maxHp,
        combat: 'inGeneral',
        energy: Array(10).fill(true) as boolean[],
        starRating: hero.starRating ?? 0,
        gear: hero.gear ? { weapon: hero.gear.weapon ?? null, weaponBonus: weaponDamageBonus(hero.gear.weapon) } : undefined,
        level: hero.level,
        secondaryClass: hero.secondaryClass,
      })
    })
  }

  async onJoin(client: Client, options: { token?: string; heroIds?: string[] }): Promise<void> {
    console.log(`[ExploreRoom] onJoin ${client.sessionId} heroIds=${JSON.stringify(options.heroIds)}`)
    const userId = await this.verifyToken(options.token)
    const pos = new PlayerPosition()
    pos.x = THE_INN.spawnX
    pos.y = THE_INN.spawnY
    pos.characterId = client.sessionId
    this.state.players.set(client.sessionId, pos)
    const heroIds = options.heroIds ?? []
    client.userData = { userId, heroIds }
  }

  onLeave(client: Client): void {
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)
    }
    this.broadcast('PLAYER_LEFT', { sessionId: client.sessionId })
  }

  private async handleMove(client: Client, message: MoveMessage): Promise<void> {
    const current = this.state.players.get(client.sessionId)
    if (!current) return
    const currentPos: Position = { x: current.x, y: current.y }
    if (!isValidMove(currentPos, message.destination, INN_MOVE_SPEED)) {
      client.send('MOVE_REJECTED', { reason: 'out_of_range' })
      return
    }
    if (!isWalkable(THE_INN, message.destination)) {
      client.send('MOVE_REJECTED', { reason: 'blocked' })
      return
    }
    current.direction = getMovementDirection(currentPos, message.destination)
    current.x = message.destination.x
    current.y = message.destination.y
    this.broadcast('PLAYER_MOVED', { sessionId: client.sessionId, x: current.x, y: current.y, direction: current.direction })

    if (!this._combat) {
      // Auto-trigger dialog when player lands on NPC's front cell or adjacent to a door
      const dest: Position = { x: current.x, y: current.y }
      for (const npc of this.state.npcs) {
        const front = getFrontCell({ x: npc.x, y: npc.y }, npc.direction)
        if (dest.x === front.x && dest.y === front.y) {
          if (npc.role === 'doorkeeper') {
            const nearestDoor = [...this.state.doors].sort((a, b) =>
              (Math.abs(a.x - npc.x) + Math.abs(a.y - npc.y)) - (Math.abs(b.x - npc.x) + Math.abs(b.y - npc.y))
            )[0]
            client.send('INTERACTION_START', { type: 'npc', id: npc.id, name: npc.name, role: npc.role, biomeId: nearestDoor?.biomeId ?? '' })
          } else {
            client.send('INTERACTION_START', { type: 'npc', id: npc.id, name: npc.name, role: npc.role })
          }
          return
        }
      }
      for (const door of this.state.doors) {
        if (isAdjacent(dest, { x: door.x, y: door.y })) {
          client.send('INTERACTION_START', { type: 'door', id: door.id, biomeId: door.biomeId, label: door.label })
          return
        }
      }
    }

    if (!this._combat) {
      const encounter = this.enemyManager.onPlayerMove(current.x, current.y)
      if (encounter) {
        await this.startCombat(client, encounter)
      }
    } else if (!this._combatParticipants.has(client.sessionId)) {
      const cs = this._combat.getCombatState()
      const combatEnemies = cs.activeEnemyIds.map(id => cs.actors[id]).filter(Boolean)
      const pos = { x: current.x, y: current.y }
      const autoJoin = combatEnemies.some(e =>
        Math.abs(e.position.x - pos.x) + Math.abs(e.position.y - pos.y) === 1
      )
      if (autoJoin) {
        await this.handleJoinCombat(client)
      } else {
        const allActors = Object.values(cs.actors)
        const nearby = allActors.some(a =>
          Math.abs(a.position.x - pos.x) + Math.abs(a.position.y - pos.y) <= 4
        )
        if (nearby) client.send('COMBAT_JOIN_OFFER')
      }
    }
  }

  private async startCombat(client: Client, encounter: EncounterEvent): Promise<void> {
    const userData = client.userData as { heroIds?: string[] }
    const heroIds = userData?.heroIds ?? []
    if (heroIds.length === 0) return

    const current = this.state.players.get(client.sessionId)
    if (!current) return

    const heroActors = await buildPartyActors(heroIds, { x: current.x, y: current.y })
    if (heroActors.length === 0) return

    const enemyData = this.enemyManager.getEnemy(encounter.enemyId)
    if (!enemyData) return

    const enemyGroup = [{
      id: encounter.enemyId,
      name: encounter.enemyName,
      personality: 'wild' as const,
      characterClass: 'Enemy',
      die: 'd6' as const,
      hp: enemyData.hp,
      maxHp: enemyData.maxHp,
      energy: 10,
      maxEnergy: 10,
      speed: 3,
      position: { x: encounter.x, y: encounter.y },
      statusEffects: [] as string[],
      isNPC: true,
      abilities: [ENEMY_SLASH],
    }]

    client.send('ENCOUNTER', encounter)

    this._combat = new InPlaceCombatEngine(heroActors, [enemyGroup], THE_INN.walls, enemyData.level)
    this._combatParticipants.add(client.sessionId)
    this._combatHeroActorIds.set(client.sessionId, heroActors.map((a) => a.id))

    const initialState = this._combat.getCombatState()
    this.broadcast('COMBAT_START', initialState)

    if (!initialState.isPlayerTurn) {
      const npcResults = this._combat.endPlayerPhase()
      for (const r of npcResults) {
        if (Object.keys(r.hpDeltas).length > 0) this.broadcast('ACTION_RESULT', r)
      }
      if (this._combat.isOver()) { this.endCombat(); return }
      this.broadcast('COMBAT_STATE', this._combat.getCombatState())
    }
  }

  private async handleJoinCombat(client: Client): Promise<void> {
    if (!this._combat) return
    if (this._combatParticipants.has(client.sessionId)) return

    const userData = client.userData as { heroIds?: string[] }
    const heroIds = userData?.heroIds ?? []
    if (heroIds.length === 0) return

    const current = this.state.players.get(client.sessionId)
    if (!current) return

    const joinActors = await buildPartyActors(heroIds, { x: current.x, y: current.y })
    if (joinActors.length === 0) return

    for (const actor of joinActors) this._combat!.addActor(actor)

    this._combatParticipants.add(client.sessionId)
    this._combatHeroActorIds.set(client.sessionId, joinActors.map((a) => a.id))
    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  private handleCombatAction(client: Client, action: import('shared-types').Action): void {
    if (!this._combat) return
    const sessionHeroIds = this._combatHeroActorIds.get(client.sessionId) ?? []
    const cs = this._combat.getCombatState()
    const actorId = getActivePartyActorId(sessionHeroIds, cs, action.actorId)
    if (!actorId) return

    let actionResult: import('shared-types').ActionResult
    try {
      actionResult = this._combat.handlePlayerAction(actorId, action)
    } catch (e) {
      client.send('ACTION_REJECTED', { reason: e instanceof Error ? e.message : 'invalid action' })
      return
    }

    if (action.type === 'ability') {
      heroService.awardClassXp(actorId, action.ability.id, CLASS_XP_PER_COMBAT_USE).catch(() => {})
    }

    if (this._combat.isOver()) { this.endCombat(); return }
    this.broadcast('ACTION_RESULT', actionResult)
    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  private handleEndTurn(client: Client): void {
    if (!this._combat) return
    const sessionHeroIds = this._combatHeroActorIds.get(client.sessionId) ?? []
    const cs = this._combat.getCombatState()
    if (!getActivePartyActorId(sessionHeroIds, cs)) return

    const npcResults = this._combat.endPlayerPhase()
    for (const r of npcResults) {
      if (Object.keys(r.hpDeltas).length > 0) this.broadcast('ACTION_RESULT', r)
    }
    if (this._combat.isOver()) { this.endCombat(); return }
    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  private async endCombat(): Promise<void> {
    if (!this._combat) return
    const winningSide = this._combat.winningSide()
    const cs = this._combat.getCombatState()

    if (winningSide === 'players') {
      for (const enemyId of cs.activeEnemyIds) {
        if (this.state.enemies.has(enemyId)) {
          this.state.enemies.delete(enemyId)
        }
        this.enemyManager.removeEnemy(enemyId)
      }
      // Persist each hero's remaining HP
      await Promise.all(
        Object.values(cs.actors)
          .filter(a => !a.isNPC)
          .map(a => heroService.updateCurrentHp(a.id, a.hp))
      )
      this.broadcast('COMBAT_END', { result: 'win' })
    } else if (winningSide === null) {
      this.broadcast('COMBAT_END', { result: 'cancelled' })
    } else {
      const recoveryEndsAt = new Date(Date.now() + RECOVERY_HOURS * 60 * 60 * 1000).toISOString()
      const ghostHeroes = Object.values(cs.actors).filter(a => !a.isNPC && a.isGhost)
      await Promise.all(
        ghostHeroes.map(hero =>
          supabase
            .from('heroes')
            .update({ recovery_ends_at: recoveryEndsAt })
            .eq('id', hero.id)
        )
      )
      this.broadcast('COMBAT_END', { result: 'lose', recoveryEndsAt })
    }

    this._combat = null
    this._combatParticipants.clear()
    this._combatHeroActorIds.clear()
  }

  private handleInteract(client: Client): void {
    const pos = this.state.players.get(client.sessionId)
    if (!pos) return
    const playerPos: Position = { x: pos.x, y: pos.y }
    for (const npc of this.state.npcs) {
      if (isAdjacent(playerPos, { x: npc.x, y: npc.y })) {
        if (npc.role === 'doorkeeper') {
          const nearestDoor = [...this.state.doors].sort((a, b) =>
            (Math.abs(a.x - npc.x) + Math.abs(a.y - npc.y)) - (Math.abs(b.x - npc.x) + Math.abs(b.y - npc.y))
          )[0]
          client.send('INTERACTION_START', { type: 'npc', id: npc.id, name: npc.name, role: npc.role, biomeId: nearestDoor?.biomeId ?? '' })
        } else {
          client.send('INTERACTION_START', { type: 'npc', id: npc.id, name: npc.name, role: npc.role })
        }
        return
      }
    }
    for (const door of this.state.doors) {
      if (isAdjacent(playerPos, { x: door.x, y: door.y })) {
        client.send('INTERACTION_START', { type: 'door', id: door.id, biomeId: door.biomeId, label: door.label })
        return
      }
    }
  }
}
