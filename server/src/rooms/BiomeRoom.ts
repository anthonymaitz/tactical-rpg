import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition, DoorEntity, EnemyEntity } from '../schemas/ExploreState'
import { BaseRoom } from './BaseRoom'
import { EnemyManager } from './EnemyManager'
import { InPlaceCombatEngine } from './InPlaceCombatEngine'
import { isValidMove, isAdjacent, getMovementDirection } from './logic/explore-logic'
import { heroService } from '../db/hero-service'
import { inventoryService } from '../db/inventory-service'
import { dropTableService } from '../db/drop-table-service'
import { supabase } from '../db/supabase'
import type { Position, SceneData, ActorState, AbilityDefinition, EncounterEvent, LootResult } from 'shared-types'
import { WEAPON_DAMAGE_BONUSES } from 'shared-types'

interface MoveMessage {
  destination: Position
}

const BIOME_MOVE_SPEED = 10
const BIOME_SIZE = 100
const SPAWN_X = 50
const SPAWN_Y = 50
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

// Hardcoded spawn points for Verdant Forest MVP — scattered around the spawn pad
const VERDANT_FOREST_SPAWNS = [
  { id: 'sp-wolf-1',   col: 42, row: 42, name: 'Wolf',         level: 1, spawnRadius: 4, dropTableSlug: 'wolf' },
  { id: 'sp-wolf-2',   col: 58, row: 44, name: 'Wolf',         level: 1, spawnRadius: 4, dropTableSlug: 'wolf' },
  { id: 'sp-bandit-1', col: 35, row: 50, name: 'Bandit',       level: 2, spawnRadius: 5, dropTableSlug: 'bandit' },
  { id: 'sp-bandit-2', col: 62, row: 55, name: 'Bandit',       level: 2, spawnRadius: 5, dropTableSlug: 'bandit' },
  { id: 'sp-spirit-1', col: 50, row: 38, name: 'Forest Spirit',level: 3, spawnRadius: 6, dropTableSlug: 'forest-spirit' },
]

const SPAWN_SLUG_MAP = new Map<string, string>(
  VERDANT_FOREST_SPAWNS.map(sp => [sp.id, sp.dropTableSlug])
)

function makeBiomeSceneData(biomeId: string): SceneData {
  const spawnPoints = biomeId === 'verdant-forest' ? VERDANT_FOREST_SPAWNS : []
  return {
    buildings: [],
    layers: [{ id: 1, background: 'grass' }],
    props: [],
    tokens: [
      {
        id: 'spawn-pad',
        type: 'door',
        col: SPAWN_X,
        row: SPAWN_Y,
        biomeId: 'inn',
        label: 'Return to Inn',
      },
      ...spawnPoints.map(sp => ({
        id: sp.id,
        type: 'spawn-point' as const,
        col: sp.col,
        row: sp.row,
        name: sp.name,
        level: sp.level,
        spawnRadius: sp.spawnRadius,
      })),
    ],
    weather: 'sunny',
  }
}

function weaponDamageBonus(weapon: string | null | undefined): number {
  if (!weapon) return 0
  return WEAPON_DAMAGE_BONUSES[weapon] ?? 0
}

function isBiomeWalkable(pos: Position): boolean {
  return pos.x >= 0 && pos.x < BIOME_SIZE && pos.y >= 0 && pos.y < BIOME_SIZE
}

export class BiomeRoom extends BaseRoom<ExploreState> {
  private _sceneData!: SceneData
  private _biomeId = 'verdant-forest'
  private enemyManager!: EnemyManager
  private _combat: InPlaceCombatEngine | null = null
  private _combatParticipants: Set<string> = new Set()
  private _combatHeroActorIds: Map<string, string> = new Map()
  private _combatEnemySlugs: Map<string, string> = new Map()

