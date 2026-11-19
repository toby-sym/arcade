import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ARCADE_DATA_KEY } from './storage/arcadeData'
import { dailyPatternForDate, utcDateKey } from './games/dailyPattern'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.localStorage.removeItem(ARCADE_DATA_KEY)
  delete document.documentElement.dataset.reduceMotion
})

describe('Arcade navigation and game controls', () => {
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

    expect(screen.getByText('05 PLAYABLE')).toBeInTheDocument()
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
    expect(screen.getAllByText((_, element) => element?.tagName === 'STRONG' && /^\d+\s*ms$/.test(element.textContent ?? ''))).toHaveLength(2)
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.reaction).toBeGreaterThan(0)
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

  it('opens Pattern Memory, repeats the sequence, pauses, and restarts', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<App />)

    expect(screen.getByText('05 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play pattern/i }))
    expect(screen.getByRole('heading', { name: 'Remember' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }))

    const topLeft = screen.getByRole('button', { name: /top left tile, 1/i })
    expect(topLeft).toHaveAttribute('aria-disabled', 'true')
    act(() => { vi.advanceTimersByTime(300) })
    expect(topLeft).toHaveAttribute('aria-pressed', 'true')
    act(() => { vi.advanceTimersByTime(440) })
    expect(topLeft).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(topLeft)

    expect(screen.getByText('ROUND 02')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Pattern complete. Round 2 is next.')
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.pattern).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    expect(screen.getByRole('status')).toHaveTextContent('Watch the pattern again.')
    fireEvent.click(screen.getByRole('button', { name: /restart/i }))
    expect(screen.getByRole('button', { name: /start practice/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Rounds cleared this run: 0. Local best: 1.')).toBeInTheDocument()
  })

  it('ends a Pattern Memory run on a wrong tile and lets the player start again', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /play pattern/i }))
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }))
    act(() => { vi.advanceTimersByTime(300) })
    act(() => { vi.advanceTimersByTime(440) })
    fireEvent.click(screen.getByRole('button', { name: /top right tile, 2/i }))

    expect(screen.getByRole('status')).toHaveTextContent(/pattern broken/i)
    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(screen.getByRole('status')).toHaveTextContent('Watch the pattern. It will light one tile at a time.')
  })

  it('repeats the deterministic daily pattern without changing the practice best', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /play pattern/i }))
    fireEvent.click(screen.getByRole('button', { name: /daily challenge/i }))

    const sequence = dailyPatternForDate(utcDateKey())
    const board = screen.getByRole('group', { name: 'Four pattern tiles' })
    expect(screen.getByText('DAILY PATTERN · UTC')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent("Today's 8-tile shared challenge.")

    const labels = ['Top left tile', 'Top right tile', 'Bottom left tile', 'Bottom right tile']
    for (let index = 0; index < sequence.length; index += 1) {
      act(() => { vi.advanceTimersByTime(300) })
      const litTile = board.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      expect(litTile).not.toBeNull()
      expect(litTile).toHaveAttribute('aria-label', `${labels[sequence[index]]}, ${sequence[index] + 1}`)
      act(() => { vi.advanceTimersByTime(440) })
    }

    for (const tile of sequence) fireEvent.click(screen.getByRole('button', { name: new RegExp(`${labels[tile]}, ${tile + 1}`, 'i') }))

    expect(screen.getByRole('status')).toHaveTextContent('Daily challenge complete. You remembered all 8 tiles.')
    expect(screen.getByRole('button', { name: /try daily again/i })).toBeInTheDocument()
    expect(window.localStorage.getItem(ARCADE_DATA_KEY)).toBeNull()
  })

  it('opens Breakout and supports keyboard paddle movement, pause, and restart', async () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('05 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play breakout/i }))
    expect(screen.getByRole('heading', { name: 'Breakout' })).toBeInTheDocument()
    const board = screen.getByRole('group', { name: 'Breakout playfield' })
    const paddle = board.querySelector('.breakout-paddle')
    expect(paddle).toHaveStyle({ left: '40.833333333333336%' })

    fireEvent.click(screen.getByRole('button', { name: /start game/i }))
    act(() => { vi.advanceTimersByTime(20) })
    expect(board).toHaveFocus()
    fireEvent.keyDown(board, { key: 'ArrowLeft' })
    expect(paddle).not.toHaveStyle({ left: '40.833333333333336%' })
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    fireEvent.keyDown(board, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /restart/i }))
    expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
  })

  it('opens Pong and supports keyboard paddle movement, pause, serve, and restart', () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('05 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play pong/i }))
    expect(screen.getByRole('heading', { name: 'Pong' })).toBeInTheDocument()
    const board = screen.getByRole('group', { name: 'Pong playfield' })
    const paddle = board.querySelector('.pong-player-paddle')
    const initialPaddle = paddle?.getAttribute('style')
    const quickPace = screen.getByRole('radio', { name: /quick/i })
    fireEvent.click(quickPace)
    expect(quickPace).toBeChecked()
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').preferences.pongDifficulty).toBe('quick')

    fireEvent.click(screen.getByRole('button', { name: /start match/i }))
    expect(quickPace).toBeDisabled()
    act(() => { vi.advanceTimersByTime(20) })
    expect(board).toHaveFocus()
    fireEvent.keyDown(board, { key: 'ArrowUp' })
    expect(paddle?.getAttribute('style')).not.toBe(initialPaddle)
    fireEvent.keyDown(board, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    fireEvent.keyDown(board, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    fireEvent.keyDown(board, { key: 'r' })
    expect(screen.getByRole('button', { name: /start match/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
  })

  it('saves the reduced-motion preference and restores it on the next visit', () => {
    const firstVisit = render(<App />)
    const reduceMotion = screen.getByRole('checkbox', { name: /reduce motion/i })
    fireEvent.click(reduceMotion)

    expect(reduceMotion).toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-reduce-motion', 'true')
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').preferences.reduceMotion).toBe(true)

    firstVisit.unmount()
    render(<App />)
    expect(screen.getByRole('checkbox', { name: /reduce motion/i })).toBeChecked()
  })

  it('confirms record clearing, preserves the motion preference, and keeps records local', () => {
    window.localStorage.setItem(ARCADE_DATA_KEY, JSON.stringify({
      version: 1,
      bests: { snake: 8, reaction: 240, pattern: 3, breakout: 120, pong: 2 },
      preferences: { reduceMotion: true, pongDifficulty: 'steady' },
    }))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear records' }))
    expect(screen.getByRole('group', { name: /clear all personal bests saved in this browser/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep records' }))
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.snake).toBe(8)

    fireEvent.click(screen.getByRole('button', { name: 'Clear records' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear all records' }))
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}')).toEqual({
      version: 1,
      bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null },
      preferences: { reduceMotion: true, pongDifficulty: 'steady' },
    })
    expect(screen.getByText('No saved records.')).toBeInTheDocument()
  })
})
