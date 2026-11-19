export const ARCADE_DATA_KEY = 'arcade.local-data.v1'

export interface ArcadeBests {
  snake: number | null
  reaction: number | null
  pattern: number | null
  breakout: number | null
  pong: number | null
}

export interface ArcadeData {
  version: 1
  bests: ArcadeBests
  preferences: {
    reduceMotion: boolean
  }
}

export function withImprovedBest(data: ArcadeData, game: keyof ArcadeBests, candidate: number): ArcadeData | null {
  if (!Number.isSafeInteger(candidate) || candidate < 0 || (game !== 'reaction' && candidate === 0)) return null
  const previous = data.bests[game]
  const improved = previous === null || (game === 'reaction' ? candidate < previous : candidate > previous)
  if (!improved) return null
  return { ...data, bests: { ...data.bests, [game]: candidate } }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function emptyArcadeData(): ArcadeData {
  return {
    version: 1,
    bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null },
    preferences: { reduceMotion: false },
  }
}

export function clearArcadeBests(data: ArcadeData): ArcadeData {
  return { ...data, bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null } }
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
      bests: {
        snake: validRecord(bests.snake),
        reaction: validRecord(bests.reaction),
        pattern: validRecord(bests.pattern),
        breakout: validRecord(bests.breakout),
        pong: validRecord(bests.pong),
      },
      preferences: { reduceMotion: preferences.reduceMotion === true },
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
