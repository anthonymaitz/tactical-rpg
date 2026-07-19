// Self-hosted replacement for the Supabase Auth client. Mirrors just the
// slice of supabase-js's `auth` interface this app actually uses, backed by
// the game's own /auth/signup and /auth/login endpoints.

const API = import.meta.env.VITE_API_URL
const STORAGE_KEY = 'tactical-rpg-session'

type Session = { access_token: string; user: { id: string; email: string } }
type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT'
type Listener = (event: AuthEvent, session: Session | null) => void

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

let currentSession: Session | null = loadSession()
const listeners = new Set<Listener>()

function persist(session: Session | null) {
  currentSession = session
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  else localStorage.removeItem(STORAGE_KEY)
}

function notify(event: AuthEvent) {
  for (const listener of listeners) listener(event, currentSession)
}

async function authenticate(path: '/auth/signup' | '/auth/login', email: string, password: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { data: { session: null }, error: { message: (body as { error?: string }).error ?? 'Request failed' } }
  }
  const session: Session = { access_token: (body as { token: string }).token, user: { id: (body as { userId: string }).userId, email } }
  persist(session)
  notify('SIGNED_IN')
  return { data: { session }, error: null }
}

export const auth = {
  async getSession() {
    return { data: { session: currentSession } }
  },
  async getUser() {
    return { data: { user: currentSession?.user ?? null } }
  },
  onAuthStateChange(callback: Listener) {
    listeners.add(callback)
    return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    return authenticate('/auth/login', email, password)
  },
  async signUp({ email, password }: { email: string; password: string }) {
    return authenticate('/auth/signup', email, password)
  },
  async signOut() {
    persist(null)
    notify('SIGNED_OUT')
  },
}
