export const CIPHER_CIRCUIT_SIGNAL_COUNT = 6
export const CIPHER_CIRCUIT_CODE_LENGTH = 4
export const CIPHER_CIRCUIT_GUESS_LIMIT = 8
export const CIPHER_CIRCUIT_SIGNALS = [
  { name: 'Mint', glyph: '●', color: 'mint' },
  { name: 'Coral', glyph: '▲', color: 'coral' },
  { name: 'Amber', glyph: '◆', color: 'amber' },
  { name: 'Sky', glyph: '✦', color: 'sky' },
  { name: 'Violet', glyph: '⬟', color: 'violet' },
  { name: 'Rose', glyph: '✚', color: 'rose' },
] as const

export type CipherSignal = 0 | 1 | 2 | 3 | 4 | 5
export type CipherSlot = CipherSignal | null
export type CipherCircuitPhase = 'playing' | 'solved' | 'failed'

export interface CipherCircuitProgress {
  date: string
  guesses: CipherSignal[][]
  activeGuess: CipherSlot[]
  phase: CipherCircuitPhase
}

export interface CipherCircuitState extends CipherCircuitProgress {
  answer: CipherSignal[]
  message: string
}

export type CipherCircuitAction =
  | { type: 'select'; signal: CipherSignal }
  | { type: 'remove'; index: number }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'submit' }
  | { type: 'restart' }

export interface CipherSignalFeedback {
  locked: number
  rerouted: number
}

export function cipherCircuitForDate(date: string): CipherSignal[] {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  let seed = 2166136261
  for (const character of `cipher-circuit:${date}`) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  }
  if (seed === 0) seed = 0x9e3779b9
  const code: CipherSignal[] = []
  for (let index = 0; index < CIPHER_CIRCUIT_CODE_LENGTH; index += 1) {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    code.push((seed >>> 0) % CIPHER_CIRCUIT_SIGNAL_COUNT as CipherSignal)
  }
  return code
}

export function createCipherCircuitState(date: string, progress?: CipherCircuitProgress | null): CipherCircuitState {
  const answer = cipherCircuitForDate(date)
  const valid = progress?.date === date && validCipherCircuitProgress(progress)
    ? progress
    : { date, guesses: [], activeGuess: Array(CIPHER_CIRCUIT_CODE_LENGTH).fill(null), phase: 'playing' as const }
  const guesses = valid.guesses.map((guess) => [...guess])
  const activeGuess = [...valid.activeGuess]
  const phase = derivePhase(answer, guesses)
  return {
    date,
    answer,
    guesses,
    activeGuess: phase === 'playing' ? activeGuess : Array(CIPHER_CIRCUIT_CODE_LENGTH).fill(null),
    phase,
    message: phase === 'solved'
      ? `Circuit aligned in ${guesses.length} ${guesses.length === 1 ? 'pulse' : 'pulses'}. A new pattern arrives tomorrow.`
      : phase === 'failed'
        ? 'Circuit overload. The signal key is revealed below; a new pattern arrives tomorrow.'
        : guesses.length > 0 || activeGuess.some((signal) => signal !== null)
          ? 'Circuit restored. Your input stays in this browser.'
          : 'Set four signals. The feedback tells you what is aligned and what needs rerouting.',
  }
}

export function cipherSignalFeedback(answer: readonly number[], guess: readonly number[]): CipherSignalFeedback {
  let locked = 0
  const remaining = new Map<number, number>()
  const unmatchedGuess: number[] = []

  for (let index = 0; index < CIPHER_CIRCUIT_CODE_LENGTH; index += 1) {
    if (guess[index] === answer[index]) locked += 1
    else {
      const targetSignal = answer[index]!
      remaining.set(targetSignal, (remaining.get(targetSignal) ?? 0) + 1)
      unmatchedGuess.push(guess[index]!)
    }
  }

  let rerouted = 0
  for (const signal of unmatchedGuess) {
    const count = remaining.get(signal) ?? 0
    if (count === 0) continue
    rerouted += 1
    remaining.set(signal, count - 1)
  }
  return { locked, rerouted }
}

