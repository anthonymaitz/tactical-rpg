import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition, DoorEntity, EnemyEntity } from '../schemas/ExploreState'
import { EncounterRoom } from './EncounterRoom'
import { EnemyManager } from './EnemyManager'
import { isValidMove, isAdjacent, getMovementDirection } from './logic/explore-logic'
import { heroService } from '../db/hero-service'
import { inventoryService } from '../db/inventory-service'
import { dropTableService } from '../db/drop-table-service'
import type { Position, SceneData, ActorState, CombatState, EncounterEvent, LootResult } from 'shared-types'
import { weaponDamageBonus, ENEMY_SLASH } from './combat-constants'

interface MoveMessage {
  destination: Position
}

const BIOME_MOVE_SPEED = 10
const BIOME_SIZE = 100
const SPAWN_X = 50
const SPAWN_Y = 50

type SpawnPoint = { id: string; col: number; row: number; name: string; level: number; spawnRadius: number; dropTableSlug: string; groupId: string | undefined }

const VERDANT_FOREST_SPAWNS: SpawnPoint[] = [
  // Close to entrance — easy to find for testing
  { id: 'sp-vf-test-1', col: 46, row: 44, name: 'Wolf',         level: 1, spawnRadius: 3, dropTableSlug: 'wolf',         groupId: undefined },
  { id: 'sp-vf-test-2', col: 53, row: 45, name: 'Wolf',         level: 1, spawnRadius: 3, dropTableSlug: 'wolf',         groupId: undefined },
  // Wolf pack: two wolves close together — forms two enemy groups in one encounter
  { id: 'sp-wolf-1',    col: 42, row: 42, name: 'Wolf',         level: 1, spawnRadius: 4, dropTableSlug: 'wolf',         groupId: 'wolves' },
  { id: 'sp-wolf-2',    col: 44, row: 43, name: 'Wolf',         level: 1, spawnRadius: 4, dropTableSlug: 'wolf',         groupId: 'wolves' },
  { id: 'sp-bandit-1',  col: 35, row: 50, name: 'Bandit',       level: 2, spawnRadius: 5, dropTableSlug: 'bandit',       groupId: undefined },
  { id: 'sp-bandit-2',  col: 62, row: 55, name: 'Bandit',       level: 2, spawnRadius: 5, dropTableSlug: 'bandit',       groupId: undefined },
  { id: 'sp-spirit-1',  col: 50, row: 38, name: 'Forest Spirit',level: 3, spawnRadius: 6, dropTableSlug: 'forest-spirit',groupId: undefined },
]

const DUNGEON_DEPTHS_SPAWNS: SpawnPoint[] = [
  // Close to entrance
  { id: 'sp-dd-test-1', col: 47, row: 44, name: 'Skeleton',     level: 2, spawnRadius: 3, dropTableSlug: 'bandit',       groupId: undefined },
  { id: 'sp-dd-test-2', col: 52, row: 45, name: 'Skeleton',     level: 2, spawnRadius: 3, dropTableSlug: 'bandit',       groupId: undefined },
  { id: 'sp-dd-skel-1', col: 38, row: 42, name: 'Skeleton',     level: 2, spawnRadius: 5, dropTableSlug: 'bandit',       groupId: 'skels' },
  { id: 'sp-dd-skel-2', col: 40, row: 44, name: 'Skeleton',     level: 2, spawnRadius: 5, dropTableSlug: 'bandit',       groupId: 'skels' },
  { id: 'sp-dd-spider', col: 60, row: 48, name: 'Giant Spider', level: 3, spawnRadius: 6, dropTableSlug: 'forest-spirit',groupId: undefined },
  { id: 'sp-dd-boss',   col: 50, row: 35, name: 'Dungeon Wraith',level: 4, spawnRadius: 4, dropTableSlug: 'forest-spirit',groupId: undefined },
]

const RUINED_CASTLE_SPAWNS: SpawnPoint[] = [
  // Close to entrance
  { id: 'sp-rc-test-1', col: 47, row: 43, name: 'Cursed Knight', level: 3, spawnRadius: 3, dropTableSlug: 'bandit',       groupId: undefined },
  { id: 'sp-rc-test-2', col: 53, row: 44, name: 'Cursed Knight', level: 3, spawnRadius: 3, dropTableSlug: 'bandit',       groupId: undefined },
  { id: 'sp-rc-guard-1',col: 36, row: 50, name: 'Cursed Knight', level: 3, spawnRadius: 5, dropTableSlug: 'bandit',       groupId: 'guards' },
  { id: 'sp-rc-guard-2',col: 38, row: 48, name: 'Cursed Knight', level: 3, spawnRadius: 5, dropTableSlug: 'bandit',       groupId: 'guards' },
  { id: 'sp-rc-wraith', col: 62, row: 52, name: 'Castle Wraith', level: 4, spawnRadius: 6, dropTableSlug: 'forest-spirit',groupId: undefined },
  { id: 'sp-rc-boss',   col: 50, row: 35, name: 'Lich Lord',     level: 5, spawnRadius: 4, dropTableSlug: 'forest-spirit',groupId: undefined },
]

