import { createSignal, createResource, onMount, onCleanup, Show, For } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { supabase } from '../lib/supabase'
import 'playsets-board'
import type { SceneData, SceneChunkMeta } from 'shared-types'
import { listChunks, getChunk, upsertChunk } from '../services/chunk-service'

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'playsets-board': {
        ref?: HTMLElement
        'attr:scene'?: string
        'attr:entities'?: string
        'attr:mode'?: string
        'attr:highlights'?: string
        style?: string
      }
    }
  }
}

const BIOME_TAG_OPTIONS = [
  { id: 'verdant-forest', label: 'Verdant Forest' },
  { id: 'dungeon-depths', label: 'Dungeon Depths' },
  { id: 'ruined-castle', label: 'Ruined Castle' },
]

const EMPTY_SCENE: SceneData = {
  buildings: [],
  layers: [{ id: 1, background: 'grass' }],
  props: [],
  tokens: [],
  weather: 'sunny',
}

const PALETTE_ITEMS: { type: string; label: string; description: string }[] = [
  { type: 'spawn-point', label: 'Spawn Point', description: 'Where heroes enter the chunk' },
  { type: 'npc', label: 'NPC', description: 'Friendly characters (innkeeper, sage…)' },
  { type: 'enemy', label: 'Enemy', description: 'Hostile encounters; triggers combat' },
  { type: 'door', label: 'Door', description: 'Exit to another biome or room' },
]

