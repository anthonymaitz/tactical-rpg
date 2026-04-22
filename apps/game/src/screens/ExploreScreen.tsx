// apps/game/src/screens/ExploreScreen.tsx
import { THE_INN } from 'shared-types'
import { useExploreRoom } from '../hooks/useExploreRoom'
import { InnView } from './InnView'

interface ExploreScreenProps {
  token?: string | null
  heroIds?: string[]
}

export function ExploreScreen({ token = null, heroIds = [] }: ExploreScreenProps) {
  const {
    connected,
    error,
    myPosition,
    mySessionId,
    players,
    npcs,
    doors,
    interaction,
    move,
    interact,
    dismissInteraction,
  } = useExploreRoom(token, heroIds)

  function handleCellClick(x: number, y: number) {
    if (!myPosition) return
    const isNpc = npcs.some((n) => n.x === x && n.y === y)
    const isDoor = doors.some((d) => d.x === x && d.y === y)
    const dist = Math.abs(myPosition.x - x) + Math.abs(myPosition.y - y)
    if ((isNpc || isDoor) && dist === 1) {
      interact()
    } else {
      move({ x, y })
    }
  }

  if (error) {
    return <div style={{ padding: 20, color: 'red' }}>Connection error: {error}</div>
  }

  if (!connected) {
    return <div style={{ padding: 20 }}>Connecting to The Inn…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, background: '#111', minHeight: '100vh', color: '#fff' }}>
      <h2 style={{ marginBottom: 16 }}>The Inn</h2>

      <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
        Click an adjacent NPC or door to interact · Click a floor tile to move
      </div>

      <InnView
        map={THE_INN}
        players={players}
        mySessionId={mySessionId}
        npcs={npcs}
        doors={doors}
        onCellClick={handleCellClick}
      />

      {myPosition && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#555' }}>
          ({myPosition.x}, {myPosition.y})
        </div>
      )}

      {interaction && (
        <div style={{
          marginTop: 20,
          padding: 20,
          background: '#1a1a2a',
          border: '1px solid #444',
          borderRadius: 8,
          maxWidth: 320,
          width: '100%',
        }}>
          {interaction.type === 'npc' && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 16 }}>{interaction.name}</div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 16 }}>
                {interaction.role === 'innkeeper'  && 'Welcome to the Inn! Your heroes rest and recover here between runs.'}
                {interaction.role === 'blacksmith' && 'I can help you equip your heroes when gear equipping arrives.'}
                {interaction.role === 'doorkeeper' && 'Ready to venture out? Walk up to the door when your party is ready.'}
              </div>
            </>
          )}
          {interaction.type === 'door' && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 16 }}>
                Enter {interaction.label}?
              </div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 16 }}>
                Biome exploration is coming in the next update.
              </div>
            </>
          )}
          <button onClick={dismissInteraction} style={{ padding: '6px 20px', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
