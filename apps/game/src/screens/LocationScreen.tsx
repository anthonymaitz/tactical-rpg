import { createSignal, createMemo, createEffect, on, For, Show } from 'solid-js'
import { THE_INN, generateSceneFromInn, getReachableCells, getMoveCost, getFrontCell } from 'shared-types'
import type { ExploreMap, ExploreToken, AbilityDefinition, Position, SceneData } from 'shared-types'
import type { Panel } from 'click-comics'
import { createHeroes } from '../hooks/useHeroes'
import { ComicPlayer } from '../components/ComicPlayer'
import { PartyPicker } from '../components/PartyPicker'
import { InventoryPanel } from '../components/InventoryPanel'
import { CombatResultModal } from '../components/CombatResultModal'
import { SecondaryClassModal } from '../components/SecondaryClassModal'
import { SimpleQuestHUD } from 'simplequest-hud'
import { useContent } from '../hooks/useContent'
import { PlaysetBoard } from 'playsets'
import { token, heroIds, setHeroIds } from '../session'
import { classToSpriteId } from '../lib/sprites'
import { useNavigate } from '@solidjs/router'
import type { useLocationRoom } from '../hooks/useLocationRoom'

// --- biome names (shared between ExploreScreen and BiomeScreen wrappers) ---
export const BIOME_NAMES: Record<string, string> = {
  'verdant-forest': 'Verdant Forest',
  'dungeon-depths': 'Dungeon Depths',
  'ruined-castle': 'Ruined Castle',
}

const SIDEBAR_WIDTH = 380

export type LocationConfig = {
  /** Pre-created hook instance — pass the return value of createExploreRoom / createBiomeRoom */
  state: ReturnType<typeof useLocationRoom>
  /** Inn only — NPC dialog panel map. When provided, NPC interaction rendering is enabled. */
  npcPanels?: Record<string, Panel[]>
  /** Biomes only — renders the initiative tracker overlay even when not in combat. */
  showInitiativeTracker?: boolean
  /** Biome display name — used in connecting indicator and room ID for PlaysetBoard. */
  biomeName?: string
  /** PlaysetBoard room ID. Defaults to "inn". */
  roomId?: string
  /** Walls used for movement calculations. Defaults to THE_INN.walls. */
  walls?: number[][]
  /** Default scene JSON when server has not yet sent SCENE_STATE. */
  defaultSceneJson?: string
  /** Show the extract-to-inn prompt when player reaches the biome spawn pad exit door. */
  showExtractPrompt?: boolean
  /** Hint text shown at bottom-left of the board. */
  hintText?: string
}

// Open biome — no walls
const NO_WALLS: number[][] = []

