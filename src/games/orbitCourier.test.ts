import { describe, expect, it } from 'vitest'
import {
  createOrbitCourierState,
  orbitCourierHazardsAt,
  orbitCourierReducer,
  ORBIT_COURIER_DOCK_SPEED_LIMIT,
  ORBIT_COURIER_MAX_HULL,
  ORBIT_COURIER_STATIONS,
} from './orbitCourier'

function beginFlight() {
  return orbitCourierReducer(createOrbitCourierState(), { type: 'start' })
}

describe('Orbit Courier flight model', () => {
  it('starts a three-delivery route and keeps the hazards deterministic', () => {
    const state = createOrbitCourierState()
    expect(state.phase).toBe('ready')
    expect(ORBIT_COURIER_STATIONS).toHaveLength(3)
    expect(orbitCourierHazardsAt(2400)).toEqual(orbitCourierHazardsAt(2400))
    expect(orbitCourierHazardsAt(2400)).not.toEqual(orbitCourierHazardsAt(2401))
    expect(orbitCourierReducer(state, { type: 'start' }).phase).toBe('playing')
  })

  it('turns and accelerates smoothly while a control is held', () => {
    let state = beginFlight()
    state = orbitCourierReducer(state, { type: 'control', control: 'thrust', pressed: true })
    state = orbitCourierReducer(state, { type: 'control', control: 'right', pressed: true })
    for (let frame = 0; frame < 12; frame += 1) state = orbitCourierReducer(state, { type: 'tick', deltaMs: 40 })

    expect(state.ship.x).toBeGreaterThan(130)
    expect(state.ship.vx).toBeGreaterThan(40)
    expect(state.ship.angle).toBeGreaterThan(Math.PI / 2)
    expect(state.elapsedMs).toBe(480)
  })

  it('brakes drift and clamps unusually long frames', () => {
    const playing = beginFlight()
    const moving = { ...playing, ship: { ...playing.ship, vx: 150 } }
    const coasting = orbitCourierReducer(moving, { type: 'tick', deltaMs: 50 })
    const braking = orbitCourierReducer({ ...moving, controls: { ...moving.controls, brake: true } }, { type: 'tick', deltaMs: 50 })
    const longFrame = orbitCourierReducer(moving, { type: 'tick', deltaMs: 800 })

    expect(Math.hypot(braking.ship.vx, braking.ship.vy)).toBeLessThan(Math.hypot(coasting.ship.vx, coasting.ship.vy))
    expect(longFrame.elapsedMs).toBe(50)
  })

  it('takes a hull point on impact and returns the courier to its last dock', () => {
    const hazard = orbitCourierHazardsAt(50)[0]!
    const playing = {
      ...beginFlight(),
      ship: { x: hazard.x, y: hazard.y, vx: 0, vy: 0, angle: 0 },
    }
    const struck = orbitCourierReducer(playing, { type: 'tick', deltaMs: 50 })

    expect(struck.hull).toBe(ORBIT_COURIER_MAX_HULL - 1)
    expect(struck.ship).toMatchObject({ x: 130, y: 315, vx: 0, vy: 0 })
    expect(struck.invulnerableMs).toBeGreaterThan(0)
  })

  it('requires a safe approach before docking and awards a smoother arrival', () => {
    const playing = beginFlight()
    const destination = ORBIT_COURIER_STATIONS[0]!
    const nearby = { ...playing, ship: { ...playing.ship, x: destination.x, y: destination.y, vx: 120, vy: 0 } }
    const tooFast = orbitCourierReducer(nearby, { type: 'dock' })
    expect(tooFast.delivered).toBe(0)
    expect(tooFast.message).toContain(`under ${ORBIT_COURIER_DOCK_SPEED_LIMIT}`)

    const docked = orbitCourierReducer({ ...nearby, ship: { ...nearby.ship, vx: 0, vy: 0 } }, { type: 'dock' })
    expect(docked.delivered).toBe(1)
    expect(docked.nextStation).toBe(1)
    expect(docked.score).toBeGreaterThan(900)
    expect(docked.lastDock).toEqual({ x: destination.x, y: destination.y })
  })

  it('finishes after three deliveries and pauses or restarts cleanly', () => {
    const finalStation = ORBIT_COURIER_STATIONS[2]!
    const finalApproach = {
      ...beginFlight(),
      nextStation: 2,
      delivered: 2,
      score: 1800,
      ship: { x: finalStation.x, y: finalStation.y, vx: 0, vy: 0, angle: 0 },
    }
    const won = orbitCourierReducer(finalApproach, { type: 'dock' })
    expect(won.phase).toBe('won')
    expect(won.delivered).toBe(3)
    expect(won.score).toBeGreaterThan(1800)

    const paused = orbitCourierReducer(orbitCourierReducer(beginFlight(), { type: 'pause' }), { type: 'tick', deltaMs: 50 })
    expect(paused.phase).toBe('paused')
    expect(paused.elapsedMs).toBe(0)
    expect(orbitCourierReducer(won, { type: 'restart' })).toMatchObject({ phase: 'ready', delivered: 0, hull: ORBIT_COURIER_MAX_HULL })
  })
})
