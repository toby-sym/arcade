import type { PongDifficulty } from '../games/pong'

export const ARCADE_DATA_KEY = 'arcade.local-data.v1'

export interface ArcadeBests {
  snake: number | null
  reaction: number | null
  pattern: number | null
  breakout: number | null
  pong: number | null
  invaders: number | null
  asteroids: number | null
  missileCommand: number | null
}

export interface ArcadeData {
  version: 1
  bests: ArcadeBests
  dailyPatternCompletedDate: string | null
  preferences: {
    reduceMotion: boolean
    soundEffects: boolean
    pongDifficulty: PongDifficulty
  }
}

export function withImprovedBest(data: ArcadeData, game: keyof ArcadeBests, candidate: number): ArcadeData | null {
  if (!Number.isSafeInteger(candidate) || candidate < 0 || (game !== 'reaction' && candidate === 0)) return null
  const previous = data.bests[game]
  const improved = previous === null || (game === 'reaction' ? candidate < previous : candidate > previous)
  if (!improved) return null
  return { ...data, bests: { ...data.bests, [game]: candidate } }
}

export function withDailyPatternCompletion(data: ArcadeData, date: string): ArcadeData | null {
  if (!validUtcDateKey(date)) return null
  return { ...data, dailyPatternCompletedDate: date }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function emptyArcadeData(): ArcadeData {
  return {
    version: 1,
    bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null },
    dailyPatternCompletedDate: null,
    preferences: { reduceMotion: false, soundEffects: false, pongDifficulty: 'steady' },
  }
}

export function clearArcadeBests(data: ArcadeData): ArcadeData {
  return { ...data, bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null } }
}

export function readArcadeData(storage?: StorageLike): ArcadeData {
  try {
    const target = storage ?? getBrowserStorage()
    if (!target) return emptyArcadeData()
    const raw = target.getItem(ARCADE_DATA_KEY)
    if (!raw) return emptyArcadeData()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1) return emptyArcadeData()

    const bests = isRecord(parsed.bests) ? parsed.bests : {}
    const preferences = isRecord(parsed.preferences) ? parsed.preferences : {}
    return {
      version: 1,
      dailyPatternCompletedDate: validUtcDateKey(parsed.dailyPatternCompletedDate) ? parsed.dailyPatternCompletedDate : null,
      bests: {
        snake: validRecord(bests.snake),
        reaction: validRecord(bests.reaction),
        pattern: validRecord(bests.pattern),
        breakout: validRecord(bests.breakout),
        pong: validRecord(bests.pong),
        invaders: validRecord(bests.invaders),
        asteroids: validRecord(bests.asteroids),
        missileCommand: validRecord(bests.missileCommand),
      },
      preferences: { reduceMotion: preferences.reduceMotion === true, soundEffects: preferences.soundEffects === true, pongDifficulty: validPongDifficulty(preferences.pongDifficulty) },
    }
  } catch {
    return emptyArcadeData()
  }
}

export function writeArcadeData(data: ArcadeData, storage?: StorageLike): boolean {
  try {
    const target = storage ?? getBrowserStorage()
    if (!target) return false
    target.setItem(ARCADE_DATA_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validRecord(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function validUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(timestamp.getTime()) && timestamp.toISOString().slice(0, 10) === value
}

function validPongDifficulty(value: unknown): PongDifficulty {
  return value === 'calm' || value === 'steady' || value === 'quick' ? value : 'steady'
}
