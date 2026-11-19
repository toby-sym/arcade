import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ARCADE_DATA_KEY, emptyArcadeData } from './storage/arcadeData'
import { dailyPatternForDate, utcDateKey } from './games/dailyPattern'
import { dailyWordForDate, isValidWordGuess } from './games/dailyWord'
import { createConnectionsState } from './games/connections'
import { createSpellingBeeState } from './games/spellingBee'
import { createStrandsState } from './games/strands'
import { createSudokuPuzzle } from './games/sudoku'
import { createMiniCrosswordState } from './games/miniCrossword'
import { letterBoxedSolutionForDate } from './games/letterBoxed'
import { createGlyphMatchPuzzle } from './games/glyphMatch'
import { createVertexPuzzle } from './games/vertex'
import { createTilesPuzzle } from './games/tiles'
import { createPipsPuzzle } from './games/pips'
import { createDailyCrosswordPuzzle } from './games/dailyCrossword'
import { adjacentMineCount, createMinesweeperState, MINESWEEPER_CELL_COUNT, neighboringCells } from './games/minesweeper'
import { cipherCircuitForDate, CIPHER_CIRCUIT_SIGNALS } from './games/cipherCircuit'

async function expectLazyGame(name: string, resumeFakeTimers = false) {
  if (resumeFakeTimers) vi.useRealTimers()
  await screen.findByRole('heading', { name })
  if (resumeFakeTimers) vi.useFakeTimers()
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.localStorage.removeItem(ARCADE_DATA_KEY)
  delete document.documentElement.dataset.reduceMotion
})

