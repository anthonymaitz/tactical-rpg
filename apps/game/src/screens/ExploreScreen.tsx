import { createSignal, createMemo, Show } from 'solid-js'
import { THE_INN, generateSceneFromInn } from 'shared-types'
import type { ExploreMap, ExploreToken, SceneData } from 'shared-types'
import type { Panel } from 'click-comics'
import { createExploreRoom } from '../hooks/useExploreRoom'
import { ComicPlayer } from '../components/ComicPlayer'
import { SimpleQuestHUD, sampleContent } from 'simplequest-hud'
import { PlaysetBoard } from 'playsets'
import { token, heroIds } from '../session'

const NPC_PANELS: Record<string, Panel[]> = {
  innkeeper: [
    { speaker: 'Innkeeper', text: 'Welcome to the Inn! Your heroes rest and recover here between runs.' },
  ],
  blacksmith: [
    { speaker: 'Blacksmith', text: 'I can help you equip your heroes when gear equipping arrives.' },
  ],
  doorkeeper: [
    { speaker: 'Doorkeeper', text: 'Ready to venture out? Walk up to the door when your party is ready.' },
  ],
}

const DOOR_PANELS: Panel[] = [
  { speaker: 'The Door', text: 'Biome exploration is coming in the next update.' },
]

export function ExploreScreen() {
  const state = createExploreRoom(token, heroIds)
  const [showSheet, setShowSheet] = createSignal(false)
  const sceneJson = createMemo(() => {
    const sd: SceneData | null = state.sceneData()
    if (sd) return JSON.stringify(sd)
    return JSON.stringify(generateSceneFromInn(THE_INN))
  })
  const contentJson = JSON.stringify(sampleContent)
  const characterJson = () => {
    const h = state.heroState()
    return h ? JSON.stringify(h) : ''
  }

  function handleCellClick(x: number, y: number) {
    const pos = state.myPosition()
    if (!pos) return
    const isNpc = state.npcs().some((n) => n.x === x && n.y === y)
    const isDoor = state.doors().some((d) => d.x === x && d.y === y)
    const dist = Math.abs(pos.x - x) + Math.abs(pos.y - y)
    if ((isNpc || isDoor) && dist === 1) {
      state.interact()
    } else {
      state.move({ x, y })
    }
  }

  const exploreMap = (): ExploreMap => {
    const tokens: ExploreToken[] = [
      ...Object.entries(state.players()).map(([id, p]) => ({
        x: p.x, y: p.y,
        type: 'player' as const,
        id,
        label: id,
        isMe: id === state.mySessionId(),
      })),
      ...state.npcs().map((n) => ({
        x: n.x, y: n.y,
        type: 'npc' as const,
        id: n.id,
        label: n.name,
      })),
      ...state.doors().map((d) => ({
        x: d.x, y: d.y,
        type: 'door' as const,
        id: d.id,
        label: d.label,
      })),
    ]
    return { walls: THE_INN.walls, tokens }
  }

  const interactionPanels = (): Panel[] | null => {
    const ev = state.interaction()
    if (!ev) return null
    if (ev.type === 'npc') return NPC_PANELS[ev.role] ?? null
    if (ev.type === 'door') return DOOR_PANELS
    return null
  }

  const encounterPanels = (): Panel[] | null => {
    const ev = state.encounter()
    if (!ev) return null
    return [{ speaker: ev.enemyName, text: 'Blocks your path! Combat coming soon.' }]
  }

  return (
    <Show when={!state.error()} fallback={<div style={{ padding: '20px', color: 'red' }}>Connection error: {state.error()}</div>}>
      <Show when={state.connected()} fallback={<div style={{ padding: '20px', background: '#111', color: '#fff', 'min-height': '100vh' }}>Connecting to The Inn…</div>}>
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
          {/* Full-screen board */}
          <div style={{ position: 'absolute', inset: '0' }}>
            <PlaysetBoard
              mode="explore"
              roomId="inn"
              exploreMap={exploreMap()}
              sceneJson={sceneJson()}
              onCellClick={handleCellClick}
            />
          </div>

          {/* Top-right HUD button */}
          <div style={{ position: 'absolute', top: '12px', right: '12px', 'z-index': '10', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowSheet((v) => !v)}
              style={{ padding: '6px 14px', 'font-size': '12px', cursor: 'pointer', background: 'rgba(10,15,10,0.85)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', 'border-radius': '4px' }}
            >
              {showSheet() ? 'Hide Sheet' : 'Character Sheet'}
            </button>
          </div>

          {/* Character sheet slide-in panel */}
          <Show when={showSheet()}>
            <div style={{ position: 'absolute', top: '0', right: '0', bottom: '0', width: '480px', 'z-index': '10', overflow: 'auto', background: 'rgba(10,15,10,0.95)', 'border-left': '1px solid rgba(255,255,255,0.08)' }}>
              <SimpleQuestHUD content={contentJson} character={characterJson()} />
            </div>
          </Show>

          {/* Interaction comic panel — bottom center overlay */}
          <Show when={interactionPanels()}>
            {(panels) => (
              <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 'max-width': '480px', width: '100%', 'z-index': '10' }}>
                <ComicPlayer panels={panels()} onComplete={state.dismissInteraction} />
              </div>
            )}
          </Show>

          {/* Encounter comic panel — bottom center overlay */}
          <Show when={encounterPanels()}>
            {(panels) => (
              <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 'max-width': '480px', width: '100%', 'z-index': '10' }}>
                <ComicPlayer panels={panels()} onComplete={state.dismissEncounter} />
              </div>
            )}
          </Show>

          {/* Hint text — bottom left */}
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', 'font-size': '11px', color: 'rgba(255,255,255,0.3)', 'z-index': '10', 'pointer-events': 'none' }}>
            Click adjacent NPC or door to interact · Click floor to move
          </div>
        </div>
      </Show>
    </Show>
  )
}
