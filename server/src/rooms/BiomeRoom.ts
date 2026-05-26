import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition, DoorEntity, EnemyEntity } from '../schemas/ExploreState'
import { EncounterRoom } from './EncounterRoom'
import { EnemyManager } from './EnemyManager'
import { processMove } from './logic/move-handler'
import { inventoryService } from '../db/inventory-service'
import { dropTableService } from '../db/drop-table-service'
import { getBiomeSpawns } from '../db/biome-service'
import type { SpawnPoint } from '../db/biome-service'
import type { Position, SceneData, ActorState, CombatState, EncounterEvent, LootResult } from 'shared-types'
import { ENEMY_SLASH } from './combat-constants'

interface MoveMessage {
  destination: Position
}

const BIOME_MOVE_SPEED = 10
const BIOME_SIZE = 100
const SPAWN_X = 50
const SPAWN_Y = 50

const BIOME_WEATHER: Record<string, string> = {
  'verdant-forest': 'sunny',
  'dungeon-depths': 'foggy',
  'ruined-castle':  'stormy',
}

// Radius within which a second enemy is pulled into the same encounter as a separate group
const MULTI_GROUP_RADIUS = 8

function makeBiomeSceneData(biomeId: string, spawnPoints: SpawnPoint[]): SceneData {
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
  private _biomeId = 'verdant-forest'
  private _combatEnemySlugs: Map<string, string> = new Map()
  private _spawnSlugMap: Map<string, string> = new Map()

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
    const spawns = await getBiomeSpawns(this._biomeId)
    this._spawnSlugMap = new Map(spawns.map(sp => [sp.id, sp.dropTableSlug]))
    this._sceneData = makeBiomeSceneData(this._biomeId, spawns)
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

    this.onMessage('READY', (client) => this.handleReadyMessage(client))
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

    const result = processMove({
      currentPos: { x: current.x, y: current.y },
      destination: message.destination,
      maxSpeed: BIOME_MOVE_SPEED,
      isWalkable: isBiomeWalkable,
      npcs: [],
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
      const nearSlug = this._spawnSlugMap.get(nearId.replace(/^spawned-/, ''))
      if (nearSlug) this._combatEnemySlugs.set(nearId, nearSlug)
    }

    // Track drop table slug for the triggering enemy
    const slug = this._spawnSlugMap.get(encounter.enemyId.replace(/^spawned-/, ''))
    if (slug) this._combatEnemySlugs.set(encounter.enemyId, slug)

    const enemyGroups = group1.length > 0 ? [group0, group1] : [group0]
    await this.beginCombat(client, encounter, enemyGroups, enemyData.level)
  }
}
