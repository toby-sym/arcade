import { describe, expect, it } from 'vitest'
import { DAILY_PATTERN_LENGTH, dailyPatternForDate, utcDateKey } from './dailyPattern'

describe('daily Pattern Memory challenge', () => {
  it('uses a stable UTC calendar date', () => {
    expect(utcDateKey(new Date('2026-11-19T23:59:59Z'))).toBe('2026-11-19')
    expect(utcDateKey(new Date('2026-11-20T00:00:00Z'))).toBe('2026-11-20')
  })

  it('creates the same fixed sequence for everyone on the same date', () => {
    expect(dailyPatternForDate('2026-11-19')).toEqual([0, 3, 2, 1, 3, 0, 1, 2])
    expect(dailyPatternForDate('2026-11-20')).not.toEqual(dailyPatternForDate('2026-11-19'))
    expect(dailyPatternForDate('2026-11-19')).toHaveLength(DAILY_PATTERN_LENGTH)
  })
})
