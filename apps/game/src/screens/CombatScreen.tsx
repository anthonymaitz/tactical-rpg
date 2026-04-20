import { PlaysetBoard } from 'playsets'
import type { CombatState, Action } from 'shared-types'

interface CombatScreenProps {
  combatState?: CombatState
  validMoves?: Action[]
  onAction?: (a: Action) => void
}

export function CombatScreen({ combatState, validMoves, onAction }: CombatScreenProps) {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <PlaysetBoard
        mode="combat"
        roomId="combat"
        combatState={combatState}
        validMoves={validMoves}
        onAction={onAction}
      />
    </div>
  )
}
