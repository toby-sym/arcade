import { describe, expect, it } from 'vitest'
import {
  adjacentMineCount,
  createMinesweeperState,
  isMinesweeperProgress,
  minesweeperReducer,
  MINESWEEPER_CELL_COUNT,
  MINESWEEPER_MINE_COUNT,
  MINESWEEPER_OPENING_INDEX,
  toMinesweeperProgress,
} from './minesweeper'

describe('Minesweeper', () => {
  it('creates a stable daily field with a safe opening', () => {
    const first = createMinesweeperState('2026-11-19')
    const second = createMinesweeperState('2026-11-19')

    expect(first.mines).toHaveLength(MINESWEEPER_MINE_COUNT)
    expect(first.mines).toEqual(second.mines)
    expect(createMinesweeperState('2026-11-20').mines).not.toEqual(first.mines)
    expect(first.revealed).toContain(MINESWEEPER_OPENING_INDEX)
    expect(first.mines).not.toContain(MINESWEEPER_OPENING_INDEX)
    expect(adjacentMineCount(first, MINESWEEPER_OPENING_INDEX)).toBe(0)
    expect(first.revealed.length).toBeGreaterThan(1)
  })

  it('flags covered cells and leaves opened cells unchanged', () => {
    const state = createMinesweeperState('2026-11-19')
    const coveredCell = Array.from({ length: MINESWEEPER_CELL_COUNT }, (_, cell) => cell)
      .find((cell) => !state.revealed.includes(cell))!
    const flagged = minesweeperReducer(state, { type: 'toggleFlag', cell: coveredCell })

    expect(flagged.flagged).toContain(coveredCell)
    expect(minesweeperReducer(flagged, { type: 'reveal', cell: coveredCell }).revealed).not.toContain(coveredCell)
    expect(minesweeperReducer(state, { type: 'toggleFlag', cell: MINESWEEPER_OPENING_INDEX })).toBe(state)
  })

  it('loses on a mine and keeps pause and elapsed time local to the run', () => {
    const state = minesweeperReducer(createMinesweeperState('2026-11-19'), { type: 'start' })
    const lost = minesweeperReducer(state, { type: 'reveal', cell: state.mines[0]! })
    expect(lost.phase).toBe('lost')
    expect(lost.revealed).toEqual(expect.arrayContaining(state.mines))

    const paused = minesweeperReducer(state, { type: 'pause' })
    expect(minesweeperReducer(paused, { type: 'tick' }).elapsedSeconds).toBe(0)
    const resumed = minesweeperReducer(paused, { type: 'resume' })
    expect(minesweeperReducer(resumed, { type: 'tick' }).elapsedSeconds).toBe(1)
    expect(minesweeperReducer(resumed, { type: 'restart' }).elapsedSeconds).toBe(0)
  })

  it('wins after revealing every safe cell and restores validated daily progress', () => {
    const state = createMinesweeperState('2026-11-19')
    const safeCells = Array.from({ length: MINESWEEPER_CELL_COUNT }, (_, cell) => cell)
      .filter((cell) => !state.mines.includes(cell))
    const lastCell = safeCells.at(-1)!
    const almostWon = { ...state, revealed: safeCells.filter((cell) => cell !== lastCell) }
    expect(minesweeperReducer(almostWon, { type: 'reveal', cell: lastCell }).phase).toBe('won')

    const progress = { ...toMinesweeperProgress(state), elapsedSeconds: 42, flagged: [state.mines[0]!] }
    expect(isMinesweeperProgress(progress)).toBe(true)
    const restored = createMinesweeperState('2026-11-19', progress)
    expect(restored.elapsedSeconds).toBe(42)
    expect(restored.flagged).toEqual(progress.flagged)
    expect(restored.revealed).toEqual(state.revealed)
    expect(createMinesweeperState('2026-11-20', progress).elapsedSeconds).toBe(0)
    expect(isMinesweeperProgress({ ...progress, flagged: [999] })).toBe(false)
  })
})
