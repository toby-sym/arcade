import { describe, expect, it } from 'vitest'
import {
  createPrismDashState,
  PRISM_DASH_SEGMENT_COUNT,
  PRISM_DASH_STARTING_LIVES,
  prismDashReducer,
  prismDashCourseForDate,
  prismDashSegmentDuration,
} from './prismDash'

const DATE = '2026-11-19'

describe('Prism Dash', () => {
  it('generates a deterministic daily course with a shard and a safe lane at every gate', () => {
    const course = prismDashCourseForDate(DATE)
    expect(prismDashCourseForDate(DATE)).toEqual(course)
    expect(prismDashCourseForDate('2026-11-20')).not.toEqual(course)
    expect(() => prismDashCourseForDate('2026-02-30')).toThrow(RangeError)
    expect(course).toHaveLength(PRISM_DASH_SEGMENT_COUNT)
    for (let index = 0; index < course.length; index += 1) {
      expect(course[index]!.shardLane).not.toBe(course[index]!.gateLane)
      if (index >= 2) {
        expect(course[index]!.gateLane === course[index - 1]!.gateLane && course[index]!.gateLane === course[index - 2]!.gateLane).toBe(false)
      }
    }
  })

  it('moves one lane at a time and rewards shard catches without entering the gate', () => {
    let state = prismDashReducer(createPrismDashState(DATE), { type: 'start' })
    expect(prismDashReducer(state, { type: 'move', delta: -1 }).lane).toBe(0)
    state = prismDashReducer(state, { type: 'lane', lane: state.course[0]!.shardLane })
    state = prismDashReducer(state, { type: 'tick', deltaMs: prismDashSegmentDuration(state.segmentIndex) })
    expect(state).toMatchObject({ segmentIndex: 1, shards: 1, score: 115, streak: 1, lives: PRISM_DASH_STARTING_LIVES, outcome: 'shard' })
    expect(prismDashReducer(state, { type: 'lane', lane: 9 as never })).toBe(state)
  })

  it('costs one life for each gate and ends cleanly after the third hit', () => {
    let state = prismDashReducer(createPrismDashState(DATE), { type: 'start' })
    for (let hit = 0; hit < PRISM_DASH_STARTING_LIVES; hit += 1) {
      const segment = state.course[state.segmentIndex]!
      state = prismDashReducer(state, { type: 'lane', lane: segment.gateLane })
      state = prismDashReducer(state, { type: 'tick', deltaMs: prismDashSegmentDuration(state.segmentIndex) })
      expect(state.lives).toBe(PRISM_DASH_STARTING_LIVES - hit - 1)
      expect(state.gatesHit).toBe(hit + 1)
    }
    expect(state.phase).toBe('over')
    expect(state.message).toContain('Three gates')
  })

  it('pauses the run, reaches the finish line, and restarts the same daily course', () => {
    let state = prismDashReducer(createPrismDashState(DATE), { type: 'start' })
    state = prismDashReducer(state, { type: 'tick', deltaMs: 450 })
    state = prismDashReducer(state, { type: 'pause' })
    state = prismDashReducer(state, { type: 'tick', deltaMs: 300 })
    expect(state.segmentElapsedMs).toBe(450)
    state = prismDashReducer(state, { type: 'resume' })

    while (state.phase === 'playing') {
      const segment = state.course[state.segmentIndex]!
      state = prismDashReducer(state, { type: 'lane', lane: segment.shardLane })
      state = prismDashReducer(state, { type: 'tick', deltaMs: prismDashSegmentDuration(state.segmentIndex) - state.segmentElapsedMs })
    }
    expect(state.phase).toBe('won')
    expect(state.segmentIndex).toBe(PRISM_DASH_SEGMENT_COUNT - 1)
    expect(state.shards).toBe(PRISM_DASH_SEGMENT_COUNT)
    expect(state.message).toContain('Finish line reached')
    const restarted = prismDashReducer(state, { type: 'restart' })
    expect(restarted).toMatchObject({ date: DATE, phase: 'ready', score: 0, shards: 0, lives: PRISM_DASH_STARTING_LIVES })
    expect(restarted.course).toEqual(state.course)
  })
})