export function LocationScreen(props: { config: LocationConfig }) {
  const navigate = useNavigate()
  let boardEl: HTMLElement | undefined

  const heroRoster = createHeroes(token)
  const [partyPickerBiomeId, setPartyPickerBiomeId] = createSignal<string | null>(null)
  const [sidebarTab, setSidebarTab] = createSignal<'character' | 'inventory'>('character')
  const [showSecondaryModal, setShowSecondaryModal] = createSignal(false)

  const [selectedHeroId, setSelectedHeroId] = createSignal<string | null>(null)
  const [selectedAbility, setSelectedAbility] = createSignal<AbilityDefinition | null>(null)
  const [usedAbilityTitles, setUsedAbilityTitles] = createSignal<string[]>([])
  const [dragPos, setDragPos] = createSignal<Position | null>(null)

  type Doober = { id: string; text: string; color: string }
  const [doobers, setDoobers] = createSignal<Doober[]>([])

  // Derived helpers — use props.config.state so reactivity works
  const walls = (): number[][] => props.config.walls ?? THE_INN.walls
  const isInnMode = (): boolean => !!props.config.npcPanels

  // Clear used abilities when the player's energy resets to max — that only happens at turn start
  createEffect(on(
    () => myActor()?.energy ?? -1,
    (energy) => {
      const actor = myActor()
      if (actor && energy === actor.maxEnergy) setUsedAbilityTitles([])
    }
  ))

  // Spawn doobers when an action result arrives
  createEffect(on(
    () => props.config.state.actionResult(),
    (result) => {
      if (!result) return
      const cs = props.config.state.combatState()
      const newDoobers: Doober[] = []
      for (const [actorId, delta] of Object.entries(result.hpDeltas)) {
        if (delta === 0) continue
        const actor = cs?.actors[actorId]
        const name = actor?.name ?? actorId
        const rollText = result.rolls.length > 0 ? ` [${result.rolls.map((r) => r.total).join('+')}]` : ''
        newDoobers.push({
          id: `${Date.now()}-${actorId}-${Math.random()}`,
          text: delta < 0 ? `${name} ${delta}${rollText}` : `${name} +${delta}${rollText}`,
          color: delta < 0 ? '#f66' : '#6f6',
        })
      }
      if (newDoobers.length === 0) return
      setDoobers((prev) => [...prev, ...newDoobers])
      const ids = new Set(newDoobers.map((d) => d.id))
      setTimeout(() => setDoobers((prev) => prev.filter((d) => !ids.has(d.id))), 2500)
    }
  ))

  // Auto-dismiss encounter panel when combat begins
  createEffect(on(() => props.config.state.combatState(), (cs) => {
    if (cs) props.config.state.dismissEncounter()
  }))

  // Auto-close secondary class modal when hero's secondaryClass is set
  createEffect(on(() => props.config.state.heroMeta().secondaryClass, () => {
    setShowSecondaryModal(false)
  }, { defer: true }))

  // Forward server-broadcast events to board (for other clients' tokens)
  createEffect(on(props.config.state.emoteEvent, (ev) => {
    if (!ev || !boardEl || heroIds().includes(ev.id)) return
    boardEl.dispatchEvent(new CustomEvent('show-emote', { detail: { id: ev.id, emote: ev.emote } }))
  }))
  createEffect(on(props.config.state.speechEvent, (ev) => {
    if (!ev || !boardEl || heroIds().includes(ev.id)) return
    boardEl.dispatchEvent(new CustomEvent('show-speech', { detail: { id: ev.id, speech: ev.speech } }))
  }))
  createEffect(on(props.config.state.actionEvent, (ev) => {
    if (!ev || !boardEl || heroIds().includes(ev.id)) return
    boardEl.dispatchEvent(new CustomEvent('show-action', { detail: { id: ev.id, action: ev.action } }))
  }))

  // --- Scene JSON ---
  const defaultSceneJson = (): string => {
    if (props.config.defaultSceneJson) return props.config.defaultSceneJson
    if (isInnMode()) return JSON.stringify(generateSceneFromInn(THE_INN))
    return JSON.stringify({ buildings: [], layers: [{ id: 1, background: 'grass' }], props: [], tokens: [], weather: 'sunny' })
  }

  const sceneJson = createMemo((): string => {
    const sd: SceneData | null = props.config.state.sceneData()
    if (sd) return JSON.stringify(sd)
    return defaultSceneJson()
  })

  // --- Content JSON ---
  const sqContent = useContent()
  const contentJson = (): string => {
    const c = sqContent()
    if (!c) return '{}'
    if (!isInnMode()) return JSON.stringify(c)
    // Inn mode: inject secondary class abilities under the primary class source tab
    const secondaryClass = props.config.state.heroMeta().secondaryClass
    const primaryClass = props.config.state.heroState()?.class
    if (!secondaryClass || !primaryClass) return JSON.stringify(c)
    const label = secondaryClass.charAt(0).toUpperCase() + secondaryClass.slice(1)
    const injected = c.abilities
      .filter((a) => a.source === secondaryClass)
      .map((a) => ({ ...a, source: primaryClass, title: `${a.title} · ${label}` }))
    return JSON.stringify({ ...c, abilities: [...c.abilities, ...injected] })
  }

  // --- Hero / actor helpers ---
  const myHeroId = (): string | null => {
    const cs = props.config.state.combatState()
    if (!cs) return null
    const ids = heroIds()
    const sel = selectedHeroId()
    if (sel && ids.includes(sel) && cs.actors[sel] && !cs.actors[sel].isGhost) return sel
    return ids.find((id) => cs.actors[id] && !cs.actors[id].isGhost) ?? ids[0] ?? null
  }

  const isMyTurn = (): boolean => props.config.state.combatState()?.isPlayerTurn ?? false

  const myActor = () => {
    const cs = props.config.state.combatState()
    const heroId = myHeroId()
    if (!cs || !heroId) return null
    return cs.actors[heroId] ?? null
  }

  const characterJson = (): string => {
    const actor = myActor()
    const h = props.config.state.heroState()

    if (actor) {
      const energyArray = Array(10).fill(false).map((_, i) => i < actor.energy)
      const isLead = actor.id === heroIds()[0]
      const base = (isLead && h) ? h : {
        name: actor.name,
        class: actor.characterClass,
        personality: actor.personality,
        profession: '',
        die: actor.die,
      }
      const cs = props.config.state.combatState()
      if (!cs) return JSON.stringify({ ...base, hp: actor.hp, energy: energyArray, combat: 'inCombat' as const })
      return JSON.stringify({
        ...base,
        hp: actor.hp,
        energy: energyArray,
        combat: 'inCombat' as const,
        round: cs.round,
        selectedAbility: selectedAbility()?.name ?? null,
        usedAbilities: usedAbilityTitles(),
      })
    }

    if (h) return JSON.stringify(h)
    return ''
  }

  // --- Highlights ---
  const moveHighlights = createMemo((): Position[] => {
    if (!isMyTurn()) return []
    const actor = myActor()
    if (!actor) return []
    return getReachableCells(actor.position, walls(), actor.energy)
  })

  const abilityHighlights = createMemo((): Position[] => {
    const ability = selectedAbility()
    const cs = props.config.state.combatState()
    if (!ability || !cs) return []
    const actor = myActor()
    if (!actor) return []
    return Object.values(cs.actors)
      .filter((a) => a.isNPC && a.hp > 0)
      .map((a) => a.position)
  })

  const highlights = createMemo(() => {
    const dp = dragPos()
    if (props.config.state.combatState()) {
      const ability = selectedAbility()
      const base = ability
        ? abilityHighlights().map((p) => ({ x: p.x, y: p.y, kind: 'ability' as const }))
        : moveHighlights().map((p) => ({ x: p.x, y: p.y, kind: 'move' as const }))
      if (dp) return [...base, { x: dp.x, y: dp.y, kind: 'target' as const }]
      return base
    }
    if (!dp) return []
    if (isInnMode()) {
      // Inn explore mode: NPC dialog / door dialog / encounter highlights
      const isDialog = props.config.state.npcs().some((npc) => {
        const front = getFrontCell({ x: npc.x, y: npc.y }, npc.direction)
        return dp.x === front.x && dp.y === front.y
      }) || props.config.state.doors().some((d) => Math.abs(dp.x - d.x) + Math.abs(dp.y - d.y) === 1)
      const isEncounter = Object.values(props.config.state.enemies()).some(
        (e) => Math.abs(dp.x - e.x) + Math.abs(dp.y - e.y) <= 3
      )
      const kind = (isEncounter ? 'encounter' : isDialog ? 'dialog' : 'drop') as 'encounter' | 'dialog' | 'drop'
      return [{ x: dp.x, y: dp.y, kind }]
    }
    // Biome explore mode
    const isEncounter = Object.values(props.config.state.enemies()).some(
      (e) => Math.abs(dp.x - e.x) + Math.abs(dp.y - e.y) <= 3
    )
    return [{ x: dp.x, y: dp.y, kind: (isEncounter ? 'encounter' : 'drop') as 'encounter' | 'drop' }]
  })

  // --- Event handlers ---
  function handleItemActivate(id: string) {
    if (id === 'health_potion') props.config.state.usePotion()
  }

  function handleAbilityActivate(title: string) {
    if (!isMyTurn()) return
    const actor = myActor()
    if (!actor) return
    const ability = actor.abilities.find((a) => a.name === title)
    if (!ability) return
    setSelectedAbility((prev) => prev?.id === ability.id ? null : ability)
  }

  function handleTokenDrag(x: number, y: number, id: string) {
    const cs = props.config.state.combatState()
    if (cs && isMyTurn() && heroIds().includes(id)) setSelectedHeroId(id)
    setDragPos({ x, y })
  }

  function handleTokenFace(direction: string) {
    props.config.state.face(direction)
  }

  function handleTokenMove(x: number, y: number, id: string) {
    setDragPos(null)
    const cs = props.config.state.combatState()
    if (cs && isMyTurn()) {
      const ids = heroIds()
      const actorId = ids.includes(id) ? id : myHeroId()
      if (!actorId) return
      const actor = cs.actors[actorId]
      if (!actor) return
      if (ids.includes(id)) setSelectedHeroId(id)
      const cost = getMoveCost(actor.position, { x, y }, walls())
      if (cost !== null && cost <= actor.energy) {
        props.config.state.sendAction({ type: 'move', actorId: actor.id, destination: { x, y } })
      }
      return
    }
    props.config.state.move({ x, y })
  }

  function handleCellClick(x: number, y: number) {
    const cs = props.config.state.combatState()
    if (cs && isMyTurn()) {
      const ids = heroIds()
      const clickedHero = Object.values(cs.actors).find(
        (a) => !a.isNPC && ids.includes(a.id) && a.position.x === x && a.position.y === y && !a.isGhost
      )
      if (clickedHero) {
        setSelectedHeroId(clickedHero.id)
        setSelectedAbility(null)
        return
      }
      const ability = selectedAbility()
      const actor = myActor()
      if (!actor) return
      if (ability) {
        const target = Object.values(cs.actors).find((a) => a.position.x === x && a.position.y === y)
        if (target && target.isNPC && target.hp > 0) {
          props.config.state.sendAction({ type: 'ability', actorId: actor.id, ability, targetIds: [target.id] })
          setUsedAbilityTitles((prev) => [...prev, ability.name])
          setSelectedAbility(null)
        }
        return
      }
      const cost = getMoveCost(actor.position, { x, y }, walls())
      if (cost !== null && cost <= actor.energy) {
        props.config.state.sendAction({ type: 'move', actorId: actor.id, destination: { x, y } })
      }
      return
    }
    // Explore mode: clicks do nothing — drag to move, interaction triggers on landing
  }

  // --- Explore map ---
  const exploreMap = (): ExploreMap => {
    const myId = props.config.state.mySessionId()
    const serverPos = myId ? props.config.state.players()[myId] : null
    const predicted = props.config.state.predictedPos()
    // Use predicted position for local player's token when a move is in-flight
    const myPos = serverPos ? (predicted ? { ...serverPos, x: predicted.x, y: predicted.y } : serverPos) : null
    const partyIds = heroIds()
    const tokens: ExploreToken[] = [
      ...Object.entries(props.config.state.players()).map(([id, p]) => {
        const isMe = id === myId
        const tokenId = isMe ? (partyIds[0] ?? id) : id
        const displayPos = isMe && predicted ? predicted : p
        return {
          x: displayPos.x, y: displayPos.y,
          type: 'player' as const,
          id: tokenId,
          label: id,
          isMe,
          direction: p.direction,
          spriteId: isMe ? classToSpriteId(props.config.state.heroState()?.class) : undefined,
        }
      }),
      ...(myPos && partyIds.length > 1 ? partyIds.slice(1).map((heroId, i) => {
        const companion = heroRoster.heroes().find((h) => h.id === heroId)
        return {
          x: myPos.x,
          y: myPos.y + (i + 1),
          type: 'player' as const,
          id: heroId,
          label: companion?.name ?? heroId,
          isMe: false,
          direction: myPos.direction,
          spriteId: classToSpriteId(companion?.characterClass),
        }
      }) : []),
      // NPCs only in inn mode
      ...(isInnMode() ? props.config.state.npcs().map((n) => ({
        x: n.x, y: n.y,
        type: 'npc' as const,
        id: n.id,
        label: n.name,
        direction: n.direction,
      })) : []),
      ...props.config.state.doors().map((d) => ({
        x: d.x, y: d.y,
        type: 'door' as const,
        id: d.id,
        label: d.label,
      })),
      ...Object.values(props.config.state.enemies()).map((e) => ({
        x: e.x, y: e.y,
        type: 'enemy' as const,
        id: e.id,
        label: e.name,
      })),
    ]
    return { walls: walls(), tokens }
  }

  // --- Inn-specific: NPC + door interaction panels ---
  const interactionPanels = (): Panel[] | null => {
    const npcPanels = props.config.npcPanels
    if (!npcPanels) return null
    const ev = props.config.state.interaction()
    if (!ev) return null
    if (ev.type === 'npc') {
      if (ev.role === 'sage') {
        const meta = props.config.state.heroMeta()
        if (meta.level < 5) return npcPanels['sage_locked'] ?? null
        if (meta.secondaryClass) return npcPanels['sage_rechosen'] ?? null
        return npcPanels['sage_unlocked'] ?? null
      }
      return npcPanels[ev.role] ?? null
    }
    if (ev.type === 'door' && ev.biomeId) {
      const name = BIOME_NAMES[ev.biomeId] ?? ev.biomeId
      return [{ speaker: 'The Door', text: `Ready to venture into ${name}? Choose your party and step through.` }]
    }
    return null
  }

  function handleInteractionComplete() {
    const ev = props.config.state.interaction()
    if (ev?.type === 'npc' && ev.role === 'innkeeper') props.config.state.rest()
    if (ev?.type === 'door' && ev.biomeId) {
      void heroRoster.refresh()
      setPartyPickerBiomeId(ev.biomeId)
    }
    if (ev?.type === 'npc' && ev.role === 'sage' && props.config.state.heroMeta().level >= 5) {
      setShowSecondaryModal(true)
    }
    props.config.state.dismissInteraction()
  }

  // --- Biome-specific: extract prompt ---
  const extractPrompt = (): boolean => {
    if (!props.config.showExtractPrompt) return false
    const ev = props.config.state.interaction()
    return ev?.type === 'door' && ev.biomeId === 'inn'
  }

  // --- Encounter panels (shared) ---
  const encounterPanels = (): Panel[] | null => {
    const ev = props.config.state.encounter()
    if (!ev) return null
    return [{ speaker: 'Encounter!', text: `A ${ev.enemyName} blocks your path. Prepare for combat!` }]
  }

  // --- Hint text ---
  const hintText = (): string =>
    props.config.hintText ?? 'Drag your token to move'

  // --- Board room ID ---
  const roomId = (): string => props.config.roomId ?? 'inn'

  // --- Connecting label ---
  const connectingLabel = (): string =>
    props.config.biomeName ? `Entering ${props.config.biomeName}…` : 'Connecting to The Inn…'

  return (
    <Show when={!props.config.state.error()} fallback={<div style={{ padding: '20px', color: 'red' }}>Connection error: {props.config.state.error()}</div>}>
      <Show when={props.config.state.connected()} fallback={<div style={{ padding: '20px', background: '#111', color: '#fff', 'min-height': '100vh' }}>{connectingLabel()}</div>}>
        <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>

          {/* Board — fills remaining space left of sidebar */}
          <div style={{ position: 'relative', flex: '1 1 0', 'min-width': 0 }}>
            <PlaysetBoard
              mode={props.config.state.combatState() ? 'combat' : 'explore'}
              roomId={roomId()}
              exploreMap={exploreMap()}
              sceneJson={sceneJson()}
              combatState={props.config.state.combatState() ?? undefined}
              myActorId={myHeroId() ?? undefined}
              highlights={highlights()}
              onCellClick={handleCellClick}
              onTokenMove={handleTokenMove}
              onTokenDrag={handleTokenDrag}
              onTokenFace={handleTokenFace}
              onRef={(el) => { boardEl = el }}
              onTokenEmote={(emote) => props.config.state.emote(emote)}
              onTokenSpeech={(speech) => props.config.state.speech(speech)}
              onTokenAction={(action) => props.config.state.action(action)}
            />

            {/* Combat debug overlay */}
            <Show when={props.config.state.combatState()}>
              {(cs) => (
                <div style={{
                  position: 'absolute', bottom: '12px', left: '12px', 'z-index': '10',
                  background: 'rgba(0,0,0,0.75)', border: '1px solid #444',
                  'border-radius': '4px', padding: '4px 8px', 'font-size': '10px', color: '#0f0',
                  'font-family': 'monospace',
                }}>
                  {Object.values(cs().actors).map((a) => `${a.name}@${a.position.x},${a.position.y} hp:${a.hp}`).join(' | ')}
                </div>
              )}
            </Show>

            {/* Initiative tracker — shown in both inn combat and biomes */}
            <Show when={props.config.state.combatState()}>
              {(cs) => (
                <div style={{
                  position: 'absolute', top: '12px', left: '12px', 'z-index': '10',
                  background: 'rgba(5,10,5,0.88)', border: '1px solid rgba(255,255,255,0.1)',
                  'border-radius': '6px', padding: '6px 10px', 'font-size': '11px', color: '#aaa',
                  display: 'flex', 'flex-direction': 'column', gap: '4px', 'min-width': '140px',
                }}>
                  <div style={{ color: '#666', 'font-size': '10px', 'letter-spacing': '0.08em', 'text-transform': 'uppercase', 'margin-bottom': '2px' }}>
                    Round {cs().round}
                  </div>
                  <For each={cs().phases}>
                    {(phase, i) => (
                      <div style={{
                        display: 'flex', 'flex-direction': 'column', gap: '2px',
                        padding: '3px 6px', 'border-radius': '4px',
                        background: i() === cs().currentPhaseIndex ? 'rgba(100,200,100,0.15)' : 'transparent',
                        'border-left': i() === cs().currentPhaseIndex ? '2px solid rgba(100,200,100,0.6)' : '2px solid transparent',
                      }}>
                        <span style={{ color: i() === cs().currentPhaseIndex ? '#9f9' : '#666', 'font-weight': i() === cs().currentPhaseIndex ? '600' : '400' }}>
                          {phase.label}
                        </span>
                        <Show when={phase.isPlayers}>
                          <div style={{ display: 'flex', gap: '4px', 'flex-wrap': 'wrap' }}>
                            <For each={phase.actorIds.filter(id => heroIds().includes(id))}>
                              {(heroId) => {
                                const actor = cs().actors[heroId]
                                const isSelected = () => myHeroId() === heroId
                                return (
                                  <button
                                    onClick={() => setSelectedHeroId(heroId)}
                                    style={{
                                      padding: '1px 6px', 'font-size': '10px', cursor: 'pointer',
                                      background: isSelected() ? 'rgba(100,200,100,0.2)' : 'rgba(255,255,255,0.05)',
                                      color: actor?.isGhost ? '#444' : (isSelected() ? '#9f9' : '#888'),
                                      border: isSelected() ? '1px solid rgba(100,200,100,0.4)' : '1px solid rgba(255,255,255,0.1)',
                                      'border-radius': '3px',
                                      'text-decoration': actor?.isGhost ? 'line-through' : 'none',
                                    }}
                                  >
                                    {actor?.name ?? heroId}
                                  </button>
                                )
                              }}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              )}
            </Show>

            {/* Targeting prompt */}
            <Show when={selectedAbility()}>
              <div style={{
                position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                'z-index': '20', background: 'rgba(5,15,5,0.93)',
                border: '1px solid rgba(100,220,100,0.35)', 'border-radius': '8px',
                padding: '10px 20px', display: 'flex', 'align-items': 'center', gap: '12px',
              }}>
                <span style={{ color: '#9f9', 'font-size': '13px', 'font-weight': '600' }}>
                  Select a target for {selectedAbility()!.name}
                </span>
                <button
                  onClick={() => setSelectedAbility(null)}
                  style={{
                    background: 'none', border: '1px solid rgba(255,255,255,0.15)',
                    'border-radius': '4px', color: '#888', cursor: 'pointer',
                    'font-size': '11px', padding: '2px 8px',
                  }}
                >
                  cancel
                </button>
              </div>
            </Show>

            {/* Action error toast */}
            <Show when={props.config.state.actionError()}>
              <div style={{
                position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
                'z-index': '30', background: 'rgba(180,40,40,0.92)', color: '#fcc',
                'border-radius': '6px', padding: '8px 18px', 'font-size': '12px',
                border: '1px solid rgba(255,100,100,0.3)', 'pointer-events': 'none',
              }}>
                {props.config.state.actionError()}
              </div>
            </Show>

            {/* Doobers — floating damage/heal numbers */}
            <Show when={doobers().length > 0}>
              <style>{`
                @keyframes doober-rise {
                  0%   { opacity: 1; transform: translateY(0) scale(1); }
                  60%  { opacity: 1; }
                  100% { opacity: 0; transform: translateY(-80px) scale(0.8); }
                }
                .doober-item { animation: doober-rise 2.5s ease-out forwards; pointer-events: none; }
              `}</style>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                'z-index': '25', display: 'flex', 'flex-direction': 'column',
                gap: '6px', 'align-items': 'center', 'pointer-events': 'none',
              }}>
                <For each={doobers()}>
                  {(d) => (
                    <div class="doober-item" style={{
                      color: d.color, 'font-size': '20px', 'font-weight': '800',
                      'text-shadow': '0 2px 6px rgba(0,0,0,0.9)', 'white-space': 'nowrap',
                    }}>
                      {d.text}
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Join combat offer */}
            <Show when={props.config.state.joinOffer()}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                'z-index': '20', background: 'rgba(5,10,5,0.95)', border: '1px solid rgba(255,200,50,0.3)',
                'border-radius': '8px', padding: '20px 28px', 'text-align': 'center',
              }}>
                <div style={{ color: '#fa0', 'font-size': '14px', 'margin-bottom': '12px' }}>A battle is nearby!</div>
                <div style={{ display: 'flex', gap: '8px', 'justify-content': 'center' }}>
                  <button onClick={props.config.state.joinCombat} style={{ padding: '6px 16px', background: 'rgba(80,160,80,0.2)', color: '#6f6', border: '1px solid #3a5a3a', 'border-radius': '4px', cursor: 'pointer' }}>Join</button>
                  <button onClick={props.config.state.dismissJoinOffer} style={{ padding: '6px 16px', background: 'rgba(10,10,10,0.5)', color: '#666', border: '1px solid #333', 'border-radius': '4px', cursor: 'pointer' }}>Ignore</button>
                </div>
              </div>
            </Show>

            {/* Combat results overlay */}
            <CombatResultModal
              result={props.config.state.combatResult()}
              loot={props.config.state.combatLoot()}
              recoveryEndsAt={props.config.state.recoveryEndsAt()}
              onDismissWin={props.config.state.dismissCombatResult}
              onDismissLose={() => { props.config.state.dismissCombatResult(); navigate('/inn') }}
            />

            {/* Inn-specific: NPC / door interaction comic panel */}
            <Show when={interactionPanels()}>
              {(panels) => (
                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 'max-width': '480px', width: '100%', 'z-index': '10' }}>
                  <ComicPlayer panels={panels()} onComplete={handleInteractionComplete} />
                </div>
              )}
            </Show>

            {/* Inn-specific: secondary class modal — shown after sage interaction at level 5+ */}
            <Show when={showSecondaryModal()}>
              <SecondaryClassModal
                heroMeta={props.config.state.heroMeta}
                onSend={(className) => props.config.state.setSecondaryClass(className)}
                onClose={() => setShowSecondaryModal(false)}
                serverError={props.config.state.serverError}
              />
            </Show>

            {/* Inn-specific: party picker — shown after door comic completes */}
            <Show when={partyPickerBiomeId()}>
              {(biomeId) => (
                <PartyPicker
                  biomeId={biomeId()}
                  biomeName={BIOME_NAMES[biomeId()] ?? biomeId()}
                  heroes={heroRoster.heroes}
                  loading={heroRoster.loading}
                  onConfirm={(ids) => {
                    const bid = biomeId()
                    setPartyPickerBiomeId(null)
                    setHeroIds(ids)
                    navigate(`/biome/${bid}`)
                  }}
                  onCancel={() => setPartyPickerBiomeId(null)}
                />
              )}
            </Show>

            {/* Biome-specific: extract-to-inn prompt */}
            <Show when={extractPrompt()}>
              <div style={{
                position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                'z-index': '20', background: 'rgba(5,10,5,0.96)', border: '1px solid rgba(255,255,255,0.12)',
                'border-radius': '10px', padding: '18px 24px', display: 'flex', 'flex-direction': 'column',
                gap: '12px', 'min-width': '280px',
              }}>
                <div style={{ color: '#e0e0e0', 'font-size': '14px', 'font-weight': '600' }}>Return to the Inn?</div>
                <div style={{ color: '#888', 'font-size': '12px' }}>Your heroes will return with everything they've found.</div>
                <div style={{ display: 'flex', gap: '10px', 'justify-content': 'flex-end' }}>
                  <button
                    onClick={() => props.config.state.dismissInteraction()}
                    style={{ padding: '6px 16px', 'font-size': '12px', cursor: 'pointer', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.15)', 'border-radius': '5px' }}
                  >
                    Stay
                  </button>
                  <button
                    onClick={() => { props.config.state.dismissInteraction(); navigate('/inn') }}
                    style={{ padding: '6px 18px', 'font-size': '12px', 'font-weight': '600', cursor: 'pointer', background: 'rgba(80,180,100,0.2)', color: '#7de89a', border: '1px solid rgba(80,180,100,0.4)', 'border-radius': '5px' }}
                  >
                    Return to Inn
                  </button>
                </div>
              </div>
            </Show>

            {/* Encounter comic panel */}
            <Show when={encounterPanels()}>
              {(panels) => (
                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 'max-width': '480px', width: '100%', 'z-index': '10' }}>
                  <ComicPlayer panels={panels()} onComplete={props.config.state.dismissEncounter} />
                </div>
              )}
            </Show>

            {/* Hint text */}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', 'font-size': '11px', color: 'rgba(255,255,255,0.3)', 'z-index': '10', 'pointer-events': 'none' }}>
              {hintText()}
            </div>
          </div>

          {/* Right sidebar — tab switcher + content */}
          <div style={{
            width: `${SIDEBAR_WIDTH}px`, 'flex-shrink': '0', height: '100vh', overflow: 'hidden',
            background: 'rgba(8,12,8,0.97)', 'border-left': '1px solid rgba(255,255,255,0.07)',
            display: 'flex', 'flex-direction': 'column',
          }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', 'border-bottom': '1px solid rgba(255,255,255,0.07)', 'flex-shrink': '0' }}>
              {(['character', 'inventory'] as const).map((tab) => (
                <button
                  onClick={() => setSidebarTab(tab)}
                  style={{
                    flex: '1', padding: '8px', 'font-size': '11px', 'font-weight': '600',
                    cursor: 'pointer', border: 'none', 'letter-spacing': '0.05em',
                    'text-transform': 'uppercase',
                    background: sidebarTab() === tab ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: sidebarTab() === tab ? '#ccc' : '#555',
                    'border-bottom': sidebarTab() === tab ? '2px solid rgba(100,200,100,0.5)' : '2px solid transparent',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <Show when={sidebarTab() === 'character'}>
              <div style={{ flex: '1 1 0', overflow: 'hidden', display: 'flex', 'flex-direction': 'column', 'min-height': '0' }}>
                <SimpleQuestHUD
                  content={contentJson()}
                  character={characterJson()}
                  locked={true}
                  onAbilityActivate={handleAbilityActivate}
                  onItemActivate={handleItemActivate}
                />
                {/* Inn-specific: secondary class badge */}
                <Show when={isInnMode() && props.config.state.heroMeta().secondaryClass}>
                  <div style={{
                    'flex-shrink': '0', padding: '6px 14px',
                    'border-top': '1px solid rgba(192,128,255,0.15)',
                    background: 'rgba(192,128,255,0.06)',
                    display: 'flex', 'align-items': 'center', gap: '6px',
                  }}>
                    <span style={{ 'font-size': '10px', color: '#888', 'text-transform': 'uppercase', 'letter-spacing': '0.08em' }}>2nd class</span>
                    <span style={{ 'font-size': '12px', color: '#c080ff', 'font-weight': '600', 'text-transform': 'capitalize' }}>{props.config.state.heroMeta().secondaryClass}</span>
                  </div>
                </Show>
              </div>

              <Show when={props.config.state.combatState() && isMyTurn()}>
                <div style={{
                  'flex-shrink': '0', padding: '10px 14px',
                  'border-top': '1px solid rgba(255,255,255,0.07)',
                  display: 'flex', 'flex-direction': 'column', gap: '8px',
                }}>
                  <Show when={selectedAbility()}>
                    <div style={{ 'font-size': '11px', color: '#6f6', padding: '4px 0' }}>
                      {'▶'} {selectedAbility()!.name} selected — click an enemy to attack
                      <button
                        onClick={() => setSelectedAbility(null)}
                        style={{ 'margin-left': '8px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', 'font-size': '11px' }}
                      >
                        cancel
                      </button>
                    </div>
                  </Show>
                  <button
                    onClick={() => { setSelectedAbility(null); props.config.state.endTurn() }}
                    style={{
                      padding: '8px', 'font-size': '12px', cursor: 'pointer',
                      background: 'rgba(10,10,30,0.9)', color: '#aaf',
                      border: '1px solid rgba(150,150,255,0.25)', 'border-radius': '5px',
                      'font-weight': '600',
                    }}
                  >
                    End Turn
                  </button>
                </div>
              </Show>
            </Show>

            <Show when={sidebarTab() === 'inventory'}>
              <div style={{ flex: '1 1 0', 'min-height': '0', overflow: 'auto' }}>
                <InventoryPanel token={token} heroes={heroRoster.heroes} />
              </div>
            </Show>
          </div>

        </div>
      </Show>
    </Show>
  )
}
