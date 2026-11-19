import { describe, expect, it } from 'vitest'
import { createDailyWordState, dailyWordForDate, dailyWordReducer, getLetterStatuses, isValidWordGuess, scoreGuess, WORD_GUESS_LIMIT, type WordGuess } from './dailyWord'

describe('Daily Word', () => {
  it('selects a deterministic five-letter word for each UTC date', () => {
    const today = dailyWordForDate('2026-11-19')

    expect(today).toHaveLength(5)
    expect(dailyWordForDate('2026-11-19')).toBe(today)
    expect(dailyWordForDate('2026-11-20')).not.toBe(today)
    expect(isValidWordGuess(today)).toBe(true)
    expect(() => dailyWordForDate('2026-02-30')).toThrow(RangeError)
  })

  it('scores exact, present, and repeated letters without overcounting', () => {
    expect(scoreGuess('APPLE', 'ALLEY')).toEqual(['correct', 'present', 'absent', 'present', 'absent'])
    expect(scoreGuess('LEVEL', 'LLLLL')).toEqual(['correct', 'absent', 'absent', 'absent', 'correct'])
  })

  it('accepts only words from its local word bank', () => {
    expect(isValidWordGuess('CRANE')).toBe(true)
    expect(isValidWordGuess('QWERT')).toBe(false)
    expect(isValidWordGuess('WORD')).toBe(false)
  })

  it('requires a complete valid guess and keeps progress after submission', () => {
    let state = createDailyWordState('2026-11-19')
    state = dailyWordReducer(state, { type: 'letter', letter: 'c' })
    state = dailyWordReducer(state, { type: 'letter', letter: 'r' })
    state = dailyWordReducer(state, { type: 'submit' })
    expect(state.guesses).toHaveLength(0)
    expect(state.message).toContain('five letters')

    for (const letter of 'qwert') state = dailyWordReducer(state, { type: 'letter', letter })
    const invalid = dailyWordReducer(state, { type: 'submit' })
    expect(invalid.guesses).toHaveLength(0)
    expect(invalid.message).toContain('not in this game')

    state = { ...state, draft: 'CRANE' }
    const submitted = dailyWordReducer(state, { type: 'submit' })
    expect(submitted.guesses[0]?.word).toBe('CRANE')
    expect(submitted.draft).toBe('')
    expect(createDailyWordState('2026-11-19', ['CRANE']).guesses).toEqual(submitted.guesses)
  })

  it('ends on a correct guess and restores the completed daily result', () => {
    const initial = createDailyWordState('2026-11-19')
    let state = { ...initial, draft: initial.answer }
    state = dailyWordReducer(state, { type: 'submit' })

    expect(state.phase).toBe('won')
    expect(state.message).toContain('Solved in 1 guess')
    expect(dailyWordReducer(state, { type: 'backspace' })).toBe(state)
    expect(createDailyWordState(initial.date, [initial.answer]).phase).toBe('won')
  })

  it('ends after six misses and restores the revealed answer', () => {
    const initial = createDailyWordState('2026-11-19')
    const misses = ['BRICK', 'SWEET', 'SHOUT', 'MOUSE', 'FLUTE', 'TRAIN', 'BRAVE', 'CLERK', 'SHARE', 'CLOUD']
      .filter((word) => word !== initial.answer && isValidWordGuess(word))
    const guesses = misses.slice(0, WORD_GUESS_LIMIT)
    expect(guesses).toHaveLength(WORD_GUESS_LIMIT)
    const restored = createDailyWordState(initial.date, guesses)

    expect(restored.phase).toBe('lost')
    expect(restored.message).toContain(initial.answer)
    expect(restored.guesses).toHaveLength(WORD_GUESS_LIMIT)
  })

  it('keeps the strongest color for a keyboard key', () => {
    const guesses: WordGuess[] = [
      { word: 'CRANE', marks: ['absent', 'present', 'absent', 'absent', 'correct'] },
      { word: 'CABLE', marks: ['correct', 'absent', 'absent', 'absent', 'absent'] },
    ]
    const statuses = getLetterStatuses(guesses)

    expect(statuses.C).toBe('correct')
    expect(statuses.R).toBe('present')
    expect(statuses.E).toBe('correct')
    expect(statuses.Q).toBeUndefined()
  })
})
