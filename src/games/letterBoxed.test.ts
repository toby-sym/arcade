import { describe, expect, it } from 'vitest'
import {
  LETTER_BOXED_DAILY_COUNT,
  createLetterBoxedPuzzle,
  createLetterBoxedState,
  letterBoxedProgress,
  letterBoxedReducer,
  letterBoxedSolutionForDate,
  validLetterBoxedProgress,
} from './letterBoxed'

const DATE = '2026-01-01'

function enterWord(state: ReturnType<typeof createLetterBoxedState>, word: string) {
  for (const letter of word) state = letterBoxedReducer(state, { type: 'letter', letter })
  return letterBoxedReducer(state, { type: 'submit' })
}

describe('daily Letter Boxed', () => {
  it('builds deterministic daily boxes with a valid complete chain', () => {
    const first = createLetterBoxedPuzzle(DATE)
    expect(createLetterBoxedPuzzle(DATE)).toEqual(first)
    const boards = new Set<string>()

    for (let offset = 0; offset < LETTER_BOXED_DAILY_COUNT; offset += 1) {
      const date = new Date(`${DATE}T00:00:00.000Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      const puzzleDate = date.toISOString().slice(0, 10)
      const puzzle = createLetterBoxedPuzzle(puzzleDate)
      const solution = letterBoxedSolutionForDate(puzzleDate)
      expect(puzzle.sides.map((side) => side.length)).toEqual([3, 3, 3, 3])
      expect(new Set(puzzle.letters).size).toBe(12)
      expect(new Set(solution).size).toBe(3)
      expect(solution.every((word) => word.length >= 3)).toBe(true)

      let state = createLetterBoxedState(puzzleDate)
      for (const word of solution) state = enterWord(state, word)
      expect(state.phase, `${puzzleDate}: ${state.message}; accepted ${state.words.join(', ')}`).toBe('complete')
      expect(state.words).toEqual(solution)
      expect(state.coveredLetters).toHaveLength(12)
      boards.add(puzzle.sides.map((side) => side.join('')).join('|'))
    }
    expect(boards.size).toBe(LETTER_BOXED_DAILY_COUNT)
  })

  it('enforces side changes and word chaining while allowing backspace and clearing', () => {
    let state = createLetterBoxedState(DATE)
    state = letterBoxedReducer(state, { type: 'letter', letter: 'R' })
    const sameSide = letterBoxedReducer(state, { type: 'letter', letter: 'N' })
    expect(sameSide.draft).toBe('R')
    expect(sameSide.message).toMatch(/switch sides/i)
    state = letterBoxedReducer(sameSide, { type: 'backspace' })
    expect(state.draft).toBe('')

    state = enterWord(state, 'CRANE')
    expect(state.words).toEqual(['CRANE'])
    state = enterWord(state, 'CAR')
    expect(state.words).toEqual(['CRANE'])
    expect(state.message).toBe('Start this word with E.')

    state = letterBoxedReducer(state, { type: 'letter', letter: 'E' })
    state = letterBoxedReducer(state, { type: 'letter', letter: 'L' })
    state = letterBoxedReducer(state, { type: 'letter', letter: 'B' })
    state = letterBoxedReducer(state, { type: 'clear' })
    expect(state.draft).toBe('')
  })

  it('saves, restores, and undoes a chain without losing covered letters', () => {
    let state = enterWord(createLetterBoxedState(DATE), 'CRANE')
    const progress = letterBoxedProgress(state)
    expect(validLetterBoxedProgress(progress)).toBe(true)
    expect(createLetterBoxedState(DATE, progress).words).toEqual(['CRANE'])

    state = enterWord(state, 'ELBOW')
    expect(state.coveredLetters.length).toBeGreaterThan(progress.words[0]!.length)
    state = letterBoxedReducer(state, { type: 'undo' })
    expect(state.words).toEqual(['CRANE'])
    expect(createLetterBoxedState(DATE, letterBoxedProgress(state)).words).toEqual(['CRANE'])
    expect(validLetterBoxedProgress({ ...progress, words: ['NOPE'] })).toBe(true)
    expect(createLetterBoxedState(DATE, { ...progress, words: ['NOPE'] }).words).toEqual([])
  })

  it('rejects invalid dates and malformed saved progress', () => {
    expect(() => createLetterBoxedPuzzle('2026-02-30')).toThrow(RangeError)
    expect(validLetterBoxedProgress({ date: DATE, words: ['bad word'] })).toBe(false)
    expect(validLetterBoxedProgress({ date: '2026-02-30', words: [] })).toBe(false)
  })
})
