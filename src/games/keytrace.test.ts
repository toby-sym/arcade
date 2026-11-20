import { describe, expect, it } from 'vitest'
import {
  createKeytraceState,
  formatKeytraceTime,
  keytraceAccuracy,
  keytraceClearIsAccurate,
  keytraceElapsedMs,
  keytraceStripForDate,
  pauseKeytrace,
  restartKeytrace,
  resumeKeytrace,
  startKeytrace,
  submitKeytraceWord,
} from './keytrace'

describe('Keytrace', () => {
  it('provides a repeatable twelve-word strip for each valid UTC date', () => {
    for (const date of ['2026-01-01', '2026-05-28', '2026-11-20', '2027-12-31']) {
      const words = keytraceStripForDate(date)
      expect(keytraceStripForDate(date)).toEqual(words)
      expect(words).toHaveLength(12)
      expect(words.every((word) => /^[a-z]+$/.test(word))).toBe(true)
    }
    expect(() => keytraceStripForDate('2026-02-30')).toThrow(RangeError)
    expect(() => createKeytraceState('not-a-date')).toThrow(RangeError)
  })

  it('advances only on exact words and counts typo distance toward accuracy', () => {
    let state = startKeytrace(createKeytraceState('2026-11-20'), 100)
    const word = state.words[0]!
    state = submitKeytraceWord(state, `${word.slice(0, -1)}x`, 200)
    expect(state.wordIndex).toBe(0)
    expect(state.mistakes).toBe(1)
    expect(state.message).toContain('Correct it')

    state = submitKeytraceWord(state, word, 500)
    expect(state.wordIndex).toBe(1)
    expect(state.correctCharacters).toBe(word.length)
    expect(keytraceAccuracy(state.correctCharacters, state.mistakes)).toBeLessThan(100)
  })

  it('holds elapsed time across pause and resume, then completes the timed strip', () => {
    let state = startKeytrace(createKeytraceState('2026-11-20'), 1_000)
    state = submitAllWords(state, 1_000, 250)
    expect(state.phase).toBe('complete')
    expect(state.elapsedMs).toBe(3_000)
    expect(state.wordIndex).toBe(12)
    expect(state.mistakes).toBe(0)
    expect(keytraceClearIsAccurate(state)).toBe(true)
    expect(keytraceElapsedMs(state, 10_000)).toBe(3_000)
  })

  it('pauses, resumes, restarts the same strip, and applies the accuracy threshold', () => {
    let state = startKeytrace(createKeytraceState('2026-11-20'), 500)
    state = submitKeytraceWord(state, state.words[0]!, 1_250)
    state = pauseKeytrace(state, 2_500)
    expect(state.elapsedMs).toBe(2_000)
    expect(keytraceElapsedMs(state, 7_000)).toBe(2_000)
    state = resumeKeytrace(state, 10_000)
    expect(keytraceElapsedMs(state, 10_750)).toBe(2_750)

    const restarted = restartKeytrace(state)
    expect(restarted.phase).toBe('ready')
    expect(restarted.words).toEqual(state.words)
    expect(restarted.wordIndex).toBe(0)
    expect(keytraceAccuracy(100, 5)).toBe(95)
    expect(keytraceAccuracy(100, 6)).toBe(94)
    expect(keytraceClearIsAccurate({ ...state, phase: 'complete', correctCharacters: 100, mistakes: 5 })).toBe(true)
    expect(keytraceClearIsAccurate({ ...state, phase: 'complete', correctCharacters: 100, mistakes: 6 })).toBe(false)
    expect(formatKeytraceTime(12_349)).toBe('00:12.34')
  })
})

function submitAllWords(state: ReturnType<typeof createKeytraceState>, startedAt: number, interval: number) {
  let next = state
  for (let index = 0; index < state.words.length; index += 1) {
    next = submitKeytraceWord(next, state.words[index]!, startedAt + interval * (index + 1))
  }
  return next
}
