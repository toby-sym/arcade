export const DAILY_PATTERN_LENGTH = 8

export function utcDateKey(date: Date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function dailyPatternForDate(dateKey: string) {
  let seed = 2166136261
  for (let index = 0; index < dateKey.length; index += 1) {
    seed = Math.imul(seed ^ dateKey.charCodeAt(index), 16777619) >>> 0
  }
  if (seed === 0) seed = 0x9e3779b9

  const pattern: number[] = []
  for (let index = 0; index < DAILY_PATTERN_LENGTH; index += 1) {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    pattern.push((seed >>> 30) & 3)
  }
  return pattern
}
