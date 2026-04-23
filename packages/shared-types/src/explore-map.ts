export type ExploreTokenType = 'player' | 'npc' | 'door'

export interface ExploreToken {
  x: number
  y: number
  type: ExploreTokenType
  id: string
  label: string
  isMe?: boolean
}

export interface ExploreMap {
  walls: number[][]
  tokens: ExploreToken[]
}
