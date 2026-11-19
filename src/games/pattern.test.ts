import { describe, expect, it } from 'vitest'
import { createPatternState, patternReducer } from './pattern'

function getInputState(tile: number) {
  let state = patternReducer(createPatternState(), { type: 'start', tile })
  state = patternReducer(state, { type: 'advance' })
  return patternReducer(state, { type: 'advance' })
}

describe('Pattern Memory rules', () => {
  it('shows its first tile, then accepts input after the pattern ends', () => {
    let state = patternReducer(createPatternState(), { type: 'start', tile: 2 })
    expect(state.phase).toBe('showing')

    state = patternReducer(state, { type: 'advance' })
    expect(state.activeTile).toBe(2)
    expect(state.message).toContain('bottom left')

    state = patternReducer(state, { type: 'advance' })
    expect(state.phase).toBe('input')
    expect(state.activeTile).toBeNull()
  })

  it('accepts the sequence and adds one tile to the next round', () => {
    const input = getInputState(1)
    const next = patternReducer(input, { type: 'choose', tile: 1, nextTile: 3 })

    expect(next.phase).toBe('showing')
    expect(next.sequence).toEqual([1, 3])
    expect(next.completedRounds).toBe(1)
    expect(next.message).toBe('Pattern complete. Round 2 is next.')
  })

  it('ends the run on a wrong tile and records the tile that was pressed', () => {
    const input = getInputState(0)
    const failed = patternReducer(input, { type: 'choose', tile: 2, nextTile: 3 })

    expect(failed.phase).toBe('failed')
    expect(failed.failedTile).toBe(2)
    expect(failed.message).toContain('Pattern broken')
  })

  it('pauses and resumes without losing the current input position', () => {
    const input = getInputState(0)
    const paused = patternReducer(input, { type: 'pause' })
    expect(paused.phase).toBe('paused')
    expect(paused.resumePhase).toBe('input')

    const resumed = patternReducer(paused, { type: 'resume' })
    expect(resumed.phase).toBe('input')
    expect(resumed.inputIndex).toBe(0)
    expect(resumed.sequence).toEqual([0])
  })

  it('replays the tile that was visible when a round was paused', () => {
    let state = patternReducer(createPatternState(), { type: 'start', tile: 3 })
    state = patternReducer(state, { type: 'advance' })
    state = patternReducer(state, { type: 'pause' })
    state = patternReducer(state, { type: 'resume' })
    expect(state.showIndex).toBe(0)
    expect(state.activeTile).toBeNull()
    expect(patternReducer(state, { type: 'advance' }).activeTile).toBe(3)
  })
})
