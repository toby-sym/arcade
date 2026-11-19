import { describe, expect, it } from 'vitest'
import {
  STRANDS_COLUMNS,
  STRANDS_DAILY_PUZZLE_COUNT,
  STRANDS_ROWS,
  createStrandsPuzzle,
  createStrandsState,
  strandsProgress,
  strandsReducer,
  validStrandsProgress,
} from './strands'

const DATE = '2026-11-19'

function findWord(state: ReturnType<typeof createStrandsState>, word: string) {
  return state.paths[word]!.reduce((next, index) => strandsReducer(next, { type: 'select', index }), state)
}

describe('daily Strands puzzle', () => {
  it('builds deterministic connected paths for each daily theme', () => {
    const first = createStrandsPuzzle(DATE)
    expect(createStrandsPuzzle(DATE)).toEqual(first)
    expect(first.grid).toHaveLength(STRANDS_ROWS * STRANDS_COLUMNS)
    expect(first.words).toHaveLength(6)
    expect(first.spangram.length).toBeGreaterThanOrEqual(8)
    expect(first.paths[first.spangram]![0]! % STRANDS_COLUMNS).toBe(0)
    expect(first.paths[first.spangram]!.some((index) => index % STRANDS_COLUMNS === STRANDS_COLUMNS - 1)).toBe(true)

    const occupied = new Set<number>()
    const themes = new Set<string>()
    for (let offset = 0; offset < STRANDS_DAILY_PUZZLE_COUNT; offset += 1) {
      const date = new Date(`${DATE}T00:00:00.000Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      const puzzle = createStrandsPuzzle(date.toISOString().slice(0, 10))
      expect(puzzle.grid.every((letter) => /^[A-Z]$/.test(letter))).toBe(true)
      expect(new Set(puzzle.words).size).toBe(6)

      for (const word of puzzle.words) {
        const path = puzzle.paths[word]!
        expect(path).toHaveLength(word.length)
        expect(path.map((index) => puzzle.grid[index]).join('')).toBe(word)
        for (let position = 0; position < path.length; position += 1) {
          const index = path[position]!
          expect(occupied.has(index)).toBe(false)
          occupied.add(index)
          if (position > 0) {
            const previous = path[position - 1]!
            const rowDistance = Math.abs(Math.floor(previous / STRANDS_COLUMNS) - Math.floor(index / STRANDS_COLUMNS))
            const columnDistance = Math.abs(previous % STRANDS_COLUMNS - index % STRANDS_COLUMNS)
            expect(rowDistance).toBeLessThanOrEqual(1)
            expect(columnDistance).toBeLessThanOrEqual(1)
            expect(rowDistance + columnDistance).toBeGreaterThan(0)
          }
        }
      }
      occupied.clear()
      themes.add(puzzle.theme)
    }
    expect(themes.size).toBe(STRANDS_DAILY_PUZZLE_COUNT)
  })

  it('finds theme words and the spangram by tracing adjacent letters', () => {
    let state = createStrandsState(DATE)
    const word = state.words.find((candidate) => candidate !== state.spangram)!
    state = findWord(state, word)

    expect(state.foundWords).toEqual([word])
    expect(state.selection).toEqual([])
    expect(state.message).toContain(`Found ${word}`)

    state = findWord(state, state.spangram)
    expect(state.foundWords).toContain(state.spangram)
    expect(state.message).toContain('Spangram found')
  })

  it('supports undo, clear, restarts a disconnected path and preserves a hint', () => {
    let state = createStrandsState(DATE)
    const word = state.words.find((candidate) => candidate !== state.spangram)!
    state = strandsReducer(state, { type: 'select', index: state.paths[word]![0]! })
    state = strandsReducer(state, { type: 'undo' })
    expect(state.selection).toEqual([])

    const path = state.paths[word]!
    state = strandsReducer(state, { type: 'select', index: path[0]! })
    state = strandsReducer(state, { type: 'select', index: path[1]! })
    state = strandsReducer(state, { type: 'clear' })
    expect(state.selection).toEqual([])

    state = strandsReducer(state, { type: 'select', index: 0 })
    state = strandsReducer(state, { type: 'select', index: 47 })
    expect(state.selection).toEqual([47])
    state = strandsReducer(state, { type: 'hint' })
    expect(state.hintsUsed).toBe(1)
    expect(state.hintedCells.length).toBe(1)

    const restored = createStrandsState(DATE, strandsProgress(state))
    expect(restored.hintsUsed).toBe(1)
    expect(restored.selection).toEqual([])
    expect(validStrandsProgress(strandsProgress(state))).toBe(true)
    expect(validStrandsProgress({ date: DATE, foundWords: ['NOT-A-WORD'], hintsUsed: 0 })).toBe(false)
  })

  it('completes the daily board and persists its found words and hint count', () => {
    let state = createStrandsState(DATE)
    for (const word of state.words) state = findWord(state, word)

    expect(state.phase).toBe('complete')
    expect(state.foundWords).toHaveLength(6)
    expect(strandsProgress(state)).toEqual({ date: DATE, foundWords: state.words, hintsUsed: 0, hintedCells: [] })
    expect(strandsReducer(state, { type: 'hint' })).toBe(state)
  })

  it('rejects an invalid UTC date', () => {
    expect(() => createStrandsPuzzle('2026-02-30')).toThrow(RangeError)
  })
})
