import { describe, expect, it } from 'vitest'
import {
  adjustMinuteHand,
  checkMinuteHand,
  createMinuteHandState,
  formatClock,
  MINUTE_HAND_ROUNDS,
  minuteHandPuzzleForDate,
  pauseMinuteHand,
  restartMinuteHand,
  resumeMinuteHand,
  startMinuteHand,
  validMinuteHandProgress,
} from './minuteHand'

describe('Minute Hand', () => {
  it('creates a stable, varied five-clue daily set with distinct answers', () => {
    const first = minuteHandPuzzleForDate('2026-11-20')
    expect(minuteHandPuzzleForDate('2026-11-20')).toEqual(first)
    expect(minuteHandPuzzleForDate('2026-11-21')).not.toEqual(first)
    expect(first).toHaveLength(MINUTE_HAND_ROUNDS)
    expect(new Set(first.map((clue) => clue.targetMinutes)).size).toBe(MINUTE_HAND_ROUNDS)
    expect(first.map((clue) => clue.targetMinutes % 60)).toEqual([15, 30, 45, 0, expect.any(Number)])
    expect(first.every((clue) => clue.startingMinutes !== clue.targetMinutes && clue.startingMinutes % 5 === 0)).toBe(true)
  })

  it('advances a clock in five-minute and one-hour adjustments, wrapping at twelve', () => {
    let state = startMinuteHand(createMinuteHandState('2026-11-20'))
    state = { ...state, clockMinutes: 715 }
    state = adjustMinuteHand(state, 10)
    expect(state.clockMinutes).toBe(5)
    state = adjustMinuteHand(state, -60)
    expect(state.clockMinutes).toBe(665)
    expect(state.moves).toBe(2)
    expect(adjustMinuteHand(state, 3)).toBe(state)
  })

  it('counts incorrect checks, pauses safely, and restarts the same daily puzzle', () => {
    const ready = createMinuteHandState('2026-11-20')
    expect(adjustMinuteHand(ready, 5)).toBe(ready)
    const playing = startMinuteHand(ready)
    const wrong = checkMinuteHand(playing)
    expect(wrong.mistakes).toBe(1)
    expect(wrong.clueIndex).toBe(0)
    expect(pauseMinuteHand(wrong).phase).toBe('paused')
    expect(resumeMinuteHand(pauseMinuteHand(wrong)).phase).toBe('playing')
    expect(restartMinuteHand(wrong)).toEqual(ready)
  })

  it('clears all five clues in order and stores a valid completed result', () => {
    let state = startMinuteHand(createMinuteHandState('2026-11-20'))
    const clues = minuteHandPuzzleForDate(state.date)
    for (let index = 0; index < clues.length; index += 1) {
      state = { ...state, clockMinutes: clues[index]!.targetMinutes }
      state = checkMinuteHand(state)
      if (index < clues.length - 1) expect(state.clueIndex).toBe(index + 1)
    }
    expect(state.phase).toBe('complete')
    expect(state.clueIndex).toBe(MINUTE_HAND_ROUNDS)
    expect(validMinuteHandProgress(state)).toBe(true)
  })

  it('formats midnight and afternoon times on a twelve-hour clock', () => {
    expect(formatClock(0)).toBe('12:00')
    expect(formatClock(14 * 60 + 5)).toBe('2:05')
  })
})
