import { describe, expect, it } from 'vitest'
import {
  BEAT_BEACON_MAX_SCORE,
  BEAT_BEACON_TRACKS,
  beatBeaconCurrentStep,
  beatBeaconStepTimeMs,
  createBeatBeaconState,
  hitBeatBeacon,
  pauseBeatBeacon,
  resumeBeatBeacon,
  startBeatBeacon,
  tickBeatBeacon,
} from './beatBeacon'

describe('Beat Beacon', () => {
  it('keeps the opening count-in before the first timed cue', () => {
    let state = startBeatBeacon(createBeatBeaconState(), 1_000)
    state = tickBeatBeacon(state, 3_200)

    expect(state.phase).toBe('countIn')
    expect(beatBeaconCurrentStep(state)).toBeNull()
    state = hitBeatBeacon(state, 'kick', 3_200)
    expect(state.judgements[0]).toBeNull()
    expect(state.feedback).toBe('Stay with the count-in.')
    state = tickBeatBeacon(state, 3_401)
    expect(state.phase).toBe('playing')
    expect(beatBeaconCurrentStep(state)).toBe(0)
  })

  it('awards timing grades and advances only one cue at a time', () => {
    let state = startBeatBeacon(createBeatBeaconState(), 0)
    const firstCue = beatBeaconStepTimeMs(0)
    state = hitBeatBeacon(state, 'kick', firstCue + 45)
    expect(state.judgements[0]).toBe('perfect')
    expect(state.score).toBe(100)
    state = hitBeatBeacon(state, 'hat', beatBeaconStepTimeMs(1) + 105)
    expect(state.judgements[1]).toBe('good')
    expect(state.score).toBe(170)
    state = hitBeatBeacon(state, 'snare', beatBeaconStepTimeMs(2) - 160)
    expect(state.judgements[2]).toBe('close')
    expect(state.score).toBe(205)
    expect(beatBeaconCurrentStep(state)).toBe(3)
  })

  it('records a wrong pad as a miss and advances to the next cue', () => {
    let state = startBeatBeacon(createBeatBeaconState(), 0)
    state = hitBeatBeacon(state, 'tom', beatBeaconStepTimeMs(0))

    expect(state.judgements[0]).toBe('wrong')
    expect(state.score).toBe(0)
    expect(beatBeaconCurrentStep(state)).toBe(1)
  })

  it('marks expired cues as misses and continues the phrase', () => {
    let state = startBeatBeacon(createBeatBeaconState(), 0)
    state = tickBeatBeacon(state, beatBeaconStepTimeMs(0) + 181)

    expect(state.judgements[0]).toBe('miss')
    expect(beatBeaconCurrentStep(state)).toBe(1)
  })

  it('pauses the beat clock and resumes without losing a cue', () => {
    let state = startBeatBeacon(createBeatBeaconState(), 1_000)
    state = pauseBeatBeacon(state, 2_000)
    state = resumeBeatBeacon(state, 8_000)
    expect(state.phase).toBe('countIn')
    expect(state.startedAtMs).toBe(7_000)
    state = tickBeatBeacon(state, 9_500)
    expect(state.phase).toBe('playing')
    expect(beatBeaconCurrentStep(state)).toBe(0)
  })

  it('runs all four original patterns at their printed tempos and completes a perfect set', () => {
    expect(BEAT_BEACON_TRACKS.map(({ bpm }) => bpm)).toEqual([84, 92, 100, 108])
    let state = startBeatBeacon(createBeatBeaconState(), 500)
    for (let step = 0; step < 32; step += 1) {
      const track = BEAT_BEACON_TRACKS[Math.floor(step / 8)]!
      state = hitBeatBeacon(state, track.pattern[step % 8]!, 500 + beatBeaconStepTimeMs(step))
    }

    expect(state.phase).toBe('complete')
    expect(state.score).toBe(BEAT_BEACON_MAX_SCORE)
    expect(state.judgements).toHaveLength(32)
    expect(state.judgements.every((judgement) => judgement === 'perfect')).toBe(true)
  })
})

