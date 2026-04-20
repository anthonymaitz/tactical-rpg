import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('shows the connect screen by default', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
  })
})
