import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition, NpcEntity, DoorEntity, EnemyEntity } from '../schemas/ExploreState'
import { EnemyManager } from './EnemyManager'
import { EncounterRoom } from './EncounterRoom'
import { isWalkable } from './logic/explore-logic'
import { processMove } from './logic/move-handler'
import { heroService } from '../db/hero-service'
import { supabase } from '../db/supabase'
import { THE_INN, generateSceneFromInn } from 'shared-types'
import type { Position, SceneData, ActorState, EncounterEvent } from 'shared-types'
import { weaponDamageBonus, ENEMY_SLASH } from './combat-constants'

interface MoveMessage {
  destination: Position
}

const INN_MOVE_SPEED = 10
const SCENE_SLUG = 'inn-main'

export class ExploreRoom extends EncounterRoom {

  protected getCombatWalls(): number[][] { return THE_INN.walls }

  async onCreate(): Promise<void> {
    this._sceneData = generateSceneFromInn(THE_INN)
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

    this.onMessage('READY', (client) => this.handleReadyMessage(client, { healOnEnter: true }))
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

    const result = processMove({
      currentPos: { x: current.x, y: current.y },
      destination: message.destination,
      maxSpeed: INN_MOVE_SPEED,
      isWalkable: (pos) => isWalkable(THE_INN, pos),
      npcs: this.state.npcs,
      doors: this.state.doors,
      isCombatActive: !!this._combat,
    })

    if (result.type === 'rejected') {
      client.send('MOVE_REJECTED', { reason: result.reason })
      return
    }

    // Apply position update
    current.direction = result.direction
    current.x = result.newPos.x
    current.y = result.newPos.y
    this.broadcast('PLAYER_MOVED', { sessionId: client.sessionId, x: current.x, y: current.y, direction: current.direction })

    if ('interaction' in result) {
      client.send('INTERACTION_START', result.interaction)
      return
    }

    // encounterCheck: true — run enemy proximity check
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
