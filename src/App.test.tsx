import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ARCADE_DATA_KEY } from './storage/arcadeData'
import { dailyPatternForDate, utcDateKey } from './games/dailyPattern'
import { dailyWordForDate, isValidWordGuess } from './games/dailyWord'
import { createConnectionsState } from './games/connections'
import { createSpellingBeeState } from './games/spellingBee'
import { createStrandsState } from './games/strands'
import { createSudokuPuzzle } from './games/sudoku'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.localStorage.removeItem(ARCADE_DATA_KEY)
  delete document.documentElement.dataset.reduceMotion
})

describe('Arcade navigation and game controls', () => {
  it('offers an install action when the browser allows Arcade to be installed', async () => {
    render(<App />)
    const prompt = vi.fn().mockResolvedValue(undefined)
    const installEvent = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(installEvent, {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    })

    act(() => { window.dispatchEvent(installEvent) })

    expect(installEvent.defaultPrevented).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Install Arcade' }))
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install Arcade' })).not.toBeInTheDocument())
  })

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

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
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

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
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
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyPatternCompletedDate).toBe(utcDateKey())
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.pattern).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play pattern/i }))
    expect(screen.getByText(/today's shared challenge is complete in this browser/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /daily challenge/i }))
    expect(screen.getByRole('status')).toHaveTextContent("Today's 8-tile shared challenge.")
  })

  it('opens Breakout and supports keyboard paddle movement, pause, and restart', async () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play breakout/i }))
    expect(screen.getByRole('heading', { name: 'Breakout' })).toBeInTheDocument()
    const board = screen.getByRole('group', { name: 'Breakout playfield' })
    const paddle = board.querySelector('.breakout-paddle')
    expect(paddle).toHaveStyle({ left: '40.833333333333336%' })

    fireEvent.click(screen.getByRole('button', { name: /start game/i }))
    act(() => { vi.advanceTimersByTime(20) })
    expect(board).toHaveFocus()
    fireEvent.keyDown(board, { key: 'ArrowLeft' })
    act(() => { vi.advanceTimersByTime(80) })
    const paddleAfterHold = paddle?.getAttribute('style')
    expect(paddle).not.toHaveStyle({ left: '40.833333333333336%' })
    fireEvent.keyUp(window, { key: 'ArrowLeft' })
    act(() => { vi.advanceTimersByTime(80) })
    expect(paddle?.getAttribute('style')).toBe(paddleAfterHold)
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

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
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
    act(() => { vi.advanceTimersByTime(80) })
    const paddleAfterHold = paddle?.getAttribute('style')
    expect(paddleAfterHold).not.toBe(initialPaddle)
    fireEvent.keyUp(window, { key: 'ArrowUp' })
    act(() => { vi.advanceTimersByTime(80) })
    expect(paddle?.getAttribute('style')).toBe(paddleAfterHold)
    fireEvent.keyDown(board, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    fireEvent.keyDown(board, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    fireEvent.keyDown(board, { key: 'r' })
    expect(screen.getByRole('button', { name: /start match/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
  })

  it('opens Space Invaders with keyboard and touch controls', () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play invaders/i }))
    expect(screen.getByRole('heading', { name: 'Space Invaders' })).toBeInTheDocument()
    const board = screen.getByRole('group', { name: 'Space Invaders playfield' })

    fireEvent.click(screen.getByRole('button', { name: /start game/i }))
    act(() => { vi.advanceTimersByTime(20) })
    expect(board).toHaveFocus()
    const player = board.querySelector('.invader-player')
    fireEvent.keyDown(board, { key: 'ArrowRight' })
    expect(player).toHaveStyle({ left: '51.2%' })
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    fireEvent.keyDown(board, { key: ' ', code: 'Space' })
    expect(board.querySelector('.invader-player-shot')).not.toBeNull()
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Move left' }))
    expect(player).toHaveStyle({ left: '43.2%' })
    fireEvent.click(screen.getByRole('button', { name: /restart/i }))
    expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument()
    fireEvent.keyDown(board, { key: ' ', code: 'Space' })
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    expect(board.querySelector('.invader-player-shot')).not.toBeNull()
    fireEvent.keyDown(board, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
  })

  it('opens Asteroids with continuous keyboard and touch controls', () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play asteroids/i }))
    expect(screen.getByRole('heading', { name: 'Asteroids' })).toBeInTheDocument()
    const board = screen.getByRole('group', { name: 'Asteroids playfield' })
    fireEvent.click(screen.getByRole('button', { name: /start game/i }))
    act(() => { vi.advanceTimersByTime(32) })
    expect(board).toHaveFocus()

    const ship = board.querySelector('.asteroids-ship')
    fireEvent.keyDown(board, { key: 'ArrowLeft' })
    act(() => { vi.advanceTimersByTime(32) })
    const heldAngle = Number(ship?.getAttribute('style')?.match(/rotate\((-?[\d.]+)rad\)/)?.[1])
    expect(heldAngle).toBeLessThan(-0.078)
    fireEvent.keyUp(window, { key: 'ArrowLeft' })
    act(() => { vi.advanceTimersByTime(32) })
    const releasedAngle = Number(ship?.getAttribute('style')?.match(/rotate\((-?[\d.]+)rad\)/)?.[1])
    expect(releasedAngle).toBeCloseTo(heldAngle)
    fireEvent.keyDown(board, { key: ' ', code: 'Space' })
    act(() => { vi.advanceTimersByTime(40) })
    expect(board.querySelector('.asteroids-shot')).not.toBeNull()
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })

    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    const thrust = screen.getByRole('button', { name: 'Thrust' })
    fireEvent.pointerDown(thrust, { pointerId: 1 })
    act(() => { vi.advanceTimersByTime(32) })
    fireEvent.pointerUp(thrust, { pointerId: 1 })
    fireEvent.click(screen.getByRole('button', { name: /restart/i }))
    expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
  })

  it('opens Missile Command and supports keyboard and touch aiming', () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play missile command/i }))
    expect(screen.getByRole('heading', { name: 'Missile Command' })).toBeInTheDocument()
    const board = screen.getByRole('group', { name: 'Missile Command playfield' })
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    act(() => { vi.advanceTimersByTime(20) })
    expect(board).toHaveFocus()

    const aim = board.querySelector('.missile-aim')
    fireEvent.keyDown(board, { key: 'ArrowRight' })
    expect(Number(aim?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1])).toBeCloseTo(54.333, 2)
    fireEvent.keyDown(board, { key: ' ', code: 'Space' })
    expect(board.querySelectorAll('.defense-missile')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Aim up' }))
    expect(Number(aim?.getAttribute('style')?.match(/top: ([\d.]+)%/)?.[1])).toBeCloseTo(36, 2)
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Fire at target' }))
    expect(board.querySelectorAll('.defense-missile')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /restart/i }))
    expect(screen.getByRole('button', { name: 'Start game' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
  })

  it('opens Block Drop, handles keyboard and touch controls, and saves a local best', () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play block drop/i }))
    expect(screen.getByRole('heading', { name: 'Block Drop' })).toBeInTheDocument()
    const board = screen.getByRole('group', { name: /block drop playfield/i })
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    act(() => { vi.advanceTimersByTime(20) })
    expect(board).toHaveFocus()

    fireEvent.keyDown(board, { key: 'ArrowLeft' })
    fireEvent.keyDown(board, { key: 'ArrowUp' })
    fireEvent.keyDown(board, { key: ' ', code: 'Space' })
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.blockDrop).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Hold piece' }))
    fireEvent.click(screen.getByRole('button', { name: 'Soft drop one row' }))
    fireEvent.click(screen.getByRole('button', { name: 'Drop' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByRole('button', { name: 'Start game' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
  })

  it('plays and restores the daily word puzzle and records the best solve', () => {
    const today = utcDateKey()
    const answer = dailyWordForDate(today)
    const firstGuess = ['CRANE', 'BRICK', 'CLOUD', 'SWEET'].find((word) => word !== answer && isValidWordGuess(word))!
    render(<App />)

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play word guess/i }))
    expect(screen.getByRole('heading', { name: 'Word Guess' })).toBeInTheDocument()

    for (const letter of firstGuess) fireEvent.click(screen.getByRole('button', { name: `Letter ${letter}` }))
    fireEvent.click(screen.getByRole('button', { name: 'ENTER' }))
    expect(screen.getByRole('group', { name: /guess 1:/i })).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyWordGame.guesses).toEqual([firstGuess])

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play word guess/i }))
    expect(screen.getByRole('group', { name: /guess 1:/i })).toBeInTheDocument()
    const board = screen.getByRole('group', { name: /daily word playfield/i })
    board.focus()
    for (const letter of answer) fireEvent.keyDown(board, { key: letter })
    fireEvent.keyDown(board, { key: 'Enter' })

    expect(screen.getByText('PUZZLE SOLVED')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyWordGame.phase).toBe('won')
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.wordPuzzle).toBe(2)
  })

  it('plays the daily Connections board, restores progress and records a clean solve', () => {
    const today = utcDateKey()
    const puzzle = createConnectionsState(today)
    render(<App />)

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play connections/i }))
    expect(screen.getByRole('heading', { name: 'Connections' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(16)

    const firstGroup = puzzle.groups[0]!
    for (const word of firstGroup.words) fireEvent.click(screen.getByRole('button', { name: word }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit set' }))
    expect(screen.getByText(firstGroup.label)).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyConnectionsGame.solvedGroupIds).toEqual([firstGroup.id])

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play connections/i }))
    expect(screen.getByText(firstGroup.label)).toBeInTheDocument()

    for (const group of puzzle.groups.slice(1)) {
      for (const word of group.words) fireEvent.click(screen.getByRole('button', { name: word }))
      fireEvent.click(screen.getByRole('button', { name: 'Submit set' }))
    }
    expect(screen.getByText('BOARD SOLVED')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyConnectionsGame.phase).toBe('won')
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.connections).toBe(0)
  })

  it('plays and restores the daily Spelling Bee and records the completed score', () => {
    const today = utcDateKey()
    const puzzle = createSpellingBeeState(today)
    const firstWord = puzzle.words.find((word) => word.length === 4)!
    render(<App />)

    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play spelling bee/i }))
    expect(screen.getByRole('heading', { name: 'Spelling Bee' })).toBeInTheDocument()

    const playfield = screen.getByRole('group', { name: /spelling bee letter hive/i })
    playfield.focus()
    for (const letter of firstWord) fireEvent.keyDown(playfield, { key: letter })
    fireEvent.keyDown(playfield, { key: 'Enter' })
    expect(screen.getByRole('listitem')).toHaveTextContent(firstWord)
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailySpellingBeeGame.foundWords).toEqual([firstWord])

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play spelling bee/i }))
    expect(screen.getByRole('listitem')).toHaveTextContent(firstWord)

    const restoredPlayfield = screen.getByRole('group', { name: /spelling bee letter hive/i })
    restoredPlayfield.focus()
    for (const word of puzzle.words.filter((candidate) => candidate !== firstWord)) {
      for (const letter of word) fireEvent.keyDown(restoredPlayfield, { key: letter })
      fireEvent.keyDown(restoredPlayfield, { key: 'Enter' })
    }
    expect(screen.getByText('HIVE CLEARED')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailySpellingBeeGame.phase).toBe('complete')
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.spellingBee).toBe(puzzle.maxScore)
  })

  it('plays and restores the daily Strands board and records a no-hint solve', () => {
    const today = utcDateKey()
    const puzzle = createStrandsState(today)
    const firstWord = puzzle.words.find((word) => word !== puzzle.spangram)!
    const selectWord = (word: string) => {
      for (const index of puzzle.paths[word]!) {
        const row = Math.floor(index / 8) + 1
        const column = index % 8 + 1
        const letter = puzzle.grid[index]!
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Row ${row}, column ${column}, ${letter}`) }))
      }
    }

    render(<App />)
    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play strands/i }))
    expect(screen.getByRole('heading', { name: 'Strands' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Row \d, column \d, [A-Z]/ })).toHaveLength(48)

    selectWord(firstWord)
    expect(screen.getByText(firstWord, { selector: '.strands-found span' })).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyStrandsGame.foundWords).toEqual([firstWord])

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play strands/i }))
    expect(screen.getByText(firstWord, { selector: '.strands-found span' })).toBeInTheDocument()

    for (const word of puzzle.words.filter((candidate) => candidate !== firstWord)) selectWord(word)
    expect(screen.getByText('BOARD SOLVED')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyStrandsGame.foundWords).toHaveLength(6)
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.strands).toBe(0)
  })

  it('plays and restores the daily Sudoku grid and records a no-hint solve', () => {
    const today = utcDateKey()
    const puzzle = createSudokuPuzzle(today)
    const cellButton = (index: number) => {
      const row = Math.floor(index / 9) + 1
      const column = index % 9 + 1
      return screen.getByRole('button', { name: new RegExp(`^Row ${row}, column ${column},`) })
    }
    render(<App />)
    expect(screen.getByText('14 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play sudoku/i }))
    expect(screen.getByRole('heading', { name: 'Sudoku' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Row \d, column \d,/ })).toHaveLength(81)

    const firstEmpty = puzzle.givens.findIndex((given) => !given)
    fireEvent.click(cellButton(firstEmpty))
    fireEvent.click(screen.getByRole('button', { name: `Enter ${puzzle.solution[firstEmpty]}` }))
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailySudokuGame.board[firstEmpty]).toBe(puzzle.solution[firstEmpty])

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play sudoku/i }))
    expect(cellButton(firstEmpty)).toHaveTextContent(puzzle.solution[firstEmpty]!)

    for (let index = 0; index < 81; index += 1) {
      if (puzzle.givens[index]) continue
      fireEvent.click(cellButton(index))
      fireEvent.click(screen.getByRole('button', { name: `Enter ${puzzle.solution[index]}` }))
    }
    expect(screen.getByText('GRID COMPLETE')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailySudokuGame.board).toEqual(puzzle.solution)
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.sudoku).toBe(0)
  })

  it('saves motion and sound preferences and restores them on the next visit', () => {
    const firstVisit = render(<App />)
    const reduceMotion = screen.getByRole('checkbox', { name: /reduce motion/i })
    const soundEffects = screen.getByRole('checkbox', { name: /arcade sounds/i })
    fireEvent.click(reduceMotion)
    fireEvent.click(soundEffects)

    expect(reduceMotion).toBeChecked()
    expect(soundEffects).toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-reduce-motion', 'true')
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').preferences.reduceMotion).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').preferences.soundEffects).toBe(true)

    firstVisit.unmount()
    render(<App />)
    expect(screen.getByRole('checkbox', { name: /reduce motion/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /arcade sounds/i })).toBeChecked()
  })

  it('confirms record clearing, preserves the motion preference, and keeps records local', () => {
    window.localStorage.setItem(ARCADE_DATA_KEY, JSON.stringify({
      version: 1,
      bests: { snake: 8, reaction: 240, pattern: 3, breakout: 120, pong: 2, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null },
      preferences: { reduceMotion: true, soundEffects: false, pongDifficulty: 'steady' },
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
      dailyPatternCompletedDate: null,
      dailyWordGame: null,
      dailyConnectionsGame: null,
      dailySpellingBeeGame: null,
      dailyStrandsGame: null,
      dailySudokuGame: null,
      bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null, strands: null, sudoku: null },
      preferences: { reduceMotion: true, soundEffects: false, pongDifficulty: 'steady' },
    })
    expect(screen.getByText('No saved records.')).toBeInTheDocument()
  })
})
