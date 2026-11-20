import { describe, expect, it } from 'vitest'
import {
  createNeonRallyState,
  formatNeonRallyTime,
  NEON_RALLY_CHECKPOINTS,
  neonRallyDistanceToTrack,
  neonRallyReducer,
  type NeonRallyState,
} from './neonRally'

function atCheckpoint(state: NeonRallyState, index: number, nextCheckpoint: number, lap = state.lap): NeonRallyState {
  const point = NEON_RALLY_CHECKPOINTS[index]
  return { ...state, lap, nextCheckpoint, vehicle: { ...state.vehicle, ...point, speed: 90 } }
}

describe('Neon Rally circuit', () => {
  it('starts cleanly and accelerates while held', () => {
    let state = createNeonRallyState()
    state = neonRallyReducer(state, { type: 'control', control: 'accelerate', pressed: true })
    expect(state.phase).toBe('ready')
    state = neonRallyReducer(state, { type: 'start' })
    state = neonRallyReducer(state, { type: 'control', control: 'accelerate', pressed: true })
    state = neonRallyReducer(state, { type: 'tick', deltaMs: 50 })

    expect(state.vehicle.speed).toBeGreaterThan(0)
    expect(state.vehicle.x).toBeGreaterThan(createNeonRallyState().vehicle.x)
    expect(state.elapsedMs).toBeCloseTo(50)
  })

  it('steers continuously and brakes without reversing', () => {
    let state = neonRallyReducer(createNeonRallyState(), { type: 'start' })
    state = { ...state, vehicle: { ...state.vehicle, speed: 150 } }
    state = neonRallyReducer(state, { type: 'control', control: 'right', pressed: true })
    state = neonRallyReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.vehicle.heading).toBeGreaterThan(createNeonRallyState().vehicle.heading)

    state = neonRallyReducer(state, { type: 'control', control: 'right', pressed: false })
    state = neonRallyReducer(state, { type: 'control', control: 'accelerate', pressed: true })
    state = neonRallyReducer(state, { type: 'tick', deltaMs: 50 })
    state = neonRallyReducer(state, { type: 'control', control: 'accelerate', pressed: false })
    state = neonRallyReducer(state, { type: 'control', control: 'brake', pressed: true })
    state = neonRallyReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.vehicle.speed).toBeGreaterThanOrEqual(0)
  })

  it('keeps checkpoint gates in sequence and starts the next lap at the line', () => {
    let state = neonRallyReducer(createNeonRallyState(), { type: 'start' })
    state = atCheckpoint(state, 3, 1)
    state = neonRallyReducer(state, { type: 'tick', deltaMs: 16 })
    expect(state.nextCheckpoint).toBe(1)

    state = atCheckpoint(state, 1, 1)
    state = neonRallyReducer(state, { type: 'tick', deltaMs: 1 })
    expect(state.nextCheckpoint).toBe(2)

    state = atCheckpoint(state, 0, 0, 1)
    state = neonRallyReducer(state, { type: 'tick', deltaMs: 1 })
    expect(state.lap).toBe(2)
    expect(state.nextCheckpoint).toBe(1)
    expect(state.lapTimes).toHaveLength(1)
  })

  it('finishes after three full laps and records the final split', () => {
    let state = neonRallyReducer(createNeonRallyState(), { type: 'start' })
    state = { ...state, elapsedMs: 23_000, lapElapsedMs: 7_400 }
    state = atCheckpoint(state, 0, 0, 3)
    state = neonRallyReducer(state, { type: 'tick', deltaMs: 50 })

    expect(state.phase).toBe('won')
    expect(state.lapTimes).toHaveLength(1)
    expect(state.lapTimes[0]).toBeGreaterThan(7_400)
    expect(state.controls).toEqual({ left: false, right: false, accelerate: false, brake: false })
  })

  it('reduces speed on the grass and finds the lane around the oval', () => {
    expect(neonRallyDistanceToTrack(NEON_RALLY_CHECKPOINTS[0])).toBeCloseTo(0)
    expect(neonRallyDistanceToTrack({ x: 320, y: 20 })).toBeGreaterThan(50)

    let state = neonRallyReducer(createNeonRallyState(), { type: 'start' })
    state = { ...state, vehicle: { ...state.vehicle, x: 320, y: 28, speed: 190 } }
    state = neonRallyReducer(state, { type: 'control', control: 'accelerate', pressed: true })
    state = neonRallyReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.vehicle.offRoad).toBe(true)
    expect(state.vehicle.speed).toBeLessThanOrEqual(120)
  })

  it('pauses, clears held controls, resumes, and restarts the race', () => {
    let state = neonRallyReducer(createNeonRallyState(), { type: 'start' })
    state = neonRallyReducer(state, { type: 'control', control: 'left', pressed: true })
    state = neonRallyReducer(state, { type: 'pause' })
    expect(state.phase).toBe('paused')
    expect(state.controls.left).toBe(false)
    const paused = neonRallyReducer(state, { type: 'tick', deltaMs: 50 })
    expect(paused).toBe(state)
    state = neonRallyReducer(state, { type: 'resume' })
    expect(state.phase).toBe('playing')
    expect(neonRallyReducer(state, { type: 'restart' })).toEqual(createNeonRallyState())
  })

  it('formats race time in minutes, seconds, and centiseconds', () => {
    expect(formatNeonRallyTime(0)).toBe('00:00.00')
    expect(formatNeonRallyTime(65_439)).toBe('01:05.43')
  })
})