const BIOME_SPAWNS: Record<string, SpawnPoint[]> = {
  'verdant-forest':  VERDANT_FOREST_SPAWNS,
  'dungeon-depths':  DUNGEON_DEPTHS_SPAWNS,
  'ruined-castle':   RUINED_CASTLE_SPAWNS,
}

const BIOME_WEATHER: Record<string, string> = {
  'verdant-forest': 'sunny',
  'dungeon-depths': 'foggy',
  'ruined-castle':  'stormy',
}

// Radius within which a second enemy is pulled into the same encounter as a separate group
const MULTI_GROUP_RADIUS = 8

const SPAWN_SLUG_MAP = new Map<string, string>(
  [...VERDANT_FOREST_SPAWNS, ...DUNGEON_DEPTHS_SPAWNS, ...RUINED_CASTLE_SPAWNS]
    .map(sp => [sp.id, sp.dropTableSlug])
)

function makeBiomeSceneData(biomeId: string): SceneData {
  const spawnPoints = BIOME_SPAWNS[biomeId] ?? []
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
    weather: BIOME_WEATHER[biomeId] ?? 'sunny',
  }
}

function isBiomeWalkable(pos: Position): boolean {
  return pos.x >= 0 && pos.x < BIOME_SIZE && pos.y >= 0 && pos.y < BIOME_SIZE
}

export class BiomeRoom extends EncounterRoom {
  private _sceneData!: SceneData
  private _biomeId = 'verdant-forest'
  private _combatEnemySlugs: Map<string, string> = new Map()

  protected async onCombatWin(cs: CombatState): Promise<Record<string, unknown>> {
    const drops = await Promise.all(
      cs.activeEnemyIds.map((enemyId) => {
        const slug = this._combatEnemySlugs.get(enemyId)
        return slug ? dropTableService.rollDrops(slug) : null
      })
    )
    const loot = drops.filter(Boolean).reduce<LootResult>(
      (acc, d) => ({
        gold: acc.gold + d!.gold,
        healthPotions: acc.healthPotions + d!.healthPotions,
        starFragments: acc.starFragments + d!.starFragments,
        decorShards: acc.decorShards + d!.decorShards,
        builderPropIds: [...acc.builderPropIds, ...d!.builderPropIds],
      }),
      { gold: 0, healthPotions: 0, starFragments: 0, decorShards: 0, builderPropIds: [] }
    )
    await Promise.all(
      [...this._combatHeroActorIds.entries()].map(async ([sessionId]) => {
        const userData = this.clients.find(c => c.sessionId === sessionId)?.userData as { userId?: string } | undefined
        if (userData?.userId) await inventoryService.addLoot(userData.userId, loot)
      })
    )
    return { loot }
  }

  protected onCombatCleanup(): void {
    this._combatEnemySlugs.clear()
  }

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

    this.registerCombatMessageHandlers()

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
        starRating: hero.starRating ?? 0,
        gear: hero.gear ? { weapon: hero.gear.weapon ?? null, weaponBonus: weaponDamageBonus(hero.gear.weapon) } : undefined,
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
    this.broadcast('PLAYER_LEFT', { sessionId: client.sessionId })
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
    this.broadcast('PLAYER_MOVED', { sessionId: client.sessionId, x: current.x, y: current.y, direction: current.direction })

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
    } else {
      this.checkCombatProximity(client, { x: current.x, y: current.y })
    }
  }

  private async startCombat(client: Client, encounter: EncounterEvent): Promise<void> {
    const enemyData = this.enemyManager.getEnemy(encounter.enemyId)
    if (!enemyData) return

    const makeEnemyActor = (id: string, name: string, data: typeof enemyData, pos: { x: number; y: number }): ActorState => ({
      id,
      name,
      personality: 'wild' as const,
      characterClass: 'Enemy',
      die: 'd6' as const,
      hp: data.hp,
      maxHp: data.maxHp,
      energy: 10,
      maxEnergy: 10,
      speed: 3,
      position: pos,
      statusEffects: [],
      isNPC: true,
      abilities: [ENEMY_SLASH],
    })

    const group0 = [makeEnemyActor(encounter.enemyId, encounter.enemyName, enemyData, { x: encounter.x, y: encounter.y })]

    // Pull nearby enemies (within MULTI_GROUP_RADIUS) into a second group
    const nearbyEnemyIds = this.enemyManager.getEnemiesNear(
      encounter.x, encounter.y, MULTI_GROUP_RADIUS, encounter.enemyId
    )
    const group1: ActorState[] = []
    for (const nearId of nearbyEnemyIds) {
      const nearData = this.enemyManager.getEnemy(nearId)
      if (!nearData) continue
      group1.push(makeEnemyActor(nearId, nearData.name, nearData, { x: nearData.x, y: nearData.y }))
      const nearSlug = SPAWN_SLUG_MAP.get(nearId.replace(/^spawned-/, ''))
      if (nearSlug) this._combatEnemySlugs.set(nearId, nearSlug)
    }

    // Track drop table slug for the triggering enemy
    const slug = SPAWN_SLUG_MAP.get(encounter.enemyId.replace(/^spawned-/, ''))
    if (slug) this._combatEnemySlugs.set(encounter.enemyId, slug)

    const enemyGroups = group1.length > 0 ? [group0, group1] : [group0]
    await this.beginCombat(client, encounter, enemyGroups, enemyData.level)
  }
}
