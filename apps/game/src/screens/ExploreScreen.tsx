import { createSignal, createMemo, Show } from 'solid-js'
import { THE_INN, generateSceneFromInn, getReachableCells, getMoveCost } from 'shared-types'
import type { ExploreMap, ExploreToken, SceneData, AbilityDefinition, Position } from 'shared-types'
import type { Panel } from 'click-comics'
import { createExploreRoom } from '../hooks/useExploreRoom'
import { ComicPlayer } from '../components/ComicPlayer'
import { SimpleQuestHUD, sampleContent } from 'simplequest-hud'
import { PlaysetBoard } from 'playsets'
import { token, heroIds } from '../session'
import { useNavigate } from '@solidjs/router'

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
  const navigate = useNavigate()
  const [showSheet, setShowSheet] = createSignal(false)
  const [selectedAbility, setSelectedAbility] = createSignal<AbilityDefinition | null>(null)

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

  const myHeroId = (): string | null => {
    const cs = state.combatState()
    if (!cs) return null
    const myPos = state.myPosition()
    if (!myPos) return null
    return Object.values(cs.actors).find(
      (a) => !a.isNPC && a.position.x === myPos.x && a.position.y === myPos.y,
    )?.id ?? null
  }

  const isMyTurn = (): boolean => {
    const cs = state.combatState()
    if (!cs) return false
    const heroId = myHeroId()
    return cs.turnQueue[cs.currentActorIndex] === heroId
  }

  const myActor = () => {
    const cs = state.combatState()
    const heroId = myHeroId()
    if (!cs || !heroId) return null
    return cs.actors[heroId] ?? null
  }

  const moveHighlights = createMemo((): Position[] => {
    if (!isMyTurn()) return []
    const actor = myActor()
    if (!actor) return []
    return getReachableCells(actor.position, THE_INN.walls, actor.energy)
  })

  const abilityHighlights = createMemo((): Position[] => {
    const ability = selectedAbility()
    const cs = state.combatState()
    if (!ability || !cs) return []
    const actor = myActor()
    if (!actor) return []
    return Object.values(cs.actors)
      .filter((a) => a.isNPC && a.hp > 0)
      .map((a) => a.position)
  })

  const highlights = createMemo(() => {
    if (!state.combatState()) return []
    const ability = selectedAbility()
    if (ability) {
      return abilityHighlights().map((p) => ({ x: p.x, y: p.y, kind: 'ability' as const }))
    }
    return moveHighlights().map((p) => ({ x: p.x, y: p.y, kind: 'move' as const }))
  })

  function handleTokenMove(x: number, y: number) {
    const cs = state.combatState()
    if (cs && isMyTurn()) {
      const actor = myActor()
      if (!actor) return
      const cost = getMoveCost(actor.position, { x, y }, THE_INN.walls)
      if (cost !== null && cost <= actor.energy) {
        state.sendAction({ type: 'move', actorId: actor.id, destination: { x, y } })
      }
      return
    }
    state.move({ x, y })
  }

  function handleCellClick(x: number, y: number) {
    const cs = state.combatState()
    if (cs && isMyTurn()) {
      const ability = selectedAbility()
      if (ability) {
        const actor = myActor()
        if (!actor) return
        const target = Object.values(cs.actors).find((a) => a.position.x === x && a.position.y === y)
        if (target && target.isNPC && target.hp > 0) {
          state.sendAction({ type: 'ability', actorId: actor.id, ability, targetIds: [target.id] })
          setSelectedAbility(null)
        }
      }
      return
    }
    // explore logic
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
      ...Object.values(state.enemies()).map((e) => ({
        x: e.x, y: e.y,
        type: 'enemy' as const,
        id: e.id,
        label: e.name,
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

  const currentCombatActor = createMemo(() => {
    const cs = state.combatState()
    if (!cs) return null
    return cs.actors[cs.turnQueue[cs.currentActorIndex]] ?? null
  })

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
              combatState={state.combatState() ?? undefined}
              myActorId={myHeroId() ?? undefined}
              highlights={highlights()}
              onCellClick={handleCellClick}
              onTokenMove={handleTokenMove}
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

          {/* Turn indicator — visible to all during combat */}
          <Show when={currentCombatActor()}>
            {(current) => (
              <div style={{
                position: 'absolute', top: '12px', left: '12px', 'z-index': '10',
                background: 'rgba(5,10,5,0.85)', border: '1px solid rgba(255,255,255,0.1)',
                'border-radius': '6px', padding: '6px 12px', 'font-size': '11px', color: '#aaa',
              }}>
                <span>{'⚔'} {current().name}{'\''}s turn {'·'} Round {state.combatState()?.round ?? 0}</span>
              </div>
            )}
          </Show>

          {/* Combat action bar — visible only to current actor on their turn */}
          <Show when={state.combatState() && isMyTurn()}>
            <div style={{
              position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: '8px', 'z-index': '10', 'align-items': 'center',
              background: 'rgba(5,10,5,0.9)', border: '1px solid rgba(255,255,255,0.1)',
              'border-radius': '8px', padding: '8px 14px',
            }}>
              <span style={{ 'font-size': '11px', color: '#fa0', 'margin-right': '6px' }}>
                {'⚡'} {myActor()?.energy ?? 0}/{myActor()?.maxEnergy ?? 0}
              </span>
              {(myActor()?.abilities ?? []).map((ability) => (
                <button
                  onClick={() => setSelectedAbility((a) => a?.id === ability.id ? null : ability)}
                  style={{
                    padding: '5px 10px', 'font-size': '11px',
                    background: selectedAbility()?.id === ability.id ? 'rgba(80,160,80,0.3)' : 'rgba(10,20,10,0.85)',
                    color: (myActor()?.energy ?? 0) >= ability.energyCost ? '#6f6' : '#444',
                    border: selectedAbility()?.id === ability.id ? '1px solid #6f6' : '1px solid rgba(255,255,255,0.1)',
                    'border-radius': '4px',
                    cursor: (myActor()?.energy ?? 0) >= ability.energyCost ? 'pointer' : 'not-allowed',
                  }}
                  disabled={(myActor()?.energy ?? 0) < ability.energyCost}
                >
                  {ability.name} {'⚡'}{ability.energyCost}
                </button>
              ))}
              <button
                onClick={() => { setSelectedAbility(null); state.endTurn() }}
                style={{
                  padding: '5px 10px', 'font-size': '11px', cursor: 'pointer',
                  background: 'rgba(10,10,20,0.85)', color: '#aaf',
                  border: '1px solid rgba(150,150,255,0.2)', 'border-radius': '4px',
                }}
              >
                End Turn
              </button>
            </div>
          </Show>

          {/* Join combat offer */}
          <Show when={state.joinOffer()}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              'z-index': '20', background: 'rgba(5,10,5,0.95)', border: '1px solid rgba(255,200,50,0.3)',
              'border-radius': '8px', padding: '20px 28px', 'text-align': 'center',
            }}>
              <div style={{ color: '#fa0', 'font-size': '14px', 'margin-bottom': '12px' }}>A battle is nearby!</div>
              <div style={{ display: 'flex', gap: '8px', 'justify-content': 'center' }}>
                <button onClick={state.joinCombat} style={{ padding: '6px 16px', background: 'rgba(80,160,80,0.2)', color: '#6f6', border: '1px solid #3a5a3a', 'border-radius': '4px', cursor: 'pointer' }}>Join</button>
                <button onClick={state.dismissJoinOffer} style={{ padding: '6px 16px', background: 'rgba(10,10,10,0.5)', color: '#666', border: '1px solid #333', 'border-radius': '4px', cursor: 'pointer' }}>Ignore</button>
              </div>
            </div>
          </Show>

          {/* Combat results overlay */}
          <Show when={state.combatResult()}>
            <div style={{
              position: 'absolute', inset: '0', 'z-index': '30', background: 'rgba(0,0,0,0.7)',
              display: 'flex', 'align-items': 'center', 'justify-content': 'center',
            }}>
              <div style={{ background: 'rgba(5,10,5,0.97)', border: '1px solid rgba(255,255,255,0.1)', 'border-radius': '10px', padding: '32px 40px', 'text-align': 'center', 'max-width': '360px' }}>
                <Show when={state.combatResult() === 'win'}>
                  <div style={{ color: '#6f6', 'font-size': '22px', 'margin-bottom': '8px' }}>Victory!</div>
                  <div style={{ color: '#888', 'font-size': '13px', 'margin-bottom': '20px' }}>The enemy has been defeated.</div>
                  <button onClick={state.dismissCombatResult} style={{ padding: '8px 24px', background: 'rgba(80,160,80,0.2)', color: '#6f6', border: '1px solid #3a5a3a', 'border-radius': '4px', cursor: 'pointer' }}>Continue</button>
                </Show>
                <Show when={state.combatResult() === 'lose'}>
                  <div style={{ color: '#f66', 'font-size': '22px', 'margin-bottom': '8px' }}>Defeated</div>
                  <div style={{ color: '#888', 'font-size': '13px', 'margin-bottom': '8px' }}>Your heroes need time to recover.</div>
                  <Show when={state.recoveryEndsAt()}>
                    <div style={{ color: '#666', 'font-size': '11px', 'margin-bottom': '16px' }}>
                      Available again: {new Date(state.recoveryEndsAt()!).toLocaleTimeString()}
                    </div>
                  </Show>
                  <button
                    onClick={() => { state.dismissCombatResult(); navigate('/') }}
                    style={{ padding: '8px 24px', background: 'rgba(160,50,50,0.2)', color: '#f88', border: '1px solid #5a3a3a', 'border-radius': '4px', cursor: 'pointer' }}
                  >
                    Return to Roster
                  </button>
                </Show>
              </div>
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

          {/* Action error toast */}
          <Show when={state.actionError()}>
            <div style={{
              position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
              'z-index': '30', background: 'rgba(180,40,40,0.92)', color: '#fcc',
              'border-radius': '6px', padding: '8px 18px', 'font-size': '12px',
              border: '1px solid rgba(255,100,100,0.3)', 'pointer-events': 'none',
            }}>
              {state.actionError()}
            </div>
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
