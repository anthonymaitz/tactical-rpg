import { useLocationRoom } from './useLocationRoom'
import type { Accessor } from 'solid-js'

export type { PlayerState, NpcState, DoorState, EnemyState, InteractionEvent } from './useLocationRoom'

export function createExploreRoom(
  token: Accessor<string | null>,
  heroIds: Accessor<string[]>,
) {
  return useLocationRoom({
    roomName: 'ExploreRoom',
    options: () => ({ token: token(), heroIds: heroIds() }),
    features: { combatJoinOffer: true },
  })
}
