import { describe, expect, it } from 'vitest'
import { ARCADE_DATA_KEY, emptyArcadeData, readArcadeData, withImprovedBest, writeArcadeData } from './arcadeData'

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
      bests: { snake: 12, reaction: 238, pattern: 4 },
      preferences: { reduceMotion: true },
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
  })

  it('reads back saved fields and discards malformed records', () => {
    const storage = new MemoryStorage()
    storage.key = ARCADE_DATA_KEY
    storage.value = JSON.stringify({
      version: 1,
      bests: { snake: 9, reaction: -40, pattern: 2.5 },
      preferences: { reduceMotion: true },
    })

    expect(readArcadeData(storage)).toEqual({
      version: 1,
      bests: { snake: 9, reaction: null, pattern: null },
      preferences: { reduceMotion: true },
    })
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
