import { createSignal, createResource, For, Show } from 'solid-js'
import type { Accessor } from 'solid-js'

type ClassOption = {
  name: string
  ability: { id: string; name: string; description: string }
}

interface Props {
  heroMeta: Accessor<{ level: number; secondaryClass: string | null }>
  onSend: (className: string) => void
  onClose: () => void
}

async function fetchClasses(): Promise<ClassOption[]> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/content/classes`)
  // VITE_API_URL = http://localhost:3000 (set in apps/game/.env)
  if (!res.ok) throw new Error(`Failed to load classes: ${res.status}`)
  const json = await res.json() as { classes: ClassOption[] }
  return json.classes
}

export function SecondaryClassModal(props: Props) {
  const [classes] = createResource(fetchClasses)
  const [selected, setSelected] = createSignal<string | null>(null)
  const [sendError, setSendError] = createSignal<string | null>(null)

  const currentClass = () => props.heroMeta().secondaryClass
  const effectiveSelected = () => selected() ?? currentClass()

  function handleConfirm() {
    const cls = effectiveSelected()
    if (!cls) return
    setSendError(null)
    props.onSend(cls)
  }

  return (
    <div style={{
      position: 'absolute', inset: '0', 'z-index': '40',
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', 'align-items': 'center', 'justify-content': 'center',
    }}>
      <div style={{
        background: 'rgba(5,10,5,0.98)',
        border: '1px solid rgba(255,255,255,0.1)',
        'border-radius': '10px',
        padding: '28px 32px',
        'max-width': '480px',
        width: '90%',
        'max-height': '80vh',
        overflow: 'auto',
      }}>
        <div style={{ color: '#ccc', 'font-size': '16px', 'font-weight': '700', 'margin-bottom': '6px' }}>
          Choose Secondary Class
        </div>
        <div style={{ color: '#555', 'font-size': '11px', 'margin-bottom': '20px' }}>
          You will borrow one ability from this class in combat.
        </div>

        <Show when={classes.loading}>
          <div style={{ color: '#555', 'font-size': '12px', 'text-align': 'center', padding: '20px' }}>
            Loading classes…
          </div>
        </Show>

        <Show when={classes.error}>
          <div style={{ color: '#f88', 'font-size': '12px', 'text-align': 'center', padding: '20px' }}>
            Could not load classes. Try again.
          </div>
        </Show>

        <Show when={classes()}>
          {(list) => (
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '10px', 'margin-bottom': '20px' }}>
              <For each={list()}>
                {(cls) => {
                  const isSelected = () => effectiveSelected() === cls.name
                  return (
                    <button
                      onClick={() => setSelected(cls.name)}
                      style={{
                        background: isSelected() ? 'rgba(80,160,80,0.15)' : 'rgba(255,255,255,0.03)',
                        border: isSelected() ? '1px solid rgba(100,200,100,0.4)' : '1px solid rgba(255,255,255,0.07)',
                        'border-radius': '7px',
                        padding: '12px',
                        cursor: 'pointer',
                        'text-align': 'left',
                      }}
                    >
                      <div style={{ color: isSelected() ? '#9f9' : '#ccc', 'font-size': '13px', 'font-weight': '600', 'margin-bottom': '4px' }}>
                        {cls.name}
                      </div>
                      <div style={{ color: '#888', 'font-size': '11px', 'font-weight': '600', 'margin-bottom': '3px' }}>
                        {cls.ability.name}
                      </div>
                      <div style={{ color: '#555', 'font-size': '10px', 'line-height': '1.4' }}>
                        {cls.ability.description}
                      </div>
                    </button>
                  )
                }}
              </For>
            </div>
          )}
        </Show>

        <Show when={sendError()}>
          <div style={{ color: '#f88', 'font-size': '11px', 'margin-bottom': '12px' }}>
            {sendError()}
          </div>
        </Show>

        <div style={{ display: 'flex', gap: '8px', 'justify-content': 'flex-end' }}>
          <button
            onClick={props.onClose}
            style={{
              padding: '6px 18px', 'font-size': '12px', cursor: 'pointer',
              background: 'transparent', color: '#555',
              border: '1px solid rgba(255,255,255,0.08)', 'border-radius': '5px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!effectiveSelected() || effectiveSelected() === currentClass()}
            style={{
              padding: '6px 18px', 'font-size': '12px', 'font-weight': '600', cursor: 'pointer',
              background: 'rgba(80,160,80,0.2)', color: '#6f6',
              border: '1px solid #3a5a3a', 'border-radius': '5px',
              opacity: (!effectiveSelected() || effectiveSelected() === currentClass()) ? '0.4' : '1',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
