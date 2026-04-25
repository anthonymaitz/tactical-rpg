export type ExploreTokenType = 'player' | 'npc' | 'door' | 'enemy'

export interface ExploreToken {
  x: number
  y: number
  type: ExploreTokenType
  id: string
  label: string
  isMe?: boolean
  direction?: string
}

export interface ExploreMap {
  walls: number[][]
  tokens: ExploreToken[]
}
