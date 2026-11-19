import { describe, expect, it } from 'vitest'
import { asteroidsReducer, createAsteroidsState } from './asteroids'

describe('Asteroids', () => {
  it('starts with three ships and a deterministic first wave', () => {
    const state = createAsteroidsState()

    expect(state.phase).toBe('ready')
    expect(state.lives).toBe(3)
    expect(state.wave).toBe(1)
    expect(state.rocks).toHaveLength(6)
    expect(state.rocks.every((rock) => rock.size === 'large')).toBe(true)
  })

  it('rotates and accelerates the ship while controls are held', () => {
    const playing = asteroidsReducer(createAsteroidsState(), { type: 'start' })
    const turning = asteroidsReducer(playing, { type: 'control', control: 'left', pressed: true })
    const thrusting = asteroidsReducer(turning, { type: 'control', control: 'thrust', pressed: true })
    const moved = asteroidsReducer(thrusting, { type: 'tick', deltaMs: 1000 / 60 })

    expect(moved.ship.angle).toBeCloseTo(-0.078)
    expect(moved.ship.vx).toBeLessThan(0)
    expect(moved.ship.vy).toBeLessThan(0)
    expect(asteroidsReducer(moved, { type: 'control', control: 'left', pressed: true })).toBe(moved)
  })

  it('fires continuously, breaks rocks into smaller ones, and advances the wave', () => {
    const playing = {
      ...createAsteroidsState(),
      phase: 'playing' as const,
      ship: { x: 300, y: 300, vx: 0, vy: 0, angle: 0, invulnerable: 0 },
      rocks: [{ id: 0, x: 300, y: 260, vx: 0, vy: 0, size: 'small' as const, rotation: 0, spin: 0 }],
      nextId: 1,
      controls: { left: false, right: false, thrust: false, fire: true },
    }
    const firstShot = asteroidsReducer(playing, { type: 'tick', deltaMs: 1000 / 60 })
    expect(firstShot.shots).toHaveLength(1)
    const secondShotTick = asteroidsReducer(firstShot, { type: 'tick', deltaMs: 1000 / 60 })
    const hit = asteroidsReducer(secondShotTick, { type: 'tick', deltaMs: 1000 / 60 })

    expect(hit.score).toBe(100)
    expect(hit.wave).toBe(2)
    expect(hit.rocks).toHaveLength(7)
    expect(hit.rocks.every((rock) => rock.size === 'large')).toBe(true)
  })

  it('splits a large rock into medium rocks and awards the right score', () => {
    const playing = {
      ...createAsteroidsState(),
      phase: 'playing' as const,
      ship: { x: 100, y: 100, vx: 0, vy: 0, angle: 0, invulnerable: 0 },
      rocks: [{ id: 0, x: 300, y: 300, vx: 0, vy: 0, size: 'large' as const, rotation: 0, spin: 0 }],
      shots: [{ x: 300, y: 300, vx: 0, vy: 0, life: 10 }],
      nextId: 1,
    }
    const next = asteroidsReducer(playing, { type: 'tick', deltaMs: 1000 / 60 })

    expect(next.score).toBe(20)
    expect(next.rocks).toHaveLength(2)
    expect(next.rocks.every((rock) => rock.size === 'medium')).toBe(true)
  })

  it('wraps the ship across field edges and drops a life on a collision', () => {
    const playing = {
      ...createAsteroidsState(),
      phase: 'playing' as const,
      ship: { x: 599, y: 300, vx: 2, vy: 0, angle: 0, invulnerable: 0 },
      rocks: [],
    }
    const wrapped = asteroidsReducer(playing, { type: 'tick', deltaMs: 1000 / 60 })
    expect(wrapped.ship.x).toBeLessThan(5)

    const collision = {
      ...playing,
      ship: { x: 300, y: 300, vx: 0, vy: 0, angle: 0, invulnerable: 0 },
      rocks: [{ id: 8, x: 300, y: 300, vx: 0, vy: 0, size: 'small' as const, rotation: 0, spin: 0 }],
    }
    const hit = asteroidsReducer(collision, { type: 'tick', deltaMs: 1000 / 60 })
    expect(hit.lives).toBe(2)
    expect(hit.ship.invulnerable).toBeGreaterThan(0)
    expect(asteroidsReducer(hit, { type: 'tick', deltaMs: 1000 / 60 }).lives).toBe(2)
  })

  it('pauses simulation and ends after the last ship is hit', () => {
    const playing = asteroidsReducer(createAsteroidsState(), { type: 'start' })
    const paused = asteroidsReducer(playing, { type: 'pause' })
    expect(asteroidsReducer(paused, { type: 'tick', deltaMs: 16 })).toBe(paused)
    expect(asteroidsReducer(paused, { type: 'resume' }).phase).toBe('playing')

    const lastShip = {
      ...playing,
      lives: 1,
      ship: { x: 300, y: 300, vx: 0, vy: 0, angle: 0, invulnerable: 0 },
      rocks: [{ id: 8, x: 300, y: 300, vx: 0, vy: 0, size: 'small' as const, rotation: 0, spin: 0 }],
    }
    const over = asteroidsReducer(lastShip, { type: 'tick', deltaMs: 16 })
    expect(over.phase).toBe('over')
    expect(over.lives).toBe(0)
  })
})
