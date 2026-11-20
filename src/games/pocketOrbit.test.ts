import { describe, expect, it } from 'vitest'
import {
  createPocketOrbitState,
  pocketOrbitCourseForDate,
  pocketOrbitDistance,
  pocketOrbitPreview,
  pocketOrbitReducer,
  POCKET_ORBIT_BEACON_COUNT,
} from './pocketOrbit'

describe('Pocket Orbit daily flight', () => {
  it('builds the same locally generated course for a UTC date', () => {
    const first = pocketOrbitCourseForDate('2026-11-20')
    expect(pocketOrbitCourseForDate('2026-11-20')).toEqual(first)
    expect(pocketOrbitCourseForDate('2026-11-21')).not.toEqual(first)
    expect(first.beacons).toHaveLength(POCKET_ORBIT_BEACON_COUNT)
    expect(first.beacons.every((beacon) => pocketOrbitDistance(beacon, first.well) > first.well.radius * 2)).toBe(true)
    expect(first.dock.radius).toBeGreaterThan(first.beacons[0]!.radius)
  })

  it('previews an adjustable arc and lets the pilot tune the launch', () => {
    let state = pocketOrbitReducer(createPocketOrbitState('2026-11-20'), { type: 'start' })
    expect(pocketOrbitPreview(state).length).toBeGreaterThan(10)
    const angle = state.aimAngle
    const power = state.power
    state = pocketOrbitReducer(state, { type: 'adjust-angle', degrees: 3 })
    state = pocketOrbitReducer(state, { type: 'adjust-power', amount: 5 })
    expect(state.aimAngle).not.toBe(angle)
    expect(state.power).toBe(power + 5)
    expect(pocketOrbitReducer(state, { type: 'launch' }).launches).toBe(1)
  })

  it('sails the ideal orbit through every beacon and docks in one launch', () => {
    const initial = createPocketOrbitState('2026-11-20')
    let state = pocketOrbitReducer(initial, { type: 'start' })
    state = pocketOrbitReducer(state, { type: 'aim', angle: initial.course.idealAngle, power: initial.course.idealPower })
    state = pocketOrbitReducer(state, { type: 'launch' })
    for (let frame = 0; frame < 600 && state.phase === 'flying'; frame += 1) {
      state = pocketOrbitReducer(state, { type: 'tick', deltaMs: 50 })
    }
    expect(state.phase).toBe('complete')
    expect(state.beacons).toEqual(Array(POCKET_ORBIT_BEACON_COUNT).fill(true))
    expect(state.launches).toBe(1)
  })

  it('keeps generated daily routes solvable with the visible adjustment steps', () => {
    for (const date of ['2026-11-01', '2026-11-10', '2026-11-20', '2026-11-30', '2027-01-01']) {
      let foundRoute = false
      for (let angleSteps = -7; angleSteps <= 7 && !foundRoute; angleSteps += 1) {
        for (let powerSteps = -5; powerSteps <= 5 && !foundRoute; powerSteps += 1) {
          const initial = createPocketOrbitState(date)
          let state = pocketOrbitReducer(initial, { type: 'start' })
          state = pocketOrbitReducer(state, { type: 'adjust-angle', degrees: angleSteps * 2 })
          state = pocketOrbitReducer(state, { type: 'adjust-power', amount: powerSteps * 5 })
          state = pocketOrbitReducer(state, { type: 'launch' })
          for (let frame = 0; frame < 240 && state.phase === 'flying'; frame += 1) {
            state = pocketOrbitReducer(state, { type: 'tick', deltaMs: 50 })
          }
          foundRoute = state.phase === 'complete'
        }
      }
      expect(foundRoute, `No course solved with visible adjustments for ${date}`).toBe(true)
    }
  })

  it('pauses the live route, resumes the same phase, and restarts today cleanly', () => {
    let state = pocketOrbitReducer(createPocketOrbitState('2026-11-20'), { type: 'start' })
    state = pocketOrbitReducer(state, { type: 'launch' })
    state = pocketOrbitReducer(state, { type: 'pause' })
    expect(state.phase).toBe('paused')
    expect(state.resumePhase).toBe('flying')
    const elapsed = state.elapsedMs
    expect(pocketOrbitReducer(state, { type: 'tick', deltaMs: 50 }).elapsedMs).toBe(elapsed)
    expect(pocketOrbitReducer(state, { type: 'resume' }).phase).toBe('flying')
    expect(pocketOrbitReducer(state, { type: 'restart' })).toMatchObject({ phase: 'ready', launches: 0, elapsedMs: 0 })
  })

  it('retries after an overshoot instead of ending the daily run', () => {
    const initial = createPocketOrbitState('2026-11-20')
    let state = pocketOrbitReducer(initial, { type: 'start' })
    state = pocketOrbitReducer(state, { type: 'aim', angle: initial.course.idealAngle + Math.PI, power: 245 })
    state = pocketOrbitReducer(state, { type: 'launch' })
    for (let frame = 0; frame < 200 && state.phase === 'flying'; frame += 1) {
      state = pocketOrbitReducer(state, { type: 'tick', deltaMs: 50 })
    }
    expect(state.phase).toBe('aiming')
    expect(state.launches).toBe(1)
    expect(state.beacons).toEqual(Array(POCKET_ORBIT_BEACON_COUNT).fill(false))
  })
})