export default function BuildScreen() {
  const params = useParams<{ slug?: string }>()
  const navigate = useNavigate()

  // Active chunk state
  const [currentSlug, setCurrentSlug] = createSignal<string>(params.slug ?? '')
  const [chunkName, setChunkName] = createSignal<string>('')
  const [biomeTags, setBiomeTags] = createSignal<string[]>([])
  const [sceneJson, setSceneJson] = createSignal<string>(JSON.stringify(EMPTY_SCENE))
  const [saveStatus, setSaveStatus] = createSignal<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [chunksRefetch, setChunksRefetch] = createSignal(0)

  let boardEl!: HTMLElement

  // Chunk list — refetches whenever chunksRefetch() changes
  const [chunks] = createResource(chunksRefetch, async () => {
    try {
      return await listChunks()
    } catch {
      return [] as SceneChunkMeta[]
    }
  })

  async function loadChunk(slug: string) {
    if (!slug) return
    const meta = await getChunk(slug)
    if (meta) {
      setCurrentSlug(meta.slug)
      setChunkName(meta.name)
      setBiomeTags(meta.biomeTags ?? [])
      setSceneJson(JSON.stringify(meta.sceneData ?? EMPTY_SCENE))
      navigate(`/build/${meta.slug}`, { replace: true })
    }
  }

  async function handleNewChunk() {
    const name = window.prompt('Chunk name:')
    if (!name) return
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!slug) return
    const emptyMeta: Partial<SceneChunkMeta> = { name, biomeTags: [], width: 20, height: 20 }
    try {
      await upsertChunk(slug, emptyMeta, EMPTY_SCENE)
      setChunksRefetch((n) => n + 1)
      await loadChunk(slug)
    } catch (err) {
      console.error('[BuildScreen] create chunk failed:', err)
    }
  }

  async function saveCurrentChunk(scene: SceneData) {
    const slug = currentSlug()
    if (!slug) return
    setSaveStatus('saving')
    try {
      await upsertChunk(slug, { name: chunkName(), biomeTags: biomeTags(), width: 20, height: 20 }, scene)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      setSaveStatus('error')
      console.error('[BuildScreen] save failed:', err)
      setTimeout(() => setSaveStatus('idle'), 4000)
    }
  }

  async function handleManualSave() {
    // Re-save with current metadata using the last known sceneData
    const slug = currentSlug()
    if (!slug) return
    setSaveStatus('saving')
    try {
      // Parse current sceneJson to get existing scene data
      const scene: SceneData = JSON.parse(sceneJson())
      await upsertChunk(slug, { name: chunkName(), biomeTags: biomeTags(), width: 20, height: 20 }, scene)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      setSaveStatus('error')
      console.error('[BuildScreen] manual save failed:', err)
      setTimeout(() => setSaveStatus('idle'), 4000)
    }
  }

  function toggleBiomeTag(tagId: string) {
    setBiomeTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    )
  }

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/')
      return
    }

    // Load chunk from URL param if provided
    if (params.slug) {
      await loadChunk(params.slug)
    }

    function handleSceneChange(e: Event) {
      const { scene } = (e as CustomEvent<{ scene: SceneData }>).detail
      setSceneJson(JSON.stringify(scene))
      void saveCurrentChunk(scene)
    }

    boardEl.addEventListener('scenechange', handleSceneChange)
    onCleanup(() => boardEl.removeEventListener('scenechange', handleSceneChange))
  })

  const saveLabel = () => {
    const s = saveStatus()
    if (s === 'saving') return 'Saving…'
    if (s === 'saved') return 'Saved'
    if (s === 'error') return 'Error'
    return 'Save'
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', width: '100vw', height: '100vh', background: '#1a1a2e', color: '#e0e0e0', 'font-family': 'sans-serif' }}>

      {/* Metadata bar */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', padding: '6px 12px', background: '#12122a', 'border-bottom': '1px solid #333', 'flex-shrink': '0', 'flex-wrap': 'wrap' }}>
        <input
          type="text"
          value={chunkName()}
          onInput={(e) => setChunkName(e.currentTarget.value)}
          placeholder="Chunk name…"
          style={{ background: '#0e0e22', border: '1px solid #444', color: '#fff', padding: '4px 8px', 'border-radius': '4px', 'font-size': '14px', 'min-width': '180px' }}
        />
        <span style={{ 'font-size': '12px', color: '#888' }}>Biome tags:</span>
        <For each={BIOME_TAG_OPTIONS}>
          {(opt) => (
            <label style={{ 'font-size': '12px', cursor: 'pointer', display: 'flex', 'align-items': 'center', gap: '4px' }}>
              <input
                type="checkbox"
                checked={biomeTags().includes(opt.id)}
                onChange={() => toggleBiomeTag(opt.id)}
              />
              {opt.label}
            </label>
          )}
        </For>
        <button
          onClick={handleManualSave}
          disabled={saveStatus() === 'saving' || !currentSlug()}
          style={{ 'margin-left': 'auto', background: saveStatus() === 'error' ? '#7a2020' : '#2a4a8a', color: '#fff', border: 'none', padding: '5px 14px', 'border-radius': '4px', cursor: 'pointer', 'font-size': '13px' }}
        >
          {saveLabel()}
        </button>
        <Show when={currentSlug()}>
          <button
            onClick={() => navigate(`/build-preview/${currentSlug()}`)}
            style={{ background: '#2a6a3a', color: '#fff', border: 'none', padding: '5px 14px', 'border-radius': '4px', cursor: 'pointer', 'font-size': '13px' }}
          >
            Test
          </button>
        </Show>
      </div>

      {/* Three-column body */}
      <div style={{ display: 'flex', flex: '1', overflow: 'hidden' }}>

        {/* Left: chunk browser */}
        <div style={{ width: '200px', 'flex-shrink': '0', background: '#12122a', 'border-right': '1px solid #333', display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', 'border-bottom': '1px solid #333', 'font-size': '11px', 'text-transform': 'uppercase', 'letter-spacing': '1px', color: '#888' }}>
            Chunks
          </div>
          <div style={{ flex: '1', 'overflow-y': 'auto', padding: '4px 0' }}>
            <Show when={!chunks.loading} fallback={<div style={{ padding: '8px 12px', 'font-size': '12px', color: '#666' }}>Loading…</div>}>
              <For each={chunks() ?? []} fallback={<div style={{ padding: '8px 12px', 'font-size': '12px', color: '#666' }}>No chunks yet</div>}>
                {(chunk) => (
                  <button
                    onClick={() => void loadChunk(chunk.slug)}
                    style={{
                      display: 'block',
                      width: '100%',
                      'text-align': 'left',
                      background: currentSlug() === chunk.slug ? '#1e2e5a' : 'transparent',
                      border: 'none',
                      color: '#ddd',
                      padding: '6px 12px',
                      'font-size': '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {chunk.name || chunk.slug}
                  </button>
                )}
              </For>
            </Show>
          </div>
          <div style={{ padding: '8px 10px', 'border-top': '1px solid #333' }}>
            <button
              onClick={() => void handleNewChunk()}
              style={{ width: '100%', background: '#1e3a6a', color: '#9ab', border: 'none', padding: '6px', 'border-radius': '4px', cursor: 'pointer', 'font-size': '12px' }}
            >
              + New chunk
            </button>
          </div>
        </div>

        {/* Center: board */}
        <div style={{ flex: '1', position: 'relative', overflow: 'hidden' }}>
          <Show when={!currentSlug()}>
            <div style={{ position: 'absolute', inset: '0', display: 'flex', 'align-items': 'center', 'justify-content': 'center', color: '#555', 'font-size': '14px', 'z-index': '5', 'pointer-events': 'none' }}>
              Select or create a chunk to start editing
            </div>
          </Show>
          <playsets-board
            ref={boardEl}
            attr:scene={sceneJson()}
            attr:entities="[]"
            attr:mode="build"
            style="width:100%;height:100%;display:block;position:relative;"
          />
        </div>

        {/* Right: entity palette */}
        <div style={{ width: '180px', 'flex-shrink': '0', background: '#12122a', 'border-left': '1px solid #333', display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', 'border-bottom': '1px solid #333', 'font-size': '11px', 'text-transform': 'uppercase', 'letter-spacing': '1px', color: '#888' }}>
            Token Types
          </div>
          <div style={{ flex: '1', 'overflow-y': 'auto', padding: '8px' }}>
            <For each={PALETTE_ITEMS}>
              {(item) => (
                <div style={{ 'margin-bottom': '10px', padding: '8px', background: '#0e0e22', 'border-radius': '4px', border: '1px solid #2a2a4a' }}>
                  <div style={{ 'font-size': '13px', 'font-weight': '600', color: '#bcd', 'margin-bottom': '3px' }}>{item.label}</div>
                  <div style={{ 'font-size': '11px', color: '#666', 'line-height': '1.4' }}>{item.description}</div>
                </div>
              )}
            </For>
            <div style={{ 'font-size': '11px', color: '#555', 'margin-top': '12px', 'line-height': '1.5' }}>
              Place tokens directly on the board using the board's built-in palette.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
