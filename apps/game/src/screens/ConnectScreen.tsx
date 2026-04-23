// apps/game/src/screens/ConnectScreen.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useHeroes } from '../hooks/useHeroes'
import { STARTER_CLASSES, PERSONALITIES, isRecovering } from 'shared-types'
import type { HeroRecord, Personality } from 'shared-types'

type Props = { onConnect: (token: string, heroIds: string[]) => void }

type View = 'auth' | 'roster' | 'create'

export function ConnectScreen({ onConnect }: Props) {
  const [view, setView] = useState<View>('auth')
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Hero creation form state
  const [heroName, setHeroName] = useState('')
  const [heroClass, setHeroClass] = useState(STARTER_CLASSES[0].name)
  const [heroPersonality, setHeroPersonality] = useState(PERSONALITIES[0])
  const [createError, setCreateError] = useState<string | null>(null)

  const { heroes, loading: heroesLoading, createHero } = useHeroes(token)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setToken(data.session.access_token)
        setView('roster')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setToken(session.access_token)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleAuth() {
    setAuthLoading(true)
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      // Try sign up if sign in fails
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError || !signUpData.session) {
        setAuthError(signUpError?.message ?? 'Authentication failed')
        setAuthLoading(false)
        return
      }
      setToken(signUpData.session.access_token)
    } else {
      setToken(data.session.access_token)
    }
    setAuthLoading(false)
    setView('roster')
  }

  async function handleCreateHero() {
    setCreateError(null)
    if (!heroName.trim()) { setCreateError('Name is required'); return }
    try {
      await createHero({ name: heroName.trim(), className: heroClass, personality: heroPersonality })
      setHeroName('')
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
    if (!token || selected.size === 0) return
    onConnect(token, [...selected])
  }

  if (view === 'auth') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '80px auto' }}>
        <h2>Simple Quest Tactics</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 8 }}
        />
        {authError && <p style={{ color: 'red' }}>{authError}</p>}
        <button onClick={handleAuth} disabled={authLoading} style={{ padding: '10px 20px' }}>
          {authLoading ? 'Connecting…' : 'Sign In / Sign Up'}
        </button>
      </div>
    )
  }

  if (view === 'create') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, margin: '60px auto' }}>
        <h2>Create Your First Hero</h2>
        <input
          placeholder="Hero name"
          value={heroName}
          onChange={(e) => setHeroName(e.target.value)}
          style={{ padding: 8 }}
        />
        <label>
          Class
          <select value={heroClass} onChange={(e) => setHeroClass(e.target.value)} style={{ marginLeft: 8 }}>
            {STARTER_CLASSES.map((sc) => (
              <option key={sc.name} value={sc.name}>
                {sc.name} ({sc.die})
              </option>
            ))}
          </select>
        </label>
        <label>
          Personality
          <select value={heroPersonality} onChange={(e) => setHeroPersonality(e.target.value as Personality)} style={{ marginLeft: 8 }}>
            {PERSONALITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        {createError && <p style={{ color: 'red' }}>{createError}</p>}
        <button onClick={handleCreateHero} style={{ padding: '10px 20px' }}>Create Hero</button>
        {heroes.length > 0 && (
          <button onClick={() => setView('roster')} style={{ padding: '8px 16px' }}>Back to Roster</button>
        )}
      </div>
    )
  }

  // Roster view
  const available = heroes.filter((h) => !isRecovering(h))
  return (
    <div style={{ maxWidth: 600, margin: '60px auto' }}>
      <h2>Your Heroes</h2>
      {heroesLoading && <p>Loading heroes…</p>}
      {heroes.length === 0 && !heroesLoading && (
        <p>No heroes yet. Create your first one!</p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {heroes.map((hero) => {
          const recovering = isRecovering(hero)
          const isSelected = selected.has(hero.id)
          return (
            <div
              key={hero.id}
              onClick={() => toggleSelect(hero)}
              style={{
                border: isSelected ? '2px solid #4caf50' : '2px solid #444',
                borderRadius: 8,
                padding: 12,
                width: 160,
                opacity: recovering ? 0.5 : 1,
                cursor: recovering ? 'not-allowed' : 'pointer',
                background: isSelected ? '#1e2a1e' : '#1a1a2a',
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{hero.name}</div>
              <div style={{ fontSize: 12, color: '#aaa' }}>{hero.characterClass} · Lv{hero.level}</div>
              <div style={{ fontSize: 12, color: '#aaa' }}>{hero.personality}</div>
              {recovering && (
                <div style={{ fontSize: 11, color: '#e05555', marginTop: 4 }}>
                  Recovering…
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <button onClick={() => setView('create')} style={{ padding: '8px 16px' }}>
          + New Hero
        </button>
        <button
          onClick={handleEnterInn}
          disabled={selected.size === 0}
          style={{ padding: '10px 20px', opacity: selected.size === 0 ? 0.5 : 1 }}
        >
          Enter The Inn ({selected.size} selected)
        </button>
      </div>
      {available.length === 0 && heroes.length > 0 && (
        <p style={{ color: '#e07b39', marginTop: 12 }}>All heroes are recovering. Create a new hero or wait.</p>
      )}
    </div>
  )
}
