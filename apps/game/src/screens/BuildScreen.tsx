import { createSignal, onMount, onCleanup } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { auth } from '../lib/auth'
import { fetchScene, upsertScene } from '../services/scene-service'
import 'playsets'
import type { SceneData } from 'shared-types'
import { generateSceneFromInn, THE_INN } from 'shared-types'

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

export default function BuildScreen() {
  const params = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [saveStatus, setSaveStatus] = createSignal<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sceneJson, setSceneJson] = createSignal<string>(
    JSON.stringify(generateSceneFromInn(THE_INN)),
  )
  let boardEl!: HTMLElement

  onMount(async () => {
    const { data: { user } } = await auth.getUser()
    if (!user) {
      navigate('/')
      return
    }

    const data = await fetchScene(params.slug)
    if (data && (data.tokens?.length ?? 0) > 0) {
      setSceneJson(JSON.stringify(data))
    }

    async function handleSceneChange(e: Event) {
      const { scene } = (e as CustomEvent<{ scene: SceneData }>).detail
      setSaveStatus('saving')
      try {
        await upsertScene(params.slug, scene)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch (err) {
        setSaveStatus('error')
        console.error('[BuildScreen] save failed:', err)
        setTimeout(() => setSaveStatus('idle'), 4000)
      }
    }

    boardEl.addEventListener('scenechange', handleSceneChange)
    onCleanup(() => boardEl.removeEventListener('scenechange', handleSceneChange))
  })

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div style={{ position: 'absolute', top: '8px', right: '12px', 'z-index': '10', color: '#fff', 'font-size': '12px' }}>
        {saveStatus() === 'saving' ? 'Saving…' : saveStatus() === 'saved' ? 'Saved ✓' : saveStatus() === 'error' ? 'Save failed — check console' : `Editing: ${params.slug}`}
      </div>
      <playsets-board
        ref={boardEl}
        attr:scene={sceneJson()}
        attr:entities="[]"
        attr:mode="build"
        style="width:100%;height:100%;display:block;position:relative;"
      />
    </div>
  )
}
