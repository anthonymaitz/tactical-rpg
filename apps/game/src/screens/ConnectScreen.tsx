import { createSignal, onMount, onCleanup, For, Show, Switch, Match } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { supabase } from '../lib/supabase'
import { createHeroes } from '../hooks/useHeroes'
import { isRecovering } from 'shared-types'
import type { HeroRecord, Personality, Profession } from 'shared-types'
import { setToken, setHeroIds } from '../session'
import { SimpleQuestHUD, sampleContent } from 'simplequest-hud'
import type { CharacterChangeData } from 'simplequest-hud'

type View = 'auth' | 'roster' | 'create'

// SimpleQuest is the source of truth for classes, professions, and abilities
const createContent = JSON.stringify(sampleContent)

export function ConnectScreen() {
  const navigate = useNavigate()
  const [view, setView] = createSignal<View>('auth')
  const [accessToken, setAccessToken] = createSignal<string | null>(null)
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [authError, setAuthError] = createSignal<string | null>(null)
  const [authLoading, setAuthLoading] = createSignal(false)
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [createCharacter, setCreateCharacter] = createSignal<CharacterChangeData>({
    name: '', class: '', profession: '', personality: '', die: 'd6',
  })
  const [createError, setCreateError] = createSignal<string | null>(null)

  const { heroes, loading: heroesLoading, createHero } = createHeroes(accessToken)

  onMount(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAccessToken(data.session.access_token)
        setView('roster')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setAccessToken(session.access_token)
    })
    onCleanup(() => subscription.unsubscribe())
  })

  async function handleAuth() {
    setAuthLoading(true)
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email(), password: password() })
    if (error || !data.session) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email: email(), password: password() })
      if (signUpError || !signUpData.session) {
        setAuthError(signUpError?.message ?? 'Authentication failed')
        setAuthLoading(false)
        return
      }
      setAccessToken(signUpData.session.access_token)
    } else {
      setAccessToken(data.session.access_token)
    }
    setAuthLoading(false)
    setView('roster')
  }

  async function handleCreateHero() {
    setCreateError(null)
    const c = createCharacter()
    if (!c.name.trim()) { setCreateError('Enter a name in the character sheet above'); return }
    if (!c.class) { setCreateError('Select a class in the character sheet above'); return }
    if (!c.personality) { setCreateError('Select a personality in the character sheet above'); return }
    if (!c.profession) { setCreateError('Select a profession in the character sheet above'); return }
    try {
      await createHero({
        name: c.name.trim(),
        className: c.class,
        personality: c.personality as Personality,
        profession: c.profession as Profession,
      })
      setView('roster')
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create hero')
    }
  }

  function toggleSelect(hero: HeroRecord) {
    if (isRecovering(hero)) return
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(hero.id) ? next.delete(hero.id) : next.add(hero.id)
      return next
    })
  }

  function handleEnterInn() {
    const t = accessToken()
    if (!t || selected().size === 0) return
    setToken(t)
    setHeroIds([...selected()])
    navigate('/inn')
  }

  function handleOpenBuilder() {
    const t = accessToken()
    if (!t) return
    setToken(t)
    navigate('/build/inn-main')
  }

  return (
    <Switch>
      <Match when={view() === 'auth'}>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px', 'max-width': '320px', margin: '80px auto' }}>
          <h2>Simple Quest Tactics</h2>
          <input placeholder="Email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} style={{ padding: '8px' }} />
          <input type="password" placeholder="Password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} style={{ padding: '8px' }} />
          <Show when={authError()}>
            <p style={{ color: 'red' }}>{authError()}</p>
          </Show>
          <button onClick={handleAuth} disabled={authLoading()} style={{ padding: '10px 20px' }}>
            {authLoading() ? 'Connecting…' : 'Sign In / Sign Up'}
          </button>
        </div>
      </Match>

      <Match when={view() === 'create'}>
        <div style={{
          display: 'flex', 'flex-direction': 'column',
          height: '100vh', 'max-width': '440px', margin: '0 auto',
        }}>
          <div style={{ flex: '1', 'min-height': '0', overflow: 'hidden' }}>
            <SimpleQuestHUD
              content={createContent}
              onCharacterChange={(data) => setCreateCharacter(data)}
            />
          </div>
          <div style={{
            'flex-shrink': '0',
            padding: '12px 16px',
            'border-top': '1px solid #e0e0e0',
            display: 'flex',
            'flex-direction': 'column',
            gap: '8px',
            background: '#fff',
          }}>
            <Show when={createError()}>
              <p style={{ color: 'red', margin: '0', 'font-size': '13px' }}>{createError()}</p>
            </Show>
            <button onClick={handleCreateHero} style={{ padding: '10px 20px', 'font-size': '15px', cursor: 'pointer' }}>
              Create Hero
            </button>
            <Show when={heroes().length > 0}>
              <button onClick={() => setView('roster')} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                Back to Roster
              </button>
            </Show>
          </div>
        </div>
      </Match>

      <Match when={view() === 'roster'}>
        <div style={{ 'max-width': '600px', margin: '60px auto' }}>
          <h2>Your Heroes</h2>
          <Show when={heroesLoading()}>
            <p>Loading heroes…</p>
          </Show>
          <Show when={heroes().length === 0 && !heroesLoading()}>
            <p>No heroes yet. Create your first one!</p>
          </Show>
          <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '12px' }}>
            <For each={heroes()}>
              {(hero) => {
                const recovering = isRecovering(hero)
                const isSelected = () => selected().has(hero.id)
                return (
                  <div
                    onClick={() => toggleSelect(hero)}
                    style={{
                      border: isSelected() ? '2px solid #4caf50' : '2px solid #444',
                      'border-radius': '8px',
                      padding: '12px',
                      width: '160px',
                      opacity: recovering ? 0.5 : 1,
                      cursor: recovering ? 'not-allowed' : 'pointer',
                      background: isSelected() ? '#1e2a1e' : '#1a1a2a',
                    }}
                  >
                    <div style={{ 'font-weight': 'bold' }}>{hero.name}</div>
                    <div style={{ 'font-size': '12px', color: '#aaa' }}>{hero.characterClass} · Lv{hero.level}</div>
                    <div style={{ 'font-size': '12px', color: '#aaa' }}>{hero.personality}</div>
                    <Show when={recovering}>
                      <div style={{ 'font-size': '11px', color: '#e05555', 'margin-top': '4px' }}>Recovering…</div>
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
          <div style={{ 'margin-top': '20px', display: 'flex', gap: '12px' }}>
            <button onClick={() => setView('create')} style={{ padding: '8px 16px' }}>+ New Hero</button>
            <button onClick={handleEnterInn} disabled={selected().size === 0} style={{ padding: '10px 20px', opacity: selected().size === 0 ? 0.5 : 1 }}>
              Enter The Inn ({selected().size} selected)
            </button>
            <button onClick={handleOpenBuilder} style={{ padding: '10px 20px' }}>
              Builder
            </button>
          </div>
          <Show when={heroes().filter((h) => !isRecovering(h)).length === 0 && heroes().length > 0}>
            <p style={{ color: '#e07b39', 'margin-top': '12px' }}>All heroes are recovering. Create a new hero or wait.</p>
          </Show>
        </div>
      </Match>
    </Switch>
  )
}
