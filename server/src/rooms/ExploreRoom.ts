import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition, NpcEntity, DoorEntity } from '../schemas/ExploreState'
import { BaseRoom } from './BaseRoom'
import { isValidMove, isWalkable, isAdjacent } from './logic/explore-logic'
import { heroService } from '../db/hero-service'
import { THE_INN, STARTER_CLASSES } from 'shared-types'
import type { Position } from 'shared-types'

interface MoveMessage {
  destination: Position
}

const INN_MOVE_SPEED = 3

export class ExploreRoom extends BaseRoom<ExploreState> {
  onCreate(): void {
    this.setState(new ExploreState())

    for (const npc of THE_INN.npcs) {
      const entity = new NpcEntity()
      entity.id = npc.id
      entity.name = npc.name
      entity.role = npc.role
      entity.x = npc.x
      entity.y = npc.y
      this.state.npcs.push(entity)
    }

    for (const door of THE_INN.doors) {
      const entity = new DoorEntity()
      entity.id = door.id
      entity.biomeId = door.biomeId
      entity.label = door.label
      entity.x = door.x
      entity.y = door.y
      this.state.doors.push(entity)
    }

    this.onMessage<MoveMessage>('MOVE', (client, message) => {
      this.handleMove(client, message)
    })

    this.onMessage('INTERACT', (client) => {
      this.handleInteract(client)
    })

    this.onMessage('READY', async (client) => {
      const userData = client.userData as { heroIds?: string[] }
      const heroIds = userData?.heroIds ?? []
      if (heroIds.length === 0) return
      const hero = await heroService.getHero(heroIds[0])
      if (!hero) return
      const starterClass = STARTER_CLASSES.find((c) => c.name === hero.characterClass)
      const hp = hero.maxHp > 0 ? hero.maxHp : (starterClass?.maxHp ?? 10)
      client.send('HERO_STATE', {
        name: hero.name,
        class: hero.characterClass,
        personality: hero.personality,
        profession: '',
        die: hero.die,
        hp,
        combat: 'inGeneral',
        energy: Array(10).fill(true) as boolean[],
      })
    })
  }

  async onJoin(client: Client, options: { token?: string; heroIds?: string[] }): Promise<void> {
    await this.verifyToken(options.token)
    const pos = new PlayerPosition()
    pos.x = THE_INN.spawnX
    pos.y = THE_INN.spawnY
    pos.characterId = client.sessionId
    this.state.players.set(client.sessionId, pos)
    const heroIds = options.heroIds ?? []
    client.userData = { ...(client.userData ?? {}), heroIds }
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId)
  }

  private handleMove(client: Client, message: MoveMessage): void {
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

    current.x = message.destination.x
    current.y = message.destination.y
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
