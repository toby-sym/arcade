export const KEYTRACE_MIN_ACCURACY = 95

const KEYTRACE_STRIPS = [
  'neon signs buzz above quiet cabinets while tokens roll toward next game',
  'small satellites drift past the blue planet and find a new orbit',
  'quick hands guide the silver rocket through clouds of violet sparks tonight',
  'a bright marble skips across the board and lands beside the center',
  'your steady rhythm sends the brass bells ringing across the moonlit hall',
  'fresh paint glows under the glass as tiny cars race past again',
  'turn the small brass key and let the old machine wake slowly',
  'silver fish weave through green sea grass beneath a warm lantern glow',
  'one more careful move keeps every glowing path connected to its home',
  'soft rain taps the arcade roof while colorful screens shine inside brightly',
  'hold your breath then guide the puck through the final silver gate',
  'three golden rings wait beyond the quiet track and glowing finish line',
  'small paper boats cross a dark river beneath the orange evening sky',
  'count each stepping stone before you leap toward the island at dawn',
].map((strip) => strip.split(' '))

export type KeytracePhase = 'ready' | 'playing' | 'paused' | 'complete'

export interface KeytraceState {
  date: string
  words: string[]
  phase: KeytracePhase
  wordIndex: number
  correctCharacters: number
  mistakes: number
  elapsedMs: number
  startedAt: number | null
  message: string
}

export function keytraceStripForDate(date: string): string[] {
  if (!isValidDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  let seed = 0x811c9dc5
  for (const character of date) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 0x01000193) >>> 0
  }
  return [...KEYTRACE_STRIPS[seed % KEYTRACE_STRIPS.length]!]
}

export function createKeytraceState(date: string): KeytraceState {
  return {
    date,
    words: keytraceStripForDate(date),
    phase: 'ready',
    wordIndex: 0,
    correctCharacters: 0,
    mistakes: 0,
    elapsedMs: 0,
    startedAt: null,
    message: 'Type each highlighted word in order. Press Enter or select Check.',
  }
}

export function startKeytrace(state: KeytraceState, now: number): KeytraceState {
  if (state.phase !== 'ready' || !Number.isFinite(now)) return state
  return { ...state, phase: 'playing', startedAt: now, message: `Word 1 of ${state.words.length}. Find your rhythm.` }
}

export function submitKeytraceWord(state: KeytraceState, attempt: string, now: number): KeytraceState {
  if (state.phase !== 'playing' || !Number.isFinite(now) || state.wordIndex >= state.words.length) return state
  const expected = state.words[state.wordIndex]!
  const normalized = attempt.trim().toLowerCase()
  if (!normalized) return { ...state, message: `Type “${expected}” before checking the word.` }

  if (normalized !== expected) {
    const mistakes = state.mistakes + editDistance(expected, normalized)
    return { ...state, mistakes, message: `Not quite. The word is still “${expected}”. Correct it and try again.` }
  }

  const wordIndex = state.wordIndex + 1
  if (wordIndex === state.words.length) {
    const elapsedMs = keytraceElapsedMs(state, now)
    return {
      ...state,
      phase: 'complete',
      wordIndex,
      correctCharacters: state.correctCharacters + expected.length,
      elapsedMs,
      startedAt: null,
      message: `Strip clear in ${formatKeytraceTime(elapsedMs)} at ${keytraceAccuracy(state.correctCharacters + expected.length, state.mistakes)}% accuracy.`,
    }
  }

  return {
    ...state,
    wordIndex,
    correctCharacters: state.correctCharacters + expected.length,
    message: `Word ${wordIndex + 1} of ${state.words.length}. Keep the line moving.`,
  }
}

export function pauseKeytrace(state: KeytraceState, now: number): KeytraceState {
  if (state.phase !== 'playing' || !Number.isFinite(now)) return state
  return { ...state, phase: 'paused', elapsedMs: keytraceElapsedMs(state, now), startedAt: null, message: 'Run paused. Your words and time are held.' }
}

export function resumeKeytrace(state: KeytraceState, now: number): KeytraceState {
  if (state.phase !== 'paused' || !Number.isFinite(now)) return state
  return { ...state, phase: 'playing', startedAt: now, message: `Word ${state.wordIndex + 1} of ${state.words.length}. Pick up where you left off.` }
}

export function restartKeytrace(state: KeytraceState): KeytraceState {
  return createKeytraceState(state.date)
}

export function keytraceElapsedMs(state: KeytraceState, now: number): number {
  if (state.phase !== 'playing' || state.startedAt === null || !Number.isFinite(now)) return state.elapsedMs
  return Math.round(state.elapsedMs + Math.max(0, now - state.startedAt))
}

export function keytraceAccuracy(correctCharacters: number, mistakes: number): number {
  const totalCharacters = correctCharacters + mistakes
  return totalCharacters === 0 ? 100 : Math.floor((correctCharacters / totalCharacters) * 100)
}

export function keytraceClearIsAccurate(state: KeytraceState): boolean {
  return state.phase === 'complete' && keytraceAccuracy(state.correctCharacters, state.mistakes) >= KEYTRACE_MIN_ACCURACY
}

export function formatKeytraceTime(milliseconds: number): string {
  const safeMilliseconds = Math.max(0, Math.floor(milliseconds))
  const seconds = Math.floor(safeMilliseconds / 1000)
  const centiseconds = Math.floor((safeMilliseconds % 1000) / 10)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

function editDistance(first: string, second: string): number {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index)
  for (let row = 1; row <= first.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= second.length; column += 1) {
      current[column] = Math.min(
        current[column - 1]! + 1,
        previous[column]! + 1,
        previous[column - 1]! + (first[row - 1] === second[column - 1] ? 0 : 1),
      )
    }
    for (let column = 0; column <= second.length; column += 1) previous[column] = current[column]!
  }
  return previous[second.length]!
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
