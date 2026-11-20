import { describe, expect, it } from 'vitest'
import {
  TUNING_FORK_MAX_SCORE,
  TUNING_FORK_PROMPTS,
  answerTuningFork,
  createTuningForkState,
  pauseTuningFork,
  resumeTuningFork,
  startTuningFork,
  tuningForkTargetHz,
} from './tuningFork'

describe('Tuning Fork', () => {
  it('starts with an original, fixed set of eight pitch intervals', () => {
    const state = startTuningFork(createTuningForkState())
    expect(state.phase).toBe('playing')
    expect(TUNING_FORK_PROMPTS).toHaveLength(8)
    expect(TUNING_FORK_PROMPTS.map((prompt) => prompt.interval)).toEqual([
      'up-step', 'down-leap', 'up-leap', 'down-step', 'down-leap', 'up-leap', 'down-step', 'up-step',
    ])
    expect(tuningForkTargetHz(TUNING_FORK_PROMPTS[0]!)).toBeCloseTo(246.94, 1)
  })

  it('awards one hundred points for a correct interval and advances', () => {
    let state = startTuningFork(createTuningForkState())
    state = answerTuningFork(state, 'up-step')
    expect(state.answers).toEqual([true])
    expect(state.score).toBe(100)
    expect(state.roundIndex).toBe(1)
    expect(state.feedback).toBe('Right interval · +100')
  })

  it('records an incorrect answer and reveals the interval before moving on', () => {
    let state = answerTuningFork(startTuningFork(createTuningForkState()), 'up-leap')
    expect(state.answers).toEqual([false])
    expect(state.score).toBe(0)
    expect(state.roundIndex).toBe(1)
    expect(state.feedback).toBe('Not quite. That pair moved up a step.')
  })

  it('pauses without losing the current pair', () => {
    let state = answerTuningFork(startTuningFork(createTuningForkState()), 'up-step')
    state = pauseTuningFork(state)
    expect(answerTuningFork(state, 'down-leap')).toBe(state)
    state = resumeTuningFork(state)
    expect(state.phase).toBe('playing')
    expect(state.roundIndex).toBe(1)
    expect(state.answers).toEqual([true])
  })

  it('finishes the eight-pair set and supports a fresh replay', () => {
    let state = startTuningFork(createTuningForkState())
    for (const prompt of TUNING_FORK_PROMPTS) state = answerTuningFork(state, prompt.interval)
    expect(state.phase).toBe('complete')
    expect(state.score).toBe(TUNING_FORK_MAX_SCORE)
    expect(state.answers).toHaveLength(TUNING_FORK_PROMPTS.length)
    state = startTuningFork(state)
    expect(state).toEqual({ ...createTuningForkState(), phase: 'playing', feedback: 'Listen to the pair, then pick its direction and size.' })
  })
})

