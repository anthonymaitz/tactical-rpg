import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema'

export class PlayerPosition extends Schema {
  @type('number') x: number = 0
  @type('number') y: number = 0
  @type('string') characterId: string = ''
  @type('string') direction: string = 's'
}

export class NpcEntity extends Schema {
  @type('string') id: string = ''
  @type('string') name: string = ''
  @type('string') role: string = ''
  @type('number') x: number = 0
  @type('number') y: number = 0
  @type('string') direction: string = 's'
}

export class DoorEntity extends Schema {
  @type('string') id: string = ''
  @type('string') biomeId: string = ''
  @type('string') label: string = ''
  @type('number') x: number = 0
  @type('number') y: number = 0
}

export class EnemyEntity extends Schema {
  @type('string') id: string = ''
  @type('string') name: string = ''
  @type('number') x: number = 0
  @type('number') y: number = 0
  @type('number') hp: number = 10
  @type('number') maxHp: number = 10
  @type('number') level: number = 1
  @type('boolean') fromSpawnPoint: boolean = false
}

export class ExploreState extends Schema {
  @type({ map: PlayerPosition }) players = new MapSchema<PlayerPosition>()
  @type([NpcEntity]) npcs = new ArraySchema<NpcEntity>()
  @type([DoorEntity]) doors = new ArraySchema<DoorEntity>()
  @type({ map: EnemyEntity }) enemies = new MapSchema<EnemyEntity>()
}
