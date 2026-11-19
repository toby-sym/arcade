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
      expect(puzzle.across).toHaveLength(5)
      expect(puzzle.down).toHaveLength(5)
      expect(puzzle.solution.filter((cell) => cell !== '#')).toHaveLength(21)
      expect(puzzle.across.map((entry) => entry.number)).toEqual([1, 4, 7, 8, 9])
      expect(puzzle.down.map((entry) => entry.number)).toEqual([1, 2, 3, 5, 6])
      const allEntries = [...puzzle.across, ...puzzle.down]
      expect(new Set(allEntries.map((entry) => entry.answer)).size).toBe(10)
      for (const entry of allEntries) {
        expect(entry.cells.map((cell) => puzzle.solution[cell]).join('')).toBe(entry.answer)
        expect(entry.clue.length).toBeGreaterThan(0)
      }
      expect(puzzle.across.map((entry) => entry.answer.length)).toEqual([3, 5, 5, 5, 3])
      expect(puzzle.down.map((entry) => entry.answer.length)).toEqual([4, 4, 5, 4, 4])

      const acrossCells = new Set(puzzle.across.flatMap((entry) => entry.cells))
      const downCells = new Set(puzzle.down.flatMap((entry) => entry.cells))
      expect(acrossCells.size).toBe(21)
      expect(downCells).toEqual(acrossCells)
      for (const cell of acrossCells) {
        const crossingLetters = allEntries
          .filter((entry) => entry.cells.includes(cell))
          .map((entry) => entry.answer[entry.cells.indexOf(cell)])
        expect(new Set(crossingLetters).size).toBe(1)
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
    expect(across.cells.map((cell) => state.board[cell]).join('')).toBe(across.answer)
    expect(state.selectedCell).toBe(across.cells.at(-1))

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
    expect(miniCrosswordReducer(state, { type: 'select', index: 3 })).toBe(state)

    state = miniCrosswordReducer(restored, { type: 'reset' })
    expect(state.board.filter((letter) => letter === '#')).toHaveLength(4)
    expect(state.board.filter((letter) => letter !== '' && letter !== '#')).toHaveLength(0)
    expect(state.hintsUsed).toBe(0)
  })

  it('completes the crossword only when all letters match the solution', () => {
    let state = createMiniCrosswordState(DATE)
    state = miniCrosswordReducer(state, { type: 'letter', letter: 'Z' })
    expect(state.phase).toBe('playing')

    for (let index = 0; index < state.solution.length; index += 1) {
      if (state.solution[index] === '#') continue
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
