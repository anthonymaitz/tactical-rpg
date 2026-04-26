import type { Client } from '@colyseus/core'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { ExploreState, PlayerPosition, NpcEntity, DoorEntity, EnemyEntity } from '../schemas/ExploreState'
import { BaseRoom } from './BaseRoom'
import { EnemyManager } from './EnemyManager'
import { InPlaceCombatEngine } from './InPlaceCombatEngine'
import { isValidMove, isWalkable, isAdjacent, getFrontCell, getMovementDirection } from './logic/explore-logic'
import { heroService } from '../db/hero-service'
import { supabase } from '../db/supabase'
import { THE_INN, generateSceneFromInn } from 'shared-types'
import type { Position, SceneData, ActorState, AbilityDefinition, EncounterEvent } from 'shared-types'

interface MoveMessage {
  destination: Position
}

const INN_MOVE_SPEED = 10
const SCENE_SLUG = 'inn-main'
const RECOVERY_HOURS = 8

const ENEMY_SLASH: AbilityDefinition = {
  id: 'slash',
  name: 'Slash',
  energyCost: 3,
  diceNotation: { kind: 'notation', value: '1d4' },
  targetType: 'enemy',
  effect: 'damage',
  context: 'inCombat',
}

export class ExploreRoom extends BaseRoom<ExploreState> {
  private _sceneData: SceneData = generateSceneFromInn(THE_INN)
  private enemyManager!: EnemyManager
  private _realtimeChannel?: RealtimeChannel
  private _combat: InPlaceCombatEngine | null = null
  private _combatParticipants: Set<string> = new Set()
  private _combatHeroActorIds: Map<string, string> = new Map()

