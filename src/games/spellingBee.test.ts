import { describe, expect, it } from 'vitest'
import {
  SPELLING_BEE_DAILY_HIVE_COUNT,
  spellingBeeProgress,
  spellingBeeReducer,
  createSpellingBeePuzzle,
  createSpellingBeeState,
  scoreSpellingBeeWord,
  validSpellingBeeProgress,
  visibleSpellingBeeLetters,
} from './spellingBee'

const DATE = '2026-11-19'

describe('daily Spelling Bee puzzle', () => {
  it('uses one deterministic seven-letter hive and a fresh word list for each date', () => {
    const first = createSpellingBeePuzzle(DATE)
    expect(createSpellingBeePuzzle(DATE)).toEqual(first)
    expect(first.outer).toHaveLength(6)
    expect(new Set([first.center, ...first.outer]).size).toBe(7)
    expect(first.words).toContain(first.pangrams[0])
    expect(first.pangrams.length).toBeGreaterThan(0)

    const signatures = new Set<string>()
    for (let offset = 0; offset < SPELLING_BEE_DAILY_HIVE_COUNT; offset += 1) {
      const date = new Date(`${DATE}T00:00:00.000Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      const puzzle = createSpellingBeePuzzle(date.toISOString().slice(0, 10))
      const letters = new Set([puzzle.center, ...puzzle.outer])
      expect(puzzle.words.length).toBeGreaterThanOrEqual(12)
      expect(puzzle.words.every((word) => word.length >= 4 && word.includes(puzzle.center) && [...word].every((letter) => letters.has(letter)))).toBe(true)
      expect(puzzle.pangrams.every((word) => [...letters].every((letter) => word.includes(letter)))).toBe(true)
      signatures.add([...letters].sort().join(''))
    }
    expect(signatures.size).toBe(SPELLING_BEE_DAILY_HIVE_COUNT)
  })

  it('scores four-letter words, longer words, and pangrams', () => {
    const letters = new Set('ORANGES')
    expect(scoreSpellingBeeWord('EARN', letters)).toBe(1)
    expect(scoreSpellingBeeWord('ANGER', letters)).toBe(5)
    expect(scoreSpellingBeeWord('ORANGES', letters)).toBe(14)
  })

  it('accepts only a new valid word and saves its score locally', () => {
    let state = createSpellingBeeState(DATE)
    const word = state.words.find((candidate) => candidate.length === 4)!
    for (const letter of word) state = spellingBeeReducer(state, { type: 'letter', letter })
    state = spellingBeeReducer(state, { type: 'submit' })

    expect(state.foundWords).toEqual([word])
    expect(state.score).toBe(1)
    expect(state.draft).toBe('')
    expect(spellingBeeProgress(state)).toEqual({ date: DATE, foundWords: [word], phase: 'playing' })

    const duplicate = word.split('').reduce((next, letter) => spellingBeeReducer(next, { type: 'letter', letter }), state)
    const repeated = spellingBeeReducer(duplicate, { type: 'submit' })
    expect(repeated.score).toBe(1)
    expect(repeated.foundWords).toEqual([word])
    expect(repeated.message).toContain('already found')
  })

  it('requires the centre letter and a word from the local word list', () => {
    let state = createSpellingBeeState(DATE)
    for (const letter of state.outer.slice(0, 4)) state = spellingBeeReducer(state, { type: 'letter', letter })
    state = spellingBeeReducer(state, { type: 'submit' })
    expect(state.message).toContain('centre letter')

    state = spellingBeeReducer(state, { type: 'clear' })
    state = state.center.repeat(4).split('').reduce((next, letter) => spellingBeeReducer(next, { type: 'letter', letter }), state)
    state = spellingBeeReducer(state, { type: 'submit' })
    expect(state.message).toContain('not in today’s word list')
  })

  it('supports delete, clear, shuffle and restores saved words', () => {
    let state = createSpellingBeeState(DATE)
    const before = visibleSpellingBeeLetters(state)
    state = spellingBeeReducer(state, { type: 'shuffle' })
    expect(visibleSpellingBeeLetters(state)).not.toEqual(before)

    state = spellingBeeReducer(state, { type: 'letter', letter: state.center })
    state = spellingBeeReducer(state, { type: 'backspace' })
    expect(state.draft).toBe('')
    const word = state.words[0]!
    const progress = { date: DATE, foundWords: [word], phase: 'playing' as const }
    expect(validSpellingBeeProgress(progress)).toBe(true)
    expect(createSpellingBeeState(DATE, progress).foundWords).toEqual([word])
    expect(validSpellingBeeProgress({ date: DATE, foundWords: ['not-valid!'] })).toBe(false)
  })

  it('rejects impossible dates', () => {
    expect(() => createSpellingBeePuzzle('2026-02-30')).toThrow(RangeError)
  })
})
