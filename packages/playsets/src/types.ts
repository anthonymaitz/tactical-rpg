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

export interface PlaysetBoardProps {
  mode: PlaysetMode
  roomId: string
  seed?: bigint
  combatState?: CombatState
  validMoves?: Action[]
  exploreMap?: ExploreMap
  onCellClick?: (x: number, y: number) => void
  onEncounter?: (e: EncounterEvent) => void
  onAction?: (a: Action) => void
  onBuild?: (e: BuildEvent) => void
}