export function cipherCircuitReducer(state: CipherCircuitState, action: CipherCircuitAction): CipherCircuitState {
  if (action.type === 'restart') return createCipherCircuitState(state.date)
  if (state.phase !== 'playing') return state

  if (action.type === 'select') {
    if (!isSignal(action.signal)) return state
    const index = state.activeGuess.indexOf(null)
    if (index < 0) return { ...state, message: 'Four signals are set. Submit this pulse or clear an input.' }
    const activeGuess = [...state.activeGuess]
    activeGuess[index] = action.signal
    return { ...state, activeGuess, message: `${CIPHER_CIRCUIT_SIGNALS[action.signal].name} signal set in socket ${index + 1}.` }
  }
  if (action.type === 'remove') {
    if (!Number.isSafeInteger(action.index) || action.index < 0 || action.index >= CIPHER_CIRCUIT_CODE_LENGTH) return state
    if (state.activeGuess[action.index] === null) return state
    const activeGuess = [...state.activeGuess]
    activeGuess[action.index] = null
    return { ...state, activeGuess, message: `Socket ${action.index + 1} cleared.` }
  }
  if (action.type === 'backspace') {
    let index = state.activeGuess.length - 1
    while (index >= 0 && state.activeGuess[index] === null) index -= 1
    if (index < 0) return state
    const activeGuess = [...state.activeGuess]
    activeGuess[index] = null
    return { ...state, activeGuess, message: 'Last signal removed.' }
  }
  if (action.type === 'clear') {
    if (state.activeGuess.every((signal) => signal === null)) return state
    return { ...state, activeGuess: Array(CIPHER_CIRCUIT_CODE_LENGTH).fill(null), message: 'Current pulse cleared.' }
  }

  if (state.activeGuess.some((signal) => signal === null)) {
    return { ...state, message: 'Set a signal in all four sockets before sending the pulse.' }
  }
  const guess = state.activeGuess as CipherSignal[]
  const guesses = [...state.guesses, [...guess]]
  const feedback = cipherSignalFeedback(state.answer, guess)
  const phase: CipherCircuitPhase = feedback.locked === CIPHER_CIRCUIT_CODE_LENGTH
    ? 'solved'
    : guesses.length >= CIPHER_CIRCUIT_GUESS_LIMIT
      ? 'failed'
      : 'playing'
  return {
    ...state,
    guesses,
    activeGuess: Array(CIPHER_CIRCUIT_CODE_LENGTH).fill(null),
    phase,
    message: phase === 'solved'
      ? `Circuit aligned in ${guesses.length} ${guesses.length === 1 ? 'pulse' : 'pulses'}. A new pattern arrives tomorrow.`
      : phase === 'failed'
        ? 'Circuit overloaded. The signal key is revealed below.'
        : `${CIPHER_CIRCUIT_GUESS_LIMIT - guesses.length} ${CIPHER_CIRCUIT_GUESS_LIMIT - guesses.length === 1 ? 'pulse' : 'pulses'} remain.`,
  }
}

export function cipherCircuitProgress(state: CipherCircuitState): CipherCircuitProgress {
  return {
    date: state.date,
    guesses: state.guesses.map((guess) => [...guess]),
    activeGuess: [...state.activeGuess],
    phase: state.phase,
  }
}

export function validCipherCircuitProgress(value: unknown): value is CipherCircuitProgress {
  if (!isRecord(value) || !isUtcDateKey(value.date) || !Array.isArray(value.guesses) || !Array.isArray(value.activeGuess)) return false
  if (value.guesses.length > CIPHER_CIRCUIT_GUESS_LIMIT || value.activeGuess.length !== CIPHER_CIRCUIT_CODE_LENGTH) return false
  if (!value.guesses.every((guess) => Array.isArray(guess) && guess.length === CIPHER_CIRCUIT_CODE_LENGTH && guess.every(isSignal))) return false
  if (!value.activeGuess.every((signal) => signal === null || isSignal(signal))) return false
  if (!['playing', 'solved', 'failed'].includes(String(value.phase))) return false
  const answer = cipherCircuitForDate(value.date)
  const guesses = value.guesses as CipherSignal[][]
  const solvedAt = guesses.findIndex((guess) => cipherSignalFeedback(answer, guess).locked === CIPHER_CIRCUIT_CODE_LENGTH)
  if (solvedAt >= 0 && solvedAt !== guesses.length - 1) return false
  const phase = derivePhase(answer, guesses)
  if (phase !== value.phase) return false
  return phase === 'playing' || value.activeGuess.every((signal) => signal === null)
}

function derivePhase(answer: readonly number[], guesses: readonly (readonly number[])[]): CipherCircuitPhase {
  if (guesses.some((guess) => cipherSignalFeedback(answer, guess).locked === CIPHER_CIRCUIT_CODE_LENGTH)) return 'solved'
  if (guesses.length >= CIPHER_CIRCUIT_GUESS_LIMIT) return 'failed'
  return 'playing'
}

function isSignal(value: unknown): value is CipherSignal {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < CIPHER_CIRCUIT_SIGNAL_COUNT
}

function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
