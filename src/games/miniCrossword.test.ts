import { describe, expect, it } from 'vitest'
import {
  MINI_CROSSWORD_DAILY_COUNT,
  MINI_CROSSWORD_SIDE,
  createMiniCrosswordPuzzle,
  createMiniCrosswordState,
  miniCrosswordEntry,
  miniCrosswordProgress,
  miniCrosswordReducer,
  validMiniCrosswordProgress,
} from './miniCrossword'

const DATE = '2026-11-19'

describe('daily mini crossword', () => {
  it('builds deterministic 5-by-5 puzzles whose across and down answers cross', () => {
    const first = createMiniCrosswordPuzzle(DATE)
    expect(createMiniCrosswordPuzzle(DATE)).toEqual(first)
    expect(first.solution).toHaveLength(MINI_CROSSWORD_SIDE ** 2)

    const dailyBoards = new Set<string>()
    for (let offset = 0; offset < MINI_CROSSWORD_DAILY_COUNT; offset += 1) {
      const date = new Date(`${DATE}T00:00:00.000Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      const puzzle = createMiniCrosswordPuzzle(date.toISOString().slice(0, 10))
      expect(puzzle.across).toHaveLength(MINI_CROSSWORD_SIDE)
      expect(puzzle.down).toHaveLength(MINI_CROSSWORD_SIDE)
      for (let number = 0; number < MINI_CROSSWORD_SIDE; number += 1) {
        const acrossWord = puzzle.solution.slice(number * MINI_CROSSWORD_SIDE, (number + 1) * MINI_CROSSWORD_SIDE).join('')
        const downWord = Array.from({ length: MINI_CROSSWORD_SIDE }, (_, row) => puzzle.solution[row * MINI_CROSSWORD_SIDE + number]).join('')
        expect(acrossWord).toBe(puzzle.across[number]!.answer)
        expect(downWord).toBe(puzzle.down[number]!.answer)
        expect(puzzle.across[number]!.clue.length).toBeGreaterThan(0)
        expect(puzzle.down[number]!.clue.length).toBeGreaterThan(0)
      }
      dailyBoards.add(puzzle.solution.join(''))
    }
    expect(dailyBoards.size).toBe(MINI_CROSSWORD_DAILY_COUNT)
  })

  it('enters letters across and down and advances within the selected answer', () => {
    let state = createMiniCrosswordState(DATE)
    const across = state.across[0]!
    expect(miniCrosswordEntry(state)).toEqual(across)
    for (const letter of across.answer) state = miniCrosswordReducer(state, { type: 'letter', letter })
    expect(state.board.slice(0, 5).join('')).toBe(across.answer)
    expect(state.selectedCell).toBe(5)

    state = miniCrosswordReducer(state, { type: 'select', index: 2 })
    state = miniCrosswordReducer(state, { type: 'toggleDirection' })
    expect(state.direction).toBe('down')
    expect(miniCrosswordEntry(state)).toEqual(state.down[2])
    state = miniCrosswordReducer(state, { type: 'letter', letter: state.down[2]!.answer[0]! })
    expect(state.board[2]).toBe(state.down[2]!.answer[0])
    expect(state.selectedCell).toBe(7)

    state = miniCrosswordReducer(state, { type: 'backspace' })
    expect(state.board[2]).toBe('')
    expect(state.selectedCell).toBe(2)
  })

  it('reveals and restores a hint, locks the square, and resets entries', () => {
    let state = createMiniCrosswordState(DATE)
    state = miniCrosswordReducer(state, { type: 'hint' })
    const hintedCell = state.hintedCells[0]!
    expect(state.board[hintedCell]).toBe(state.solution[hintedCell])
    const locked = miniCrosswordReducer(state, { type: 'letter', letter: 'Z' })
    expect(locked.board[hintedCell]).toBe(state.solution[hintedCell])
    expect(locked.message).toBe('Hinted squares are locked.')

    const progress = miniCrosswordProgress(state)
    expect(validMiniCrosswordProgress(progress)).toBe(true)
    const restored = createMiniCrosswordState(DATE, progress)
    expect(restored.board).toEqual(state.board)
    expect(restored.hintsUsed).toBe(1)
    expect(restored.hintedCells).toEqual([hintedCell])
    expect(validMiniCrosswordProgress({ ...progress, hintedCells: [25] })).toBe(false)

    state = miniCrosswordReducer(restored, { type: 'reset' })
    expect(state.board.every((letter) => letter === '')).toBe(true)
    expect(state.hintsUsed).toBe(0)
  })

  it('completes the crossword only when all letters match the solution', () => {
    let state = createMiniCrosswordState(DATE)
    state = miniCrosswordReducer(state, { type: 'letter', letter: 'Z' })
    expect(state.phase).toBe('playing')

    for (let index = 0; index < state.solution.length; index += 1) {
      state = miniCrosswordReducer(state, { type: 'select', index })
      state = miniCrosswordReducer(state, { type: 'letter', letter: state.solution[index]! })
    }
    expect(state.phase).toBe('complete')
    expect(miniCrosswordProgress(state).board).toEqual(state.solution)
    expect(miniCrosswordReducer(state, { type: 'hint' })).toBe(state)
  })

  it('rejects invalid dates and malformed saved progress', () => {
    expect(() => createMiniCrosswordPuzzle('2026-02-30')).toThrow(RangeError)
    expect(validMiniCrosswordProgress({ date: DATE, board: [], hintsUsed: 0, hintedCells: [] })).toBe(false)
  })
})
