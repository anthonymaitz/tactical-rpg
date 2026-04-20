import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}))

vi.mock('../hooks/useHeroes', () => ({
  useHeroes: () => ({ heroes: [], loading: false, createHero: vi.fn() }),
}))

describe('App', () => {
  it('shows the connect screen by default', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})
