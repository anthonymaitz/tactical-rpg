import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition, NpcEntity, DoorEntity, EnemyEntity } from '../schemas/ExploreState'
import { EnemyManager } from './EnemyManager'
import { EncounterRoom } from './EncounterRoom'
import { isValidMove, isWalkable, isAdjacent } from './logic/explore-logic'
import { heroService } from '../db/hero-service'
import { supabase } from '../db/supabase'
import { THE_INN, generateSceneFromInn, getFrontCell, getMovementDirection } from 'shared-types'
import type { Position, SceneData, ActorState, EncounterEvent } from 'shared-types'
import { weaponDamageBonus, ENEMY_SLASH } from './combat-constants'

interface MoveMessage {
  destination: Position
}

const INN_MOVE_SPEED = 10
const SCENE_SLUG = 'inn-main'

export class ExploreRoom extends EncounterRoom {
  private _sceneData: SceneData = generateSceneFromInn(THE_INN)

  protected getCombatWalls(): number[][] { return THE_INN.walls }

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

    this.registerCombatMessageHandlers()

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
    } else {
      this.checkCombatProximity(client, { x: current.x, y: current.y })
    }
  }

  private async startCombat(client: Client, encounter: EncounterEvent): Promise<void> {
    const enemyData = this.enemyManager.getEnemy(encounter.enemyId)
    if (!enemyData) return

    const enemyGroup: ActorState[] = [{
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
      statusEffects: [],
      isNPC: true,
      abilities: [ENEMY_SLASH],
    }]

    await this.beginCombat(client, encounter, [enemyGroup], enemyData.level)
  }

}