describe('Arcade navigation and game controls', () => {
  it('searches the game floor and filters arcade games and daily puzzles', () => {
    render(<App />)

    const search = screen.getByRole('searchbox', { name: 'Find a game' })
    const pipsArticle = screen.getByRole('button', { name: /play pips/i }).closest('article')
    const snakeArticle = screen.getByRole('button', { name: /play snake/i }).closest('article')
    expect(pipsArticle).not.toHaveAttribute('hidden')
    expect(snakeArticle).not.toHaveAttribute('hidden')

    fireEvent.change(search, { target: { value: 'domino' } })
    expect(screen.getByText('Showing 2 of 26 games.')).toBeInTheDocument()
    expect(pipsArticle).not.toHaveAttribute('hidden')
    expect(screen.getByRole('button', { name: /play domino logic/i }).closest('article')).not.toHaveAttribute('hidden')
    expect(snakeArticle).toHaveAttribute('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Arcade' }))
    expect(screen.getByText('No games found. Try another search or filter.')).toBeInTheDocument()
    expect(pipsArticle).toHaveAttribute('hidden')

    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByText('Showing 11 of 26 games.')).toBeInTheDocument()
    expect(snakeArticle).not.toHaveAttribute('hidden')
    expect(pipsArticle).toHaveAttribute('hidden')
    expect(screen.getByRole('button', { name: 'Arcade' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Daily puzzles' }))
    expect(screen.getByText('Showing 16 of 26 games.')).toBeInTheDocument()
    expect(pipsArticle).not.toHaveAttribute('hidden')
    expect(snakeArticle).toHaveAttribute('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'All games' }))
    expect(screen.getByText('Showing all 26 games.')).toBeInTheDocument()
    expect(pipsArticle).not.toHaveAttribute('hidden')
    expect(snakeArticle).not.toHaveAttribute('hidden')
  })

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

  it('checks a backup before restoring it and leaves data unchanged when restore is canceled', async () => {
    const existing = emptyArcadeData()
    existing.bests.snake = 99
    window.localStorage.setItem(ARCADE_DATA_KEY, JSON.stringify(existing))

    const replacement = emptyArcadeData()
    replacement.bests.snake = 12
    replacement.preferences.reduceMotion = true
    replacement.preferences.soundEffects = true
    const contents = JSON.stringify(replacement)
    const file = new File([contents], 'arcade-backup.json', { type: 'application/json' })
    if (typeof file.text !== 'function') Object.defineProperty(file, 'text', { value: async () => contents })

    render(<App />)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()

    fireEvent.change(input!, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/replace this browser’s saved records/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Cancel restore' }))
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.snake).toBe(99)
    expect(screen.queryByRole('button', { name: 'Restore backup' })).not.toBeInTheDocument()

    fireEvent.change(input!, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore backup' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Restore backup' }))
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}')).toEqual(replacement)
    expect(screen.getByText('Backup restored in this browser.')).toBeInTheDocument()
    expect(screen.getByLabelText(/arcade sounds/i)).toBeChecked()
    await waitFor(() => expect(document.documentElement.dataset.reduceMotion).toBe('true'))
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

  it('opens Reaction from the game floor and records a time after the signal', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play reaction/i }))
    await expectLazyGame('Reaction', true)
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

  it('catches a false start, allows restart, and returns to the game floor', async () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /play reaction/i }))
    await expectLazyGame('Reaction', true)
    fireEvent.click(screen.getByRole('button', { name: /start a round/i }))
    fireEvent.click(screen.getByRole('button', { name: /wait for green/i }))

    expect(screen.getByRole('button', { name: /too soon/i })).toBeInTheDocument()
    expect(screen.getByText('Too soon. Wait for green next time.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /restart/i }))
    expect(screen.getByRole('button', { name: /start a round/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    expect(screen.getByRole('heading', { name: 'Choose your game' })).toBeInTheDocument()
  })

  it('opens Pattern Memory, repeats the sequence, pauses, and restarts', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play pattern/i }))
    await expectLazyGame('Remember', true)
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

  it('ends a Pattern Memory run on a wrong tile and lets the player start again', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /play pattern/i }))
    await expectLazyGame('Remember', true)
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }))
    act(() => { vi.advanceTimersByTime(300) })
    act(() => { vi.advanceTimersByTime(440) })
    fireEvent.click(screen.getByRole('button', { name: /top right tile, 2/i }))

    expect(screen.getByRole('status')).toHaveTextContent(/pattern broken/i)
    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(screen.getByRole('status')).toHaveTextContent('Watch the pattern. It will light one tile at a time.')
  })

  it('repeats the deterministic daily pattern without changing the practice best', async () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /play pattern/i }))
    await expectLazyGame('Remember', true)
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

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play breakout/i }))
    await expectLazyGame('Breakout', true)
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

  it('opens Pong and supports keyboard paddle movement, pause, serve, and restart', async () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play pong/i }))
    await expectLazyGame('Pong', true)
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

  it('opens Space Invaders with keyboard and touch controls', async () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play invaders/i }))
    await expectLazyGame('Space Invaders', true)
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
    const moveRight = screen.getByRole('button', { name: 'Move right' })
    const beforeTouchHold = Number.parseFloat(player?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1] ?? '0')
    fireEvent.pointerDown(moveRight, { pointerId: 1, pointerType: 'touch', button: 0 })
    expect(moveRight).toHaveAttribute('aria-pressed', 'true')
    act(() => { vi.advanceTimersByTime(80) })
    const afterTouchHold = Number.parseFloat(player?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1] ?? '0')
    expect(afterTouchHold).toBeGreaterThan(beforeTouchHold)
    fireEvent.pointerUp(moveRight, { pointerId: 1, pointerType: 'touch', button: 0 })
    expect(moveRight).toHaveAttribute('aria-pressed', 'false')
    act(() => { vi.advanceTimersByTime(80) })
    expect(Number.parseFloat(player?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1] ?? '0')).toBe(afterTouchHold)

    const moveLeft = screen.getByRole('button', { name: 'Move left' })
    fireEvent.pointerDown(moveLeft, { pointerId: 2, pointerType: 'touch', button: 0 })
    act(() => { vi.advanceTimersByTime(32) })
    fireEvent.pointerUp(moveLeft, { pointerId: 2, pointerType: 'touch', button: 0 })
    fireEvent.click(moveLeft, { detail: 1 })
    const afterTouchTap = Number.parseFloat(player?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1] ?? '0')
    expect(afterTouchTap).toBeCloseTo(afterTouchHold - 8, 2)
    fireEvent.click(moveLeft)
    expect(Number.parseFloat(player?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1] ?? '0')).toBeCloseTo(afterTouchTap - 8, 2)
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

  it('opens Asteroids with continuous keyboard and touch controls', async () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play asteroids/i }))
    await expectLazyGame('Asteroids', true)
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

  it('opens Missile Command and supports keyboard and touch aiming', async () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play missile command/i }))
    await expectLazyGame('Missile Command', true)
    const board = screen.getByRole('group', { name: 'Missile Command playfield' })
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    act(() => { vi.advanceTimersByTime(20) })
    expect(board).toHaveFocus()

    const aim = board.querySelector('.missile-aim')
    const aimStepPercent = 34 / 600 * 100
    fireEvent.keyDown(board, { key: 'ArrowRight' })
    const afterAimPress = Number(aim?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1])
    expect(afterAimPress).toBeCloseTo(52.56, 2)
    act(() => { vi.advanceTimersByTime(80) })
    const afterAimHold = Number(aim?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1])
    expect(afterAimHold).toBeGreaterThan(afterAimPress)
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    act(() => { vi.advanceTimersByTime(80) })
    expect(Number(aim?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1])).toBe(afterAimHold)

    const aimLeft = screen.getByRole('button', { name: 'Aim left' })
    const beforeAimHold = Number(aim?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1])
    fireEvent.pointerDown(aimLeft, { pointerId: 1, pointerType: 'touch', button: 0 })
    expect(aimLeft).toHaveAttribute('aria-pressed', 'true')
    act(() => { vi.advanceTimersByTime(100) })
    const afterTouchAimHold = Number(aim?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1])
    expect(afterTouchAimHold).toBeLessThan(beforeAimHold - aimStepPercent)
    fireEvent.pointerUp(aimLeft, { pointerId: 1, pointerType: 'touch', button: 0 })
    expect(aimLeft).toHaveAttribute('aria-pressed', 'false')
    act(() => { vi.advanceTimersByTime(80) })
    expect(Number(aim?.getAttribute('style')?.match(/left: ([\d.]+)%/)?.[1])).toBe(afterTouchAimHold)

    fireEvent.keyDown(board, { key: ' ', code: 'Space' })
    expect(board.querySelectorAll('.defense-missile')).toHaveLength(1)
    const aimUp = screen.getByRole('button', { name: 'Aim up' })
    const beforeTouchTap = Number(aim?.getAttribute('style')?.match(/top: ([\d.]+)%/)?.[1])
    fireEvent.pointerDown(aimUp, { pointerId: 2, pointerType: 'touch', button: 0 })
    act(() => { vi.advanceTimersByTime(32) })
    fireEvent.pointerUp(aimUp, { pointerId: 2, pointerType: 'touch', button: 0 })
    fireEvent.click(aimUp, { detail: 1 })
    expect(Number(aim?.getAttribute('style')?.match(/top: ([\d.]+)%/)?.[1])).toBeCloseTo(beforeTouchTap - aimStepPercent, 2)
    fireEvent.click(aimUp)
    expect(Number(aim?.getAttribute('style')?.match(/top: ([\d.]+)%/)?.[1])).toBeCloseTo(30.33, 2)
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

  it('opens Block Drop, handles keyboard and touch controls, and saves a local best', async () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play block drop/i }))
    await expectLazyGame('Block Drop', true)
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

  it('plays and restores the daily word puzzle and records the best solve', async () => {
    const today = utcDateKey()
    const answer = dailyWordForDate(today)
    const firstGuess = ['CRANE', 'BRICK', 'CLOUD', 'SWEET'].find((word) => word !== answer && isValidWordGuess(word))!
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play word guess/i }))
    await expectLazyGame('Word Guess')

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

  it('plays the daily Connections board, restores progress and records a clean solve', async () => {
    const today = utcDateKey()
    const puzzle = createConnectionsState(today)
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play connections/i }))
    await expectLazyGame('Connections')
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

  it('plays and restores the daily Spelling Bee and records the completed score', async () => {
    const today = utcDateKey()
    const puzzle = createSpellingBeeState(today)
    const firstWord = puzzle.words.find((word) => word.length === 4)!
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play spelling bee/i }))
    await expectLazyGame('Spelling Bee')

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

  it('plays and restores the daily Strands board and records a no-hint solve', async () => {
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
    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play strands/i }))
    await expectLazyGame('Strands')
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

  it('plays and restores the daily Sudoku grid and a saved hint', async () => {
    const today = utcDateKey()
    const puzzle = createSudokuPuzzle(today)
    const cellButton = (index: number) => {
      const row = Math.floor(index / 9) + 1
      const column = index % 9 + 1
      return screen.getByRole('button', { name: new RegExp(`^Row ${row}, column ${column},`) })
    }
    render(<App />)
    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play sudoku/i }))
    await expectLazyGame('Sudoku')
    expect(screen.getAllByRole('button', { name: /^Row \d, column \d,/ })).toHaveLength(81)

    const firstEmpty = puzzle.givens.findIndex((given) => !given)
    fireEvent.click(cellButton(firstEmpty))
    fireEvent.click(screen.getByRole('button', { name: `Enter ${puzzle.solution[firstEmpty]}` }))
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailySudokuGame.board[firstEmpty]).toBe(puzzle.solution[firstEmpty])
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailySudokuGame.hintsUsed).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play sudoku/i }))
    expect(cellButton(firstEmpty)).toHaveTextContent(puzzle.solution[firstEmpty]!)
    expect(screen.getAllByRole('button', { name: /revealed by hint/ })).toHaveLength(1)
  })

  it('plays the daily Mini Crossword and restores entries and a saved hint', async () => {
    const today = utcDateKey()
    const puzzle = createMiniCrosswordState(today)
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play mini crossword/i }))
    await expectLazyGame('Mini Crossword')
    const board = screen.getByRole('group', { name: 'Five by five crossword board with black squares' })
    expect(board.querySelectorAll('button')).toHaveLength(21)
    expect(board.querySelectorAll('.mini-crossword-block')).toHaveLength(4)
    fireEvent.keyDown(board.querySelector('button[tabindex="0"]')!, { key: puzzle.solution[0] })
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyMiniCrosswordGame.board[0]).toBe(puzzle.solution[0])
    fireEvent.keyDown(board.querySelector('button[tabindex="0"]')!, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Switch to Across' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyMiniCrosswordGame.hintsUsed).toBe(1)
    expect(document.activeElement).toHaveClass('mini-crossword-cell')

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play mini crossword/i }))
    expect(screen.getByRole('group', { name: 'Five by five crossword board with black squares' }).querySelectorAll('button')[0]).toHaveTextContent(puzzle.solution[0]!)
    expect(screen.getAllByRole('button', { name: /revealed by hint/ })).toHaveLength(1)
  })

  it('plays and restores the daily Letter Boxed word chain', async () => {
    const today = utcDateKey()
    const solution = letterBoxedSolutionForDate(today)
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play letter boxed/i }))
    await expectLazyGame('Letter Boxed')
    const board = screen.getByRole('group', { name: 'Letter Boxed letter sides' })
    expect(board.querySelectorAll('button')).toHaveLength(12)

    for (const word of solution) {
      for (const letter of word) fireEvent.keyDown(board, { key: letter })
      fireEvent.click(screen.getByRole('button', { name: 'Enter word' }))
    }

    expect(screen.getByText('All twelve letters connected.')).toBeInTheDocument()
    const saved = JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}')
    expect(saved.dailyLetterBoxedGame.words).toEqual(solution)
    expect(saved.bests.letterBoxed).toBe(solution.length)

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play letter boxed/i }))
    const restoredChain = screen.getByRole('list', { name: 'Submitted word chain' })
    for (const word of solution) expect(restoredChain).toHaveTextContent(word)
  })

  it('places, saves, and restores daily Domino Logic tiles', async () => {
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play domino logic/i }))
    await expectLazyGame('Domino Logic')
    expect(screen.getByRole('group', { name: 'Three row by four column sum grid' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Domino 1,/ }))
    expect(screen.getByRole('button', { name: /Domino 1,/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Rotate (R)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Flip (F)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Row 1, column 1, empty' }))
    const savedProgress = JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyDominoLogicGame
    expect(savedProgress.placements).toHaveLength(1)
    expect(savedProgress.placements[0]).toMatchObject({ firstCell: 0, orientation: 'vertical', flipped: true })
    expect(screen.getByRole('button', { name: /Domino 1, .*placed/ })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play domino logic/i }))
    expect(screen.getByRole('button', { name: /Domino 1, .*placed/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Row 1, column 1, [1-6]/ })).toBeInTheDocument()
  })

  it('solves, records, and restores the daily Glyph Match board', async () => {
    const puzzle = createGlyphMatchPuzzle(utcDateKey())
    const pairs = new Map<string, number[]>()
    puzzle.glyphs.forEach((glyph, index) => pairs.set(glyph, [...(pairs.get(glyph) ?? []), index]))
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play glyph match/i }))
    await expectLazyGame('Glyph Match')
    expect(screen.getByRole('group', { name: 'Sixteen tile matching board' })).toBeInTheDocument()

    for (const indices of pairs.values()) {
      for (const index of indices) {
        fireEvent.click(screen.getByRole('button', { name: `Tile ${index + 1}, face down` }))
      }
    }

    expect(screen.getByText('Board complete in 8 turns. A fresh puzzle arrives tomorrow.')).toBeInTheDocument()
    const savedProgress = JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyGlyphMatchGame
    expect(savedProgress.matchedIndices).toHaveLength(16)
    expect(savedProgress.moves).toBe(8)
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.glyphMatch).toBe(8)

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play glyph match/i }))
    expect(screen.getByText('All eight pairs found. A fresh board arrives tomorrow.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /matched/ })).toHaveLength(16)
    for (const tile of screen.getAllByRole('button', { name: /matched/ })) expect(tile).toBeDisabled()
  })

  it('solves, saves, and restores the daily Vertex loop', async () => {
    const puzzle = createVertexPuzzle(utcDateKey())
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play vertex/i }))
    await expectLazyGame('Vertex')
    expect(screen.getByRole('group', { name: /triangular vertex loop puzzle/i })).toBeInTheDocument()

    for (const edgeId of puzzle.solutionEdges) {
      const edge = puzzle.edges.find((candidate) => candidate.id === edgeId)!
      const from = puzzle.vertices[edge.from]!
      const to = puzzle.vertices[edge.to]!
      fireEvent.click(screen.getByRole('button', { name: `Line from vertex ${edge.from + 1} (clue ${from.clue}) to vertex ${edge.to + 1} (clue ${to.clue}), not selected` }))
    }

    expect(screen.getByText(`Loop complete in ${puzzle.solutionEdges.length} moves. A fresh puzzle arrives tomorrow.`)).toBeInTheDocument()
    const saved = JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}')
    expect(saved.dailyVertexGame.selectedEdges).toHaveLength(puzzle.solutionEdges.length)
    expect(saved.bests.vertex).toBe(puzzle.solutionEdges.length)

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play vertex/i }))
    expect(screen.getByText(`Loop complete in ${puzzle.solutionEdges.length} moves. A fresh puzzle arrives tomorrow.`)).toBeInTheDocument()
  })

  it('clears, records, and restores the daily Tiles board', async () => {
    const puzzle = createTilesPuzzle(utcDateKey())
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play tiles/i }))
    await expectLazyGame('Tiles')
    expect(screen.getByRole('group', { name: 'Four row by five column pattern matching board' })).toBeInTheDocument()

    for (const pair of puzzle.solutionPairs) {
      for (const index of pair) fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Tile ${index + 1},`) }))
    }

    expect(screen.getByText('All ten pairs cleared in 10 moves. A fresh board arrives tomorrow.')).toBeInTheDocument()
    const saved = JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}')
    expect(saved.dailyTilesGame.clearedIndices).toHaveLength(20)
    expect(saved.bests.tiles).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play tiles/i }))
    expect(screen.getByText('All ten pairs cleared in 10 moves. A fresh board arrives tomorrow.')).toBeInTheDocument()
    for (const tile of screen.getAllByRole('button', { name: /pair cleared/ })) expect(tile).toBeDisabled()
  })

  it('places and saves a complete daily Pips board', async () => {
    const puzzle = createPipsPuzzle(utcDateKey())
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play pips/i }))
    await expectLazyGame('Pips')
    expect(screen.getByRole('group', { name: 'Three row by four column Pips board' })).toBeInTheDocument()

    for (const placement of puzzle.solution) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Domino ${placement.dominoId + 1},`) }))
      if (placement.orientation === 'vertical') fireEvent.click(screen.getByRole('button', { name: 'Rotate (R)' }))
      if (placement.flipped) fireEvent.click(screen.getByRole('button', { name: 'Flip (F)' }))
      const row = Math.floor(placement.firstCell / 4) + 1
      const column = (placement.firstCell % 4) + 1
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Row ${row}, column ${column},`) }))
    }

    expect(screen.getByText(/Every region fits in 0 undos/)).toBeInTheDocument()
    const saved = JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}')
    expect(saved.dailyPipsGame.placements).toHaveLength(6)
    expect(saved.bests.pips).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play pips/i }))
    expect(screen.getByText('Every region fits. A new Pips board arrives tomorrow.')).toBeInTheDocument()
  }, 10_000)

  it('fills, saves, and restores the daily Crossword grid', async () => {
    const puzzle = createDailyCrosswordPuzzle(utcDateKey())
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play daily crossword/i }))
    await expectLazyGame('Daily Crossword')
    expect(screen.getByRole('group', { name: 'Seven by seven crossword board with black squares' })).toBeInTheDocument()

    for (const entry of puzzle.across) {
      fireEvent.click(screen.getByRole('button', { name: `Across ${entry.number}: ${entry.clue}` }))
      for (const cell of entry.cells) {
        const target = document.activeElement
        expect(target).toHaveClass('daily-crossword-cell')
        fireEvent.keyDown(target!, { key: puzzle.solution[cell]!.toLowerCase() })
      }
    }

    expect(screen.getByText('Puzzle solved. A fresh crossword arrives tomorrow.')).toBeInTheDocument()
    const saved = JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}')
    expect(saved.dailyCrosswordGame.board).toHaveLength(49)
    expect(saved.bests.crossword).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play daily crossword/i }))
    expect(screen.getByText('Puzzle solved. A fresh crossword arrives tomorrow.')).toBeInTheDocument()
  })

  it('chords a numbered Minesweeper cell with the C key after its mines are flagged', async () => {
    const puzzle = createMinesweeperState(utcDateKey())
    const target = Array.from({ length: MINESWEEPER_CELL_COUNT }, (_, cell) => cell)
      .find((cell) => !puzzle.mines.includes(cell)
        && adjacentMineCount(puzzle, cell) > 0
        && neighboringCells(cell).some((neighbor) => !puzzle.mines.includes(neighbor)))!
    const mineNeighbors = neighboringCells(target).filter((neighbor) => puzzle.mines.includes(neighbor))
    const safeNeighbors = neighboringCells(target).filter((neighbor) => !puzzle.mines.includes(neighbor))
    const progress = { date: puzzle.date, revealed: [target], flagged: [], elapsedSeconds: 0, phase: 'playing' as const }
    window.localStorage.setItem(ARCADE_DATA_KEY, JSON.stringify({ ...emptyArcadeData(), dailyMinesweeperGame: progress }))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /play minesweeper/i }))
    await expectLazyGame('Minesweeper')
    const board = screen.getByRole('group', { name: 'Daily Minesweeper board, 9 rows by 9 columns' })
    const targetButton = board.querySelector<HTMLButtonElement>(`[data-minesweeper-cell="${target}"]`)!
    expect(targetButton).toHaveAttribute('aria-keyshortcuts', 'C')
    expect(targetButton).toHaveAccessibleName(/neighboring mine/)

    fireEvent.click(screen.getByRole('button', { name: 'Flag mode off' }))
    for (const mine of mineNeighbors) fireEvent.click(board.querySelector(`[data-minesweeper-cell="${mine}"]`)!)
    fireEvent.click(screen.getByRole('button', { name: 'Flag mode on' }))
    targetButton.focus()
    fireEvent.keyDown(targetButton, { key: 'c' })

    for (const neighbor of safeNeighbors) {
      expect(board.querySelector(`[data-minesweeper-cell="${neighbor}"]`)).not.toHaveAccessibleName(/covered/)
    }
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyMinesweeperGame.revealed).toEqual(expect.arrayContaining(safeNeighbors))
  })

  it('plays the shared Minesweeper field and saves progress and a local best', async () => {
    vi.useFakeTimers()
    const puzzle = createMinesweeperState(utcDateKey())
    render(<App />)

    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play minesweeper/i }))
    await expectLazyGame('Minesweeper', true)
    const board = screen.getByRole('group', { name: 'Daily Minesweeper board, 9 rows by 9 columns' })
    const firstMine = puzzle.mines[0]!

    fireEvent.click(screen.getByRole('button', { name: 'Start field' }))
    act(() => { vi.advanceTimersByTime(20) })
    expect(document.activeElement).toHaveAttribute('data-minesweeper-cell', '40')
    act(() => { vi.advanceTimersByTime(1080) })
    fireEvent.click(screen.getByRole('button', { name: 'Flag mode off' }))
    fireEvent.click(board.querySelector(`[data-minesweeper-cell="${firstMine}"]`)!)
    expect(board.querySelector(`[data-minesweeper-cell="${firstMine}"]`)).toHaveAccessibleName(/flagged/)
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyMinesweeperGame.flagged).toContain(firstMine)

    fireEvent.click(screen.getByRole('button', { name: 'Reveal mode' }))
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('0:01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    act(() => { vi.advanceTimersByTime(1000) })

    for (let cell = 0; cell < 81; cell += 1) {
      if (!puzzle.mines.includes(cell)) fireEvent.click(board.querySelector(`[data-minesweeper-cell="${cell}"]`)!)
    }

    expect(screen.getByText('Field cleared!')).toBeInTheDocument()
    const saved = JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}')
    expect(saved.dailyMinesweeperGame.phase).toBe('won')
    expect(saved.bests.minesweeper).toBe(2)
    expect(screen.getAllByText('0:02')).toHaveLength(2)
  }, 10_000)

  it('plays Maze Dash with keyboard and touch controls and saves a local best', async () => {
    render(<App />)
    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play maze dash/i }))
    await expectLazyGame('Maze Dash')

    const board = screen.getByRole('group', { name: /maze dash board/i })
    expect(board.querySelectorAll('.maze-gem').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Start maze' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move right' }))
    fireEvent.keyDown(board, { key: 'ArrowRight' })
    fireEvent.keyUp(window, { key: 'ArrowRight' })

    expect(screen.getAllByText('020')).toHaveLength(2)
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.mazeDash).toBe(20)
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(screen.getByText('Run paused')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /resume/i }))
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restart maze' }))
    expect(screen.getByRole('button', { name: 'Start maze' })).toBeInTheDocument()
  })

  it('runs Skyline Skip with touch and keyboard controls and saves a local best', async () => {
    vi.useFakeTimers()
    render(<App />)
    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play skyline skip/i }))
    await expectLazyGame('Skyline Skip', true)

    const stage = screen.getByRole('group', { name: /skyline skip course/i })
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }))
    const runRight = screen.getByRole('button', { name: 'Run right' })
    fireEvent.pointerDown(runRight, { pointerId: 1 })
    act(() => { vi.advanceTimersByTime(650) })
    fireEvent.pointerUp(runRight, { pointerId: 1 })
    expect(JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').bests.skylineSkip).toBeGreaterThan(0)

    fireEvent.keyDown(stage, { key: 'Escape' })
    expect(screen.getByText('Run paused')).toBeInTheDocument()
    fireEvent.keyDown(stage, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restart run' }))
    expect(screen.getByRole('button', { name: 'Start run' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }))
    const runner = stage.querySelector('.skyline-runner')
    fireEvent.keyDown(stage, { key: 'ArrowRight' })
    act(() => { vi.advanceTimersByTime(320) })
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    expect(runner?.getAttribute('transform')).not.toBe('translate(0, 268)')
  })

  it('plays and restores the daily Cipher Circuit and records a solved key', async () => {
    render(<App />)
    expect(screen.getByText('26 PLAYABLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Daily puzzles' }))
    expect(screen.getByText('Showing 16 of 26 games.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /play cipher circuit/i }))
    await expectLazyGame('Cipher Circuit')

    fireEvent.click(screen.getByRole('button', { name: /choose mint signal/i }))
    fireEvent.click(screen.getByRole('button', { name: /choose coral signal/i }))
    const savedInput = JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}').dailyCipherCircuitGame
    expect(savedInput.activeGuess.slice(0, 2)).toEqual([0, 1])

    fireEvent.click(screen.getByRole('button', { name: /all games/i }))
    fireEvent.click(screen.getByRole('button', { name: /play cipher circuit/i }))
    await expectLazyGame('Cipher Circuit')
    const board = screen.getByRole('group', { name: /eight signal attempts/i })
    expect(screen.getByRole('button', { name: 'Socket 1: Mint signal' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear row' }))

    for (const signal of cipherCircuitForDate(utcDateKey())) fireEvent.keyDown(board, { key: String(signal + 1) })
    fireEvent.keyDown(board, { key: 'Enter' })
    expect(screen.getByText('Circuit aligned')).toBeInTheDocument()
    const completed = JSON.parse(window.localStorage.getItem(ARCADE_DATA_KEY) ?? '{}')
    expect(completed.dailyCipherCircuitGame.phase).toBe('solved')
    expect(completed.bests.cipherCircuit).toBe(1)
    expect(CIPHER_CIRCUIT_SIGNALS).toHaveLength(6)
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
      dailyMiniCrosswordGame: null,
      dailyLetterBoxedGame: null,
      dailyDominoLogicGame: null,
      dailyGlyphMatchGame: null,
      dailyVertexGame: null,
      dailyTilesGame: null,
      dailyPipsGame: null,
      dailyCrosswordGame: null,
      dailyMinesweeperGame: null, dailyCipherCircuitGame: null,
      bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null, letterBoxed: null, dominoLogic: null, glyphMatch: null, vertex: null, tiles: null, pips: null, crossword: null, minesweeper: null, mazeDash: null, skylineSkip: null, cipherCircuit: null },
      preferences: { reduceMotion: true, soundEffects: false, pongDifficulty: 'steady' },
    })
    expect(screen.getByText('No saved records.')).toBeInTheDocument()
  })
})
