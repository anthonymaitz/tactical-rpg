import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@solidjs/testing-library'
import App from '../App'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('../hooks/useHeroes', () => ({
  createHeroes: () => ({ heroes: () => [], loading: () => false, createHero: vi.fn() }),
}))

describe('App', () => {
  it('shows the connect screen by default', () => {
    render(() => <App />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})