  async onCreate(options: { biomeId?: string } = {}): Promise<void> {
    this._biomeId = options.biomeId ?? 'verdant-forest'
    this._sceneData = makeBiomeSceneData(this._biomeId)
    this.setState(new ExploreState())

    const pad = new DoorEntity()
    pad.id = 'spawn-pad'
    pad.biomeId = 'inn'
    pad.label = 'Return to Inn'
    pad.x = SPAWN_X
    pad.y = SPAWN_Y
    this.state.doors.push(pad)

    this.enemyManager = new EnemyManager(
      this.state.enemies,
      (partial) => Object.assign(new EnemyEntity(), partial),
      this._sceneData.tokens,
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

    this.onMessage('USE_POTION', async (client) => {
      await this.handleUsePotion(client)
    })

    this.onMessage<{ direction: string }>('FACE', (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.direction = message.direction
    })

    this.onMessage('READY', async (client) => {
      client.send('SCENE_STATE', this._sceneData)

      const userData = client.userData as { userId?: string; heroIds?: string[] }
      let heroIds = userData?.heroIds ?? []

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

  async onJoin(client: Client, options: { token?: string; heroIds?: string[]; biomeId?: string }): Promise<void> {
    const userId = await this.verifyToken(options.token)
    const pos = new PlayerPosition()
    // Spawn 2 steps north of the pad so the player is not immediately adjacent
    pos.x = SPAWN_X
    pos.y = SPAWN_Y - 2
    pos.characterId = client.sessionId
    this.state.players.set(client.sessionId, pos)
    client.userData = { userId, heroIds: options.heroIds ?? [] }
  }

  onLeave(client: Client): void {
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)
    }
  }

  private async handleMove(client: Client, message: MoveMessage): Promise<void> {
    const current = this.state.players.get(client.sessionId)
    if (!current) return
    const currentPos: Position = { x: current.x, y: current.y }

    if (!isValidMove(currentPos, message.destination, BIOME_MOVE_SPEED)) {
      client.send('MOVE_REJECTED', { reason: 'out_of_range' })
      return
    }
    if (!isBiomeWalkable(message.destination)) {
      client.send('MOVE_REJECTED', { reason: 'blocked' })
      return
    }

    current.direction = getMovementDirection(currentPos, message.destination)
    current.x = message.destination.x
    current.y = message.destination.y

    if (!this._combat) {
      const dest: Position = { x: current.x, y: current.y }
      for (const door of this.state.doors) {
        if (isAdjacent(dest, { x: door.x, y: door.y })) {
          client.send('INTERACTION_START', { type: 'door', id: door.id, biomeId: door.biomeId, label: door.label })
          return
        }
      }

      const encounter = this.enemyManager.onPlayerMove(current.x, current.y)
      if (encounter) {
        await this.startCombat(client, encounter)
        return
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
      damageBonus: weaponDamageBonus(hero.gear?.weapon),
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

    // Open biome — no walls for combat
    this._combat = new InPlaceCombatEngine([heroActor, enemyActor], [], enemyData.level)
    this._combatParticipants.add(client.sessionId)
    this._combatHeroActorIds.set(client.sessionId, hero.id)

    // Track drop table slug for this enemy (id = spawned-<spawnPointId>)
    const spawnPointId = encounter.enemyId.replace(/^spawned-/, '')
    const slug = SPAWN_SLUG_MAP.get(spawnPointId)
    if (slug) this._combatEnemySlugs.set(encounter.enemyId, slug)

    this.broadcast('COMBAT_START', this._combat.getCombatState())

    const firstId = this._combat.getCombatState().turnQueue[0]
    if (this._combat.getCombatState().actors[firstId]?.isNPC) {
      this._combat.processNPCTurns()
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
      damageBonus: weaponDamageBonus(hero.gear?.weapon),
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
    if (cs.turnQueue[cs.currentActorIndex] !== heroId) return

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
      const afterNPC = this._combat.getCombatState()
      const playerId = afterNPC.turnQueue[afterNPC.currentActorIndex]
      if (playerId) this._combat.startTurn(playerId)
    }

    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  private async handleUsePotion(client: Client): Promise<void> {
    if (!this._combat) return
    const heroId = this._combatHeroActorIds.get(client.sessionId)
    if (!heroId) return

    const cs = this._combat.getCombatState()
    if (cs.turnQueue[cs.currentActorIndex] !== heroId) {
      client.send('ACTION_REJECTED', { reason: 'not_your_turn' })
      return
    }

    const actor = cs.actors[heroId]
    if (!actor) return
    if (actor.energy < 1) {
      client.send('ACTION_REJECTED', { reason: 'insufficient_energy' })
      return
    }

    const heroInv = await inventoryService.getHeroInventory(heroId)
    if (heroInv.healthPotions <= 0) {
      client.send('ACTION_REJECTED', { reason: 'no_potions' })
      return
    }

    const healAmount = actor.maxHp - actor.hp
    this._combat.applyHeal(heroId, healAmount, 1)
    await inventoryService.useHeroPotion(heroId)
    this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }

  private async endCombat(): Promise<void> {
    if (!this._combat) return
    const winningSide = this._combat.winningSide()
    const cs = this._combat.getCombatState()

    if (winningSide === 'players') {
      for (const enemyId of cs.activeEnemyIds) {
        if (this.state.enemies.has(enemyId)) this.state.enemies.delete(enemyId)
        this.enemyManager.removeEnemy(enemyId)
      }

      // Roll loot drops from all defeated enemies
      const loot: LootResult = { gold: 0, healthPotions: 0, starFragments: 0, decorShards: 0, builderPropIds: [] }
      await Promise.all(
        cs.activeEnemyIds.map(async (enemyId) => {
          const slug = this._combatEnemySlugs.get(enemyId)
          if (!slug) return
          const dropped = await dropTableService.rollDrops(slug)
          loot.gold += dropped.gold
          loot.healthPotions += dropped.healthPotions
          loot.starFragments += dropped.starFragments
          loot.decorShards += dropped.decorShards
          loot.builderPropIds.push(...dropped.builderPropIds)
        })
      )

      // Award loot and save HP for all hero participants
      const heroActors = Object.values(cs.actors).filter(a => !a.isNPC)
      await Promise.all([
        ...heroActors.map(a => heroService.updateCurrentHp(a.id, a.hp)),
        ...[...this._combatHeroActorIds.entries()].map(async ([sessionId, _heroId]) => {
          const userData = this.clients.find(c => c.sessionId === sessionId)?.userData as { userId?: string } | undefined
          if (userData?.userId) {
            await inventoryService.addLoot(userData.userId, loot)
          }
        }),
      ])

      this.broadcast('COMBAT_END', { result: 'win', loot })
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
    this._combatEnemySlugs.clear()
  }
}
