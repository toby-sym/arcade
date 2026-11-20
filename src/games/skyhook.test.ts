import { describe, expect, it } from 'vitest'
import {
  createSkyhookState,
  formatFlightTime,
  skyhookDistance,
  skyhookReducer,
  type SkyhookState,
} from './skyhook'

function atPoint(state: SkyhookState, x: number, y: number): SkyhookState {
  return {
    ...state,
    phase: 'playing',
    attachedAnchor: null,
    controls: { left: false, right: false, reel: false, brake: false },
    capsule: { ...state.capsule, x, y, vx: 0, vy: 0, angle: 0 },
  }
}

describe('Skyhook flight', () => {
  it('builds a deterministic daily course and swings smoothly from a held control', () => {
    const first = createSkyhookState('2026-11-19')
    const second = createSkyhookState('2026-11-19')
    expect(first.course).toEqual(second.course)
    expect(first.course.date).toBe('2026-11-19')
    expect(first.attachedAnchor).toBe(0)

    let state = skyhookReducer(first, { type: 'start' })
    state = skyhookReducer(state, { type: 'control', control: 'right', pressed: true })
    state = skyhookReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.swingAngle).not.toBe(first.swingAngle)
    expect(state.capsule.x).not.toBe(first.capsule.x)
    expect(state.angularVelocity).toBeGreaterThan(0)
  })

  it('releases tangential momentum and catches a nearby new anchor without snapping speed away', () => {
    let state = skyhookReducer(createSkyhookState('2026-11-19'), { type: 'start' })
    state = skyhookReducer(state, { type: 'control', control: 'right', pressed: true })
    for (let frame = 0; frame < 10; frame += 1) state = skyhookReducer(state, { type: 'tick', deltaMs: 50 })
    state = skyhookReducer(state, { type: 'tether' })
    expect(state.attachedAnchor).toBeNull()
    expect(Math.hypot(state.capsule.vx, state.capsule.vy)).toBeGreaterThan(30)

    const target = state.course.anchors[1]!
    const approach = atPoint(state, target.x, target.y + 90)
    const caught = skyhookReducer(approach, { type: 'tether' })
    expect(caught.attachedAnchor).toBe(1)
    expect(caught.lastAnchor).toBe(1)
    expect(caught.ropeLength).toBe(90)
    expect(Math.hypot(caught.capsule.vx, caught.capsule.vy)).toBe(0)
  })

  it('transfers directly to an in-range anchor and carries the swing through the catch', () => {
    const initial = createSkyhookState('2026-11-19')
    const target = initial.course.anchors[1]!
    const attached = {
      ...initial,
      phase: 'playing' as const,
      attachedAnchor: 0,
      lastAnchor: 0,
      capsule: { ...initial.capsule, x: target.x + 90, y: target.y, vx: 0, vy: -84 },
    }

    const transferred = skyhookReducer(attached, { type: 'tether' })
    expect(transferred.attachedAnchor).toBe(1)
    expect(transferred.lastAnchor).toBe(1)
    expect(transferred.message).toMatch(/transferred/i)
    expect(Math.hypot(transferred.capsule.vx, transferred.capsule.vy)).toBeCloseTo(84)
  })

  it('collects beacons in sequence and completes a safe dock', () => {
    let state = createSkyhookState('2026-11-19')
    for (const beacon of state.course.beacons) {
      state = atPoint(state, beacon.x, beacon.y)
      state = skyhookReducer(state, { type: 'tick', deltaMs: 16 })
    }
    expect(state.nextBeacon).toBe(3)
    expect(state.score).toBe(1500)
    state = atPoint(state, state.course.dock.x, state.course.dock.y)
    state = skyhookReducer(state, { type: 'tick', deltaMs: 16 })
    expect(state.phase).toBe('won')
    expect(state.score).toBeGreaterThan(1500)
    expect(state.message).toMatch(/dock secured/i)
  })

  it('takes one hull point on a hazard strike and protects the reset capsule briefly', () => {
    const initial = createSkyhookState('2026-11-19')
    const hazard = initial.course.hazards[0]!
    let state = atPoint(initial, hazard.x, hazard.y)
    state = skyhookReducer(state, { type: 'tick', deltaMs: 16 })
    expect(state.hull).toBe(2)
    expect(state.attachedAnchor).toBe(state.lastAnchor)
    expect(state.invulnerableMs).toBeGreaterThan(0)
    const safePosition = { x: state.capsule.x, y: state.capsule.y }
    state = atPoint(state, hazard.x, hazard.y)
    state = { ...state, invulnerableMs: 500 }
    state = skyhookReducer(state, { type: 'tick', deltaMs: 16 })
    expect(state.hull).toBe(2)
    expect(skyhookDistance(state.capsule, safePosition)).toBeGreaterThan(100)
  })

  it('supports pause, resume, restart, and readable flight time', () => {
    let state = skyhookReducer(createSkyhookState('2026-11-19'), { type: 'start' })
    state = skyhookReducer(state, { type: 'control', control: 'reel', pressed: true })
    state = skyhookReducer(state, { type: 'pause' })
    expect(state.phase).toBe('paused')
    expect(Object.values(state.controls).some(Boolean)).toBe(false)
    state = skyhookReducer(state, { type: 'resume' })
    expect(state.phase).toBe('playing')
    expect(formatFlightTime(125_900)).toBe('02:05')
    expect(skyhookReducer(state, { type: 'restart' })).toMatchObject({ phase: 'ready', score: 0, nextBeacon: 0, hull: 3 })
  })
})
