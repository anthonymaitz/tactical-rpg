import { PlaysetBoard } from 'playsets'
import type { CombatState, Action } from 'shared-types'

interface CombatScreenProps {
  combatState?: CombatState
  validMoves?: Action[]
  onAction?: (a: Action) => void
}

export function CombatScreen(props: CombatScreenProps) {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <PlaysetBoard
        mode="combat"
        roomId="combat"
        combatState={props.combatState}
        validMoves={props.validMoves}
        onAction={props.onAction}
      />
    </div>
  )
}
