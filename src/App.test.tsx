import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

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

  it('opens Reaction from the game floor and records a time after the signal', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<App />)

    expect(screen.getByText('02 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play reaction/i }))
    expect(screen.getByRole('heading', { name: 'Reaction' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start a round/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /start a round/i }))
    expect(screen.getByRole('button', { name: /wait for green/i })).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1800) })
    expect(screen.getByRole('button', { name: /press now/i })).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(237) })
    fireEvent.click(screen.getByRole('button', { name: /press now/i }))
    expect(screen.getByText(/your reaction time was \d+ milliseconds/i)).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.tagName === 'STRONG' && /^\d+\s*ms$/.test(element.textContent ?? ''))).toBeInTheDocument()
  })

  it('catches a false start, allows restart, and returns to the game floor', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /play reaction/i }))
    fireEvent.click(screen.getByRole('button', { name: /start a round/i }))
    fireEvent.click(screen.getByRole('button', { name: /wait for green/i }))

    expect(screen.getByRole('button', { name: /too soon/i })).toBeInTheDocument()
    expect(screen.getByText('Too soon. Wait for green next time.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /restart/i }))
    expect(screen.getByRole('button', { name: /start a round/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
  })
})
