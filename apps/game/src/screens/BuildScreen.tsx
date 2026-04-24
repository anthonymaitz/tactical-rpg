import { createSignal, onMount } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { token } from '../session'
import { fetchScene, upsertScene } from '../services/scene-service'
import 'playsets-board'
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
        style?: string
      }
    }
  }
}

export default function BuildScreen() {
  const params = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [saveStatus, setSaveStatus] = createSignal<'idle' | 'saving' | 'saved'>('idle')
  const [sceneJson, setSceneJson] = createSignal<string>(
    JSON.stringify(generateSceneFromInn(THE_INN)),
  )
  let boardEl!: HTMLElement

  onMount(async () => {
    if (!token()) {
      navigate('/')
      return
    }

    const data = await fetchScene(params.slug)
    if (data) {
      setSceneJson(JSON.stringify(data))
    }

    boardEl.addEventListener('scenechange', async (e: Event) => {
      const { scene } = (e as CustomEvent<{ scene: SceneData }>).detail
      setSaveStatus('saving')
      await upsertScene(params.slug, scene)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    })
  })

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div style={{ position: 'absolute', top: '8px', right: '12px', 'z-index': '10', color: '#fff', 'font-size': '12px' }}>
        {saveStatus() === 'saving' ? 'Saving…' : saveStatus() === 'saved' ? 'Saved ✓' : `Editing: ${params.slug}`}
      </div>
      <playsets-board
        ref={boardEl}
        attr:scene={sceneJson()}
        attr:entities="[]"
        attr:mode="build"
        style="width:100%;height:100%;display:block;"
      />
    </div>
  )
}
