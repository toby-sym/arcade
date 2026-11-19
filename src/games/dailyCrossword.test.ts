import { describe, expect, it } from 'vitest'
import {
  DAILY_CROSSWORD_COUNT,
  DAILY_CROSSWORD_SIDE,
  createDailyCrosswordPuzzle,
  createDailyCrosswordState,
  dailyCrosswordProgress,
  dailyCrosswordReducer,
  validDailyCrosswordProgress,
} from './dailyCrossword'

describe('daily crossword boards', () => {
  it('builds distinct, fully clued 7-by-7 crosswords with independent Across and Down answers', () => {
    const puzzles = Array.from({ length: DAILY_CROSSWORD_COUNT }, (_, day) => {
      const date = `2026-01-${String(day + 1).padStart(2, '0')}`
      return createDailyCrosswordPuzzle(date)
    })
    expect(new Set(puzzles.map((puzzle) => puzzle.solution.join(''))).size).toBe(DAILY_CROSSWORD_COUNT)

    for (const puzzle of puzzles) {
      expect(puzzle.solution).toHaveLength(DAILY_CROSSWORD_SIDE ** 2)
      expect(puzzle.across).toHaveLength(12)
      expect(puzzle.down).toHaveLength(12)
      expect(new Set([...puzzle.across, ...puzzle.down].map((entry) => entry.answer)).size).toBe(24)
      expect([...puzzle.across, ...puzzle.down].every((entry) => entry.clue.length > 0 && entry.cells.length === 3)).toBe(true)
      for (const across of puzzle.across) {
        const down = puzzle.down.find((entry) => entry.number === across.number)
        if (down) expect(down.answer).not.toBe(across.answer)
      }
    }
  })

  it('fills, hints, clears, and restores the same daily grid', () => {
    const initial = createDailyCrosswordState('2026-11-19')
    const hint = dailyCrosswordReducer(initial, { type: 'hint' })
    expect(hint.hintsUsed).toBe(1)
    expect(hint.board[hint.hintedCells[0]!]).toBe(hint.solution[hint.hintedCells[0]!]!)
    expect(validDailyCrosswordProgress(dailyCrosswordProgress(hint))).toBe(true)

    const blockedCell = hint.solution.findIndex((cell) => cell === '#')
    expect(dailyCrosswordReducer(hint, { type: 'select', index: blockedCell })).toBe(hint)
    expect(validDailyCrosswordProgress({ ...dailyCrosswordProgress(hint), hintedCells: [blockedCell] })).toBe(false)
    expect(validDailyCrosswordProgress({ ...dailyCrosswordProgress(hint), board: ['bad'] })).toBe(false)

    const restored = createDailyCrosswordState(initial.date, dailyCrosswordProgress(hint))
    expect(restored.board).toEqual(hint.board)
    expect(restored.hintedCells).toEqual(hint.hintedCells)
    const reset = dailyCrosswordReducer(restored, { type: 'reset' })
    expect(reset.hintsUsed).toBe(0)
    expect(reset.board.filter((cell) => cell !== '' && cell !== '#')).toHaveLength(0)
  })

  it('completes the puzzle from its crossing entries and locks the solved board', () => {
    const initial = createDailyCrosswordState('2026-11-19')
    const solved = initial.solution.reduce((state, letter, index) => {
      if (letter === '#') return state
      const selected = dailyCrosswordReducer(state, { type: 'select', index })
      return dailyCrosswordReducer(selected, { type: 'letter', letter })
    }, initial)

    expect(solved.phase).toBe('complete')
    expect(dailyCrosswordProgress(solved).board).toEqual(solved.solution)
    expect(dailyCrosswordReducer(solved, { type: 'hint' })).toBe(solved)
  })

  it('rejects invalid dates', () => {
    expect(() => createDailyCrosswordPuzzle('2026-02-30')).toThrow(RangeError)
  })
})
