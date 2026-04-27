import type { CombatState, Action, Position, ExploreMap } from 'shared-types'

export type PlaysetMode = 'explore' | 'combat' | 'vtt'

export interface EncounterEvent {
  position: Position
  zoneId: string
}

export interface BuildEvent {
  position: Position
  structureType: string
}

export interface Highlight {
  x: number
  y: number
  kind: 'move' | 'ability' | 'target' | 'drop' | 'dialog' | 'encounter'
}

export interface PlaysetBoardProps {
  mode: PlaysetMode
  roomId: string
  sceneJson?: string
  seed?: bigint
  combatState?: CombatState
  myActorId?: string
  validMoves?: Action[]
  highlights?: Highlight[]
  exploreMap?: ExploreMap
  onCellClick?: (x: number, y: number) => void
  onTokenMove?: (x: number, y: number) => void
  onTokenDrag?: (x: number, y: number) => void
  onTokenFace?: (direction: string) => void
  onTokenEmote?: (emote: string) => void
  onTokenSpeech?: (speech: string) => void
  onEncounter?: (e: EncounterEvent) => void
  onAction?: (a: Action) => void
  onBuild?: (e: BuildEvent) => void
}
