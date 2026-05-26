import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition, NpcEntity, DoorEntity, EnemyEntity } from '../schemas/ExploreState'
import { EnemyManager } from './EnemyManager'
import { EncounterRoom } from './EncounterRoom'
import { isWalkable as isWalkableCell } from './logic/explore-logic'
import { processMove } from './logic/move-handler'
import { chunkService } from '../db/chunk-service'
import type { Position, ActorState, EncounterEvent } from 'shared-types'
import { ENEMY_SLASH } from './combat-constants'

interface MoveMessage {
  destination: Position
}

const DUNGEON_MOVE_SPEED = 10

export class DungeonRoom extends EncounterRoom {
  private _walls: number[][] = []

  protected getCombatWalls(): number[][] {
    return this._walls
  }

  async onCreate(options: { chunkSlug: string }): Promise<void> {
    this.setState(new ExploreState())

    const meta = await chunkService.getChunk(options.chunkSlug)
    if (!meta) {
      console.warn(`[DungeonRoom] chunk '${options.chunkSlug}' not found — using empty scene`)
    } else {
      this._sceneData = meta.sceneData
      // Build wall grid from building tiles (wall value = 1 where a building tile exists)
      const walls: number[][] = []
      for (const building of this._sceneData.buildings) {
        const row = building.row
        const col = building.col
        if (!walls[row]) walls[row] = []
        walls[row][col] = 1
      }
      this._walls = walls
    }

    // Build NPC and door entities from scene tokens
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
        entity.destinationSlug = token.destinationSlug ?? ''
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

    this.onMessage<{ direction: string }>('FACE', (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (player) {
        player.direction = message.direction
        this.broadcast('PLAYER_MOVED', { sessionId: client.sessionId, x: player.x, y: player.y, direction: player.direction })
      }
    })

    this.registerCombatMessageHandlers()

    this.onMessage('READY', (client) => this.handleReadyMessage(client))
  }

  async onJoin(client: Client, options: { token?: string; heroIds?: string[]; chunkSlug?: string }): Promise<void> {
    console.log(`[DungeonRoom] onJoin ${client.sessionId} heroIds=${JSON.stringify(options.heroIds)}`)
    const userId = await this.verifyToken(options.token)

    // Spawn at first entryPoint token if present, else center of scene
    let spawnX = 8
    let spawnY = 8
    const entryToken = (this._sceneData.tokens ?? []).find((t) => t.type === 'spawn-point' && t.name?.toLowerCase().includes('entry'))
    if (entryToken) {
      spawnX = entryToken.col
      spawnY = entryToken.row
    }

    const pos = new PlayerPosition()
    pos.x = spawnX
    pos.y = spawnY
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
      maxSpeed: DUNGEON_MOVE_SPEED,
      isWalkable: (pos) => this.isDungeonWalkable(pos),
      npcs: this.state.npcs,
      doors: this.state.doors,
      isCombatActive: !!this._combat,
    })

    if (result.type === 'rejected') {
      client.send('MOVE_REJECTED', { reason: result.reason })
      return
    }

    current.direction = result.direction
    current.x = result.newPos.x
    current.y = result.newPos.y
    this.broadcast('PLAYER_MOVED', { sessionId: client.sessionId, x: current.x, y: current.y, direction: current.direction })

    if ('interaction' in result) {
      client.send('INTERACTION_START', result.interaction)
      return
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

  private isDungeonWalkable(pos: Position): boolean {
    if (this._walls.length === 0) return true
    return (this._walls[pos.y]?.[pos.x] ?? 0) === 0
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
