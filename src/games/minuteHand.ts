import { utcDateKey } from './dailyPattern'

export const MINUTE_HAND_ROUNDS = 5

export interface MinuteHandClue {
  targetMinutes: number
  startingMinutes: number
  text: string
}

export interface MinuteHandProgress {
  date: string
  clueIndex: number
  clockMinutes: number
  moves: number
  mistakes: number
  phase: 'ready' | 'playing' | 'paused' | 'complete'
}

export function minuteHandPuzzleForDate(date: string): MinuteHandClue[] {
  const random = seededRandom(hashDate(date))
  const hours = shuffle(Array.from({ length: 12 }, (_, index) => index), random)
  const extraMinute = [5, 10, 20, 25, 35, 40, 50, 55][Math.floor(random() * 8)]!
  const minutes = [15, 30, 45, 0, extraMinute]

  return minutes.map((minute, index) => {
    const hour = hours[index]!
    const targetMinutes = hour * 60 + minute
    let startingMinutes = Math.floor(random() * 144) * 5
    if (startingMinutes === targetMinutes) startingMinutes = (startingMinutes + 65) % 720
    return {
      targetMinutes,
      startingMinutes,
      text: makeClue(hour, minute),
    }
  })
}

export function createMinuteHandState(date = utcDateKey(), progress: MinuteHandProgress | null = null): MinuteHandProgress {
  if (progress && progress.date === date && validMinuteHandProgress(progress)) return { ...progress }
  return {
    date,
    clueIndex: 0,
    clockMinutes: minuteHandPuzzleForDate(date)[0]!.startingMinutes,
    moves: 0,
    mistakes: 0,
    phase: 'ready',
  }
}

export function startMinuteHand(state: MinuteHandProgress): MinuteHandProgress {
  return state.phase === 'ready' ? { ...state, phase: 'playing' } : state
}

export function pauseMinuteHand(state: MinuteHandProgress): MinuteHandProgress {
  return state.phase === 'playing' ? { ...state, phase: 'paused' } : state
}

export function resumeMinuteHand(state: MinuteHandProgress): MinuteHandProgress {
  return state.phase === 'paused' ? { ...state, phase: 'playing' } : state
}

export function restartMinuteHand(state: MinuteHandProgress): MinuteHandProgress {
  return createMinuteHandState(state.date)
}

export function adjustMinuteHand(state: MinuteHandProgress, amount: number): MinuteHandProgress {
  if (state.phase !== 'playing' || !Number.isInteger(amount) || amount % 5 !== 0) return state
  return { ...state, clockMinutes: mod(state.clockMinutes + amount, 720), moves: state.moves + 1 }
}

export function checkMinuteHand(state: MinuteHandProgress): MinuteHandProgress {
  if (state.phase !== 'playing') return state
  const clue = minuteHandPuzzleForDate(state.date)[state.clueIndex]
  if (!clue || state.clockMinutes !== clue.targetMinutes) {
    return { ...state, mistakes: state.mistakes + 1 }
  }

  const clueIndex = state.clueIndex + 1
  if (clueIndex === MINUTE_HAND_ROUNDS) return { ...state, clueIndex, phase: 'complete' }
  return {
    ...state,
    clueIndex,
    clockMinutes: minuteHandPuzzleForDate(state.date)[clueIndex]!.startingMinutes,
  }
}

export function validMinuteHandProgress(value: unknown): value is MinuteHandProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const progress = value as Record<string, unknown>
  const date = typeof progress.date === 'string' ? new Date(`${progress.date}T00:00:00.000Z`) : null
  return typeof progress.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(progress.date)
    && date !== null && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === progress.date
    && Number.isInteger(progress.clueIndex) && (progress.clueIndex as number) >= 0 && (progress.clueIndex as number) <= MINUTE_HAND_ROUNDS
    && Number.isInteger(progress.clockMinutes) && (progress.clockMinutes as number) >= 0 && (progress.clockMinutes as number) < 720
    && Number.isSafeInteger(progress.moves) && (progress.moves as number) >= 0
    && Number.isSafeInteger(progress.mistakes) && (progress.mistakes as number) >= 0
    && (progress.phase === 'ready' || progress.phase === 'playing' || progress.phase === 'paused' || progress.phase === 'complete')
    && (progress.phase === 'complete' ? progress.clueIndex === MINUTE_HAND_ROUNDS : (progress.clueIndex as number) < MINUTE_HAND_ROUNDS)
}

export function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 12 || 12
  const minute = minutes % 60
  return `${hour}:${String(minute).padStart(2, '0')}`
}

function makeClue(hourIndex: number, minute: number): string {
  const hour = hourIndex + 1
  const nextHour = hour % 12 + 1
  if (minute === 0) return `The minute hand is at twelve. The hour hand points to ${hour}.`
  if (minute === 15) return `A quarter past ${hour}.`
  if (minute === 30) return `Half past ${hour}.`
  if (minute === 45) return `A quarter to ${nextHour}.`
  if (minute < 30) return `${minute} minutes past ${hour}.`
  return `${60 - minute} minutes before ${nextHour}.`
}

function hashDate(date: string): number {
  let hash = 2166136261
  for (const character of date) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

function seededRandom(seed: number): () => number {
  let value = seed || 1
  return () => {
    value += 0x6d2b79f5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!]
  }
  return shuffled
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