  async onCreate(): Promise<void> {
    this.setState(new ExploreState())

    const { data, error } = await supabase
      .from('scenes')
      .select('scene_data')
      .eq('slug', SCENE_SLUG)
      .maybeSingle()

    if (error) {
      console.warn(`[ExploreRoom] Failed to fetch scene '${SCENE_SLUG}':`, error.message)
    } else if (data?.scene_data) {
      this._sceneData = data.scene_data as SceneData
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

    this._realtimeChannel = supabase
      .channel(`scene-${SCENE_SLUG}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scenes', filter: `slug=eq.${SCENE_SLUG}` },
        () => { this.reloadScene() })
      .subscribe()

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

    this.onMessage('INTERACT', (client) => {
      this.handleInteract(client)
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
      })
    })

    this.onMessage<{ id: string; x: number; y: number }>('DRAG_UPDATE', (client, message) => {
      this.broadcast('DRAG_UPDATE', message, { except: client })
    })

    this.onMessage('READY', async (client) => {
      client.send('SCENE_STATE', this._sceneData)

      const userData = client.userData as { userId?: string; heroIds?: string[] }
      let heroIds = userData?.heroIds ?? []

      // If client session has no heroIds, resolve them from the authenticated user
      if (heroIds.length === 0 && userData.userId) {
        const heroes = await heroService.listHeroes(userData.userId)
        heroIds = heroes.map((h) => h.id)
        client.userData = { ...userData, heroIds } as typeof client.userData
      }

      if (heroIds.length === 0) return
      const hero = await heroService.getHero(heroIds[0])
      if (!hero) return
      const maxHp = hero.maxHp > 0 ? hero.maxHp : 10
      const hp = hero.currentHp !== null && hero.currentHp !== undefined ? hero.currentHp : maxHp
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
      })
    })
  }

  async onJoin(client: Client, options: { token?: string; heroIds?: string[] }): Promise<void> {
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
  }

  async onDispose(): Promise<void> {
    if (this._realtimeChannel) await supabase.removeChannel(this._realtimeChannel)
  }

  private async reloadScene(): Promise<void> {
    const { data } = await supabase
      .from('scenes')
      .select('scene_data')
      .eq('slug', SCENE_SLUG)
      .maybeSingle()
    if (!data?.scene_data) return
    this._sceneData = data.scene_data as SceneData

    this.state.npcs.splice(0)
    this.state.doors.splice(0)
    const enemyIds: string[] = []
    this.state.enemies.forEach((_, id) => enemyIds.push(id))
    for (const id of enemyIds) this.state.enemies.delete(id)

    for (const token of this._sceneData.tokens ?? []) {
      if (token.type === 'npc') {
        const entity = new NpcEntity()
        entity.id = token.id; entity.name = token.name ?? ''
        entity.role = token.role ?? ''; entity.x = token.col; entity.y = token.row
        entity.direction = token.direction ?? 's'
        this.state.npcs.push(entity)
      } else if (token.type === 'door') {
        const entity = new DoorEntity()
        entity.id = token.id; entity.biomeId = token.biomeId ?? ''
        entity.label = token.label ?? ''; entity.x = token.col; entity.y = token.row
        this.state.doors.push(entity)
      }
    }

    this.enemyManager = new EnemyManager(
      this.state.enemies,
      (partial) => Object.assign(new EnemyEntity(), partial),
      this._sceneData.tokens ?? [],
    )

    this.broadcast('SCENE_STATE', this._sceneData)
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

    if (!this._combat) {
      // Auto-trigger dialog when player lands on NPC's front cell or adjacent to a door
      const dest: Position = { x: current.x, y: current.y }
      for (const npc of this.state.npcs) {
        const front = getFrontCell({ x: npc.x, y: npc.y }, npc.direction)
        if (dest.x === front.x && dest.y === front.y) {
          client.send('INTERACTION_START', { type: 'npc', id: npc.id, name: npc.name, role: npc.role })
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
    const heroId = (userData?.heroIds ?? [])[0]
    if (!heroId) return

    const hero = await heroService.getHero(heroId)
    if (!hero) return

    const current = this.state.players.get(client.sessionId)
    if (!current) return

    const heroActor: ActorState = {
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
      position: { x: current.x, y: current.y },
      statusEffects: [],
      isNPC: false,
      abilities: hero.abilities,
    }

    const enemyData = this.enemyManager.getEnemy(encounter.enemyId)
    if (!enemyData) return

    const enemyActor: ActorState = {
      id: encounter.enemyId,
      name: encounter.enemyName,
      personality: 'wild',
      characterClass: 'Enemy',
      die: 'd6',
      hp: enemyData.hp,
      maxHp: enemyData.maxHp,
      energy: 10,
      maxEnergy: 10,
      speed: 3,
      position: { x: encounter.x, y: encounter.y },
      statusEffects: [],
      isNPC: true,
      abilities: [ENEMY_SLASH],
    }

    client.send('ENCOUNTER', encounter)

    this._combat = new InPlaceCombatEngine([heroActor, enemyActor], THE_INN.walls, enemyData.level)
    this._combatParticipants.add(client.sessionId)
    this._combatHeroActorIds.set(client.sessionId, hero.id)

    this.broadcast('COMBAT_START', this._combat.getCombatState())

    // Auto-process NPC turns if enemies go first
    const firstId = this._combat.getCombatState().turnQueue[0]
    if (this._combat.getCombatState().actors[firstId]?.isNPC) {
      this._combat.processNPCTurns()
      // Restore energy for the player who is now up after NPC turns
      const cs = this._combat.getCombatState()
      const playerId = cs.turnQueue[cs.currentActorIndex]
      if (playerId) this._combat.startTurn(playerId)
      this.broadcast('COMBAT_STATE', this._combat.getCombatState())
    }
  }

  private async handleJoinCombat(client: Client): Promise<void> {
    if (!this._combat) return
    if (this._combatParticipants.has(client.sessionId)) return

    const userData = client.userData as { heroIds?: string[] }
    const heroId = (userData?.heroIds ?? [])[0]
    if (!heroId) return

    const hero = await heroService.getHero(heroId)
    if (!hero) return

    const current = this.state.players.get(client.sessionId)
    if (!current) return

    const heroActor: ActorState = {
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
      position: { x: current.x, y: current.y },
      statusEffects: [],
      isNPC: false,
      abilities: hero.abilities,
    }

    this._combat.addActor(heroActor)
    this._combatParticipants.add(client.sessionId)
    this._combatHeroActorIds.set(client.sessionId, hero.id)
    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  private handleCombatAction(client: Client, action: import('shared-types').Action): void {
    if (!this._combat) return
    const heroId = this._combatHeroActorIds.get(client.sessionId)
    if (!heroId) return

    const cs = this._combat.getCombatState()
    const currentActorId = cs.turnQueue[cs.currentActorIndex]
    if (currentActorId !== heroId) return

    let actionResult: import('shared-types').ActionResult
    try {
      actionResult = this._combat.handlePlayerAction(heroId, action)
    } catch (e) {
      client.send('ACTION_REJECTED', { reason: e instanceof Error ? e.message : 'invalid action' })
      return
    }

    if (this._combat.isOver()) {
      this.endCombat()
      return
    }

    this.broadcast('ACTION_RESULT', actionResult)

    // Auto-advance if energy depleted
    const updatedActor = this._combat.getCombatState().actors[heroId]
    if (updatedActor && updatedActor.energy <= 0) {
      this.advanceCombatTurn()
      return
    }

    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  private handleEndTurn(client: Client): void {
    if (!this._combat) return
    const heroId = this._combatHeroActorIds.get(client.sessionId)
    if (!heroId) return
    const cs = this._combat.getCombatState()
    if (cs.turnQueue[cs.currentActorIndex] !== heroId) return
    this.advanceCombatTurn()
  }

  private advanceCombatTurn(): void {
    if (!this._combat) return
    this._combat.advanceTurn()

    // Skip ghost actors
    let safety = this._combat.getCombatState().turnQueue.length
    while (safety-- > 0) {
      const cs = this._combat.getCombatState()
      const actorId = cs.turnQueue[cs.currentActorIndex]
      const actor = cs.actors[actorId]
      if (!actor?.isGhost) break
      this._combat.advanceTurn()
    }

    const cs = this._combat.getCombatState()
    const nextId = cs.turnQueue[cs.currentActorIndex]
    this._combat.startTurn(nextId)

    if (cs.actors[nextId]?.isNPC) {
      const npcResults = this._combat.processNPCTurns()
      if (this._combat.isOver()) {
        this.endCombat()
        return
      }
      for (const npcResult of npcResults) {
        if (Object.keys(npcResult.hpDeltas).length > 0) {
          this.broadcast('ACTION_RESULT', npcResult)
        }
      }
      // Restore energy for the player who is now up after NPC turns
      const afterNPC = this._combat.getCombatState()
      const playerId = afterNPC.turnQueue[afterNPC.currentActorIndex]
      if (playerId) this._combat.startTurn(playerId)
    }

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
        client.send('INTERACTION_START', { type: 'npc', id: npc.id, name: npc.name, role: npc.role })
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
