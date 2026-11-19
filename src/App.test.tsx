import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Arcade navigation and Snake controls', () => {
  it('shows the game floor and opens Snake', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /a good game changes the pace/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play snake/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /play snake/i }))

    expect(screen.getByRole('heading', { name: 'Snake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Snake playfield' })).toBeInTheDocument()
  })

  it('starts, steers, pauses, resumes, restarts, and returns to the game floor', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /play snake/i }))
    fireEvent.click(screen.getByRole('button', { name: /start game/i }))

    const board = screen.getByRole('group', { name: 'Snake playfield' })
    await waitFor(() => expect(board).toHaveFocus())
    fireEvent.keyDown(board, { key: 'ArrowUp' })
    await waitFor(() => expect(board).toHaveAttribute('data-direction', 'up'))
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    await waitFor(() => expect(board).toHaveFocus())
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /restart/i }))
    expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
  })

  it('provides named direction controls for touch and keyboard users', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /play snake/i }))

    for (const direction of ['up', 'right', 'down', 'left']) {
      expect(screen.getByRole('button', { name: `Move ${direction}` })).toBeInTheDocument()
    }
  })
})
