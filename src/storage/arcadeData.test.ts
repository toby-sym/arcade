import { describe, expect, it } from 'vitest'
import { ARCADE_DATA_KEY, clearArcadeBests, emptyArcadeData, readArcadeData, withDailyPatternCompletion, withImprovedBest, writeArcadeData } from './arcadeData'

class MemoryStorage {
  key: string | null = null
  value: string | null = null
  getItem(key: string) { return this.key === key ? this.value : null }
  setItem(key: string, value: string) { this.key = key; this.value = value }
}

describe('browser-local Arcade data', () => {
  it('returns an empty starting point without saved data', () => {
    expect(readArcadeData(new MemoryStorage())).toEqual(emptyArcadeData())
  })

  it('round-trips local bests and the motion preference', () => {
    const storage = new MemoryStorage()
    const saved = {
      version: 1 as const,
      dailyPatternCompletedDate: '2026-11-19',
      bests: { snake: 12, reaction: 238, pattern: 4, breakout: 120, pong: 3, invaders: 90, asteroids: 220, missileCommand: 340, blockDrop: 420 },
      preferences: { reduceMotion: true, soundEffects: true, pongDifficulty: 'quick' as const },
    }

    expect(writeArcadeData(saved, storage)).toBe(true)
    expect(storage.key).toBe(ARCADE_DATA_KEY)
    expect(readArcadeData(storage)).toEqual(saved)
  })

  it('keeps the highest scores and the fastest reaction time', () => {
    const initial = emptyArcadeData()
    const snakeRecord = withImprovedBest(initial, 'snake', 8)
    const reactionRecord = withImprovedBest(snakeRecord!, 'reaction', 240)

    expect(withImprovedBest(reactionRecord!, 'snake', 7)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'reaction', 245)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'pattern', 0)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'reaction', 235)?.bests.reaction).toBe(235)
    expect(withImprovedBest(reactionRecord!, 'pattern', 3)?.bests.pattern).toBe(3)
    expect(withImprovedBest(reactionRecord!, 'breakout', 120)?.bests.breakout).toBe(120)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, breakout: 120 } }, 'breakout', 100)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'pong', 3)?.bests.pong).toBe(3)
    expect(withImprovedBest(reactionRecord!, 'invaders', 80)?.bests.invaders).toBe(80)
    expect(withImprovedBest(reactionRecord!, 'asteroids', 220)?.bests.asteroids).toBe(220)
    expect(withImprovedBest(reactionRecord!, 'missileCommand', 340)?.bests.missileCommand).toBe(340)
    expect(withImprovedBest(reactionRecord!, 'blockDrop', 420)?.bests.blockDrop).toBe(420)
  })

  it('clears all records without changing the saved preferences or original data', () => {
    const initial = {
      version: 1 as const,
      dailyPatternCompletedDate: '2026-11-19',
      bests: { snake: 12, reaction: 238, pattern: 4, breakout: 120, pong: 3, invaders: 90, asteroids: 220, missileCommand: 340, blockDrop: 420 },
      preferences: { reduceMotion: true, soundEffects: true, pongDifficulty: 'quick' as const },
    }
    expect(clearArcadeBests(initial)).toEqual({
      version: 1,
      dailyPatternCompletedDate: '2026-11-19',
      bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null },
      preferences: { reduceMotion: true, soundEffects: true, pongDifficulty: 'quick' },
    })
    expect(initial.bests.snake).toBe(12)
  })

  it('reads back saved fields and discards malformed records', () => {
    const storage = new MemoryStorage()
    storage.key = ARCADE_DATA_KEY
    storage.value = JSON.stringify({
      version: 1,
      dailyPatternCompletedDate: 'not-a-date',
      bests: { snake: 9, reaction: -40, pattern: 2.5, breakout: 1.2, pong: -1, invaders: -5, asteroids: -10, missileCommand: -25, blockDrop: -40 },
      preferences: { reduceMotion: true, soundEffects: 'yes', pongDifficulty: 'too-fast' },
    })

    expect(readArcadeData(storage)).toEqual({
      version: 1,
      dailyPatternCompletedDate: null,
      bests: { snake: 9, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null },
      preferences: { reduceMotion: true, soundEffects: false, pongDifficulty: 'steady' },
    })

    storage.value = JSON.stringify({ version: 1, preferences: { reduceMotion: true, pongDifficulty: 'quick' } })
    expect(readArcadeData(storage).preferences).toEqual({ reduceMotion: true, soundEffects: false, pongDifficulty: 'quick' })
  })

  it('records only valid calendar dates for the shared daily challenge', () => {
    const initial = emptyArcadeData()
    expect(withDailyPatternCompletion(initial, '2026-11-19')?.dailyPatternCompletedDate).toBe('2026-11-19')
    expect(withDailyPatternCompletion(initial, '2026-02-31')).toBeNull()
    expect(initial.dailyPatternCompletedDate).toBeNull()
  })

  it('uses defaults for unknown versions, corrupt JSON, and unavailable storage', () => {
    const storage = new MemoryStorage()
    storage.key = ARCADE_DATA_KEY
    storage.value = '{broken'
    expect(readArcadeData(storage)).toEqual(emptyArcadeData())
    storage.value = JSON.stringify({ version: 2, bests: { snake: 100 } })
    expect(readArcadeData(storage)).toEqual(emptyArcadeData())

    const unavailable = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
    }
    expect(readArcadeData(unavailable)).toEqual(emptyArcadeData())
    expect(writeArcadeData(emptyArcadeData(), unavailable)).toBe(false)
  })
})
