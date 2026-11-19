import { describe, expect, it } from 'vitest'
import {
  cipherCircuitForDate,
  cipherCircuitProgress,
  cipherCircuitReducer,
  cipherSignalFeedback,
  createCipherCircuitState,
  CIPHER_CIRCUIT_CODE_LENGTH,
  CIPHER_CIRCUIT_GUESS_LIMIT,
  type CipherSignal,
} from './cipherCircuit'

const DATE = '2026-11-19'

function fillGuess(state: ReturnType<typeof createCipherCircuitState>, guess: readonly number[]) {
  return guess.reduce((next, signal) => cipherCircuitReducer(next, { type: 'select', signal: signal as CipherSignal }), state)
}

describe('Cipher Circuit', () => {
  it('generates the same daily signal key and rejects invalid dates', () => {
    const first = cipherCircuitForDate(DATE)
    expect(cipherCircuitForDate(DATE)).toEqual(first)
    expect(first).toHaveLength(CIPHER_CIRCUIT_CODE_LENGTH)
    expect(first.every((signal) => Number.isInteger(signal) && signal >= 0 && signal < 6)).toBe(true)
    expect(() => cipherCircuitForDate('2026-02-31')).toThrow(RangeError)
  })

  it('scores locked and rerouted signals without counting duplicates twice', () => {
    expect(cipherSignalFeedback([1, 1, 2, 3], [1, 2, 1, 4])).toEqual({ locked: 1, rerouted: 2 })
    expect(cipherSignalFeedback([0, 0, 1, 1], [0, 1, 0, 2])).toEqual({ locked: 1, rerouted: 2 })
    expect(cipherSignalFeedback([1, 2, 3, 4], [4, 3, 2, 1])).toEqual({ locked: 0, rerouted: 4 })
  })

  it('builds a four-signal pulse and saves the active input', () => {
    let state = createCipherCircuitState(DATE)
    state = cipherCircuitReducer(state, { type: 'select', signal: 2 })
    state = cipherCircuitReducer(state, { type: 'select', signal: 2 })
    expect(state.activeGuess).toEqual([2, 2, null, null])
    state = cipherCircuitReducer(state, { type: 'backspace' })
    expect(state.activeGuess).toEqual([2, null, null, null])
    state = cipherCircuitReducer(state, { type: 'remove', index: 0 })
    expect(state.activeGuess).toEqual([null, null, null, null])
    const progress = cipherCircuitProgress(state)
    expect(createCipherCircuitState(DATE, progress).activeGuess).toEqual(progress.activeGuess)
    expect(cipherCircuitReducer(state, { type: 'submit' }).guesses).toHaveLength(0)
  })

  it('solves the daily key, records attempts, and restores the completed result', () => {
    const initial = createCipherCircuitState(DATE)
    const guessed = fillGuess(initial, initial.answer)
    const solved = cipherCircuitReducer(guessed, { type: 'submit' })
    expect(solved.phase).toBe('solved')
    expect(solved.guesses).toEqual([initial.answer])
    expect(createCipherCircuitState(DATE, cipherCircuitProgress(solved)).phase).toBe('solved')
    expect(cipherCircuitReducer(solved, { type: 'restart' })).toMatchObject({ phase: 'playing', guesses: [] })
  })

  it('ends after eight failed pulses and loads a new date without yesterday’s progress', () => {
    let state = createCipherCircuitState(DATE)
    const wrong: CipherSignal[] = state.answer.map((signal) => ((signal + 1) % 6) as CipherSignal)
    for (let attempt = 0; attempt < CIPHER_CIRCUIT_GUESS_LIMIT; attempt += 1) {
      state = cipherCircuitReducer(fillGuess(state, wrong), { type: 'submit' })
    }
    expect(state.phase).toBe('failed')
    expect(state.guesses).toHaveLength(CIPHER_CIRCUIT_GUESS_LIMIT)
    expect(createCipherCircuitState('2026-11-20', cipherCircuitProgress(state)).guesses).toEqual([])
  })
})
