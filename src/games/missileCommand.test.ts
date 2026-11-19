import { describe, expect, it } from 'vitest'
import { createMissileCommandState, missileCommandReducer } from './missileCommand'

describe('Missile Command', () => {
  it('starts with three loaded silos and six cities', () => {
    const state = createMissileCommandState()

    expect(state.phase).toBe('ready')
    expect(state.cities).toHaveLength(6)
    expect(state.cities.every(Boolean)).toBe(true)
    expect(state.ammo).toEqual([8, 8, 8])
    expect(state.spawnRemaining).toBe(6)
  })

  it('aims within the field and launches from the closest loaded silo', () => {
    const playing = missileCommandReducer(createMissileCommandState(), { type: 'start' })
    const aimed = missileCommandReducer(playing, { type: 'aim', x: 310, y: 300 })
    const fired = missileCommandReducer(aimed, { type: 'fire' })

    expect(missileCommandReducer(aimed, { type: 'aim', x: Number.POSITIVE_INFINITY, y: 0 })).toBe(aimed)
    expect(missileCommandReducer(aimed, { type: 'aim', x: 600, y: 600 }).aim).toEqual({ x: 592, y: 510 })
    expect(fired.defense).toHaveLength(1)
    expect(fired.defense[0]?.x).toBe(300)
    expect(fired.defense[0]?.targetX).toBe(310)
    expect(fired.ammo).toEqual([8, 7, 8])
  })

  it('turns an interceptor into a growing blast at its target', () => {
    let state = missileCommandReducer(createMissileCommandState(), { type: 'start' })
    state = missileCommandReducer(state, { type: 'aim', x: 300, y: 480 })
    state = missileCommandReducer(state, { type: 'fire' })
    for (let frame = 0; frame < 9; frame += 1) state = missileCommandReducer(state, { type: 'tick' })

    expect(state.defense).toHaveLength(0)
    expect(state.blasts).toHaveLength(1)
    expect(state.blasts[0]?.x).toBe(300)
    expect(state.blasts[0]?.y).toBe(480)
    expect(state.blasts[0]?.radius).toBeGreaterThan(0)
  })

  it('destroys incoming missiles inside a blast and scores each hit', () => {
    const state = {
      ...createMissileCommandState(),
      phase: 'playing' as const,
      incoming: [{ id: 20, x: 300, y: 250, vx: 0, vy: 0, target: 0 }],
      blasts: [{ id: 21, x: 300, y: 250, radius: 24, expanding: false }],
    }
    const next = missileCommandReducer(state, { type: 'tick' })

    expect(next.incoming).toHaveLength(0)
    expect(next.score).toBe(25)
  })

  it('launches attacks on a deterministic interval and removes cities on impact', () => {
    const aboutToLaunch = {
      ...createMissileCommandState(),
      phase: 'playing' as const,
      tick: 69,
    }
    const launched = missileCommandReducer(aboutToLaunch, { type: 'tick' })
    expect(launched.incoming).toHaveLength(1)
    expect(launched.spawnRemaining).toBe(5)

    const impact = {
      ...createMissileCommandState(),
      phase: 'playing' as const,
      spawnRemaining: 0,
      incoming: [{ id: 30, x: 68, y: 548, vx: 0, vy: 0, target: 0 }],
    }
    const next = missileCommandReducer(impact, { type: 'tick' })
    expect(next.cities[0]).toBe(false)
    expect(next.cities.filter(Boolean)).toHaveLength(5)
    expect(next.wave).toBe(2)
    expect(next.ammo).toEqual([8, 8, 8])
  })

  it('ends when every city is lost and pauses the simulation', () => {
    const playing = missileCommandReducer(createMissileCommandState(), { type: 'start' })
    const paused = missileCommandReducer(playing, { type: 'pause' })
    expect(missileCommandReducer(paused, { type: 'tick' })).toBe(paused)
    expect(missileCommandReducer(paused, { type: 'resume' }).phase).toBe('playing')

    const noCities = { ...playing, cities: playing.cities.map(() => false), incoming: [] }
    const over = missileCommandReducer(noCities, { type: 'tick' })
    expect(over.phase).toBe('over')
    expect(over.message).toContain('Game over')
  })
})
