import { Schema, MapSchema, type } from '@colyseus/schema'

export class PlayerPosition extends Schema {
  @type('number') x: number = 0
  @type('number') y: number = 0
  @type('string') characterId: string = ''
}

export class ExploreState extends Schema {
  @type({ map: PlayerPosition }) players = new MapSchema<PlayerPosition>()
}
