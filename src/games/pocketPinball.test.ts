import { describe, expect, it } from 'vitest'
import {
  createPocketPinballState,
  PINBALL_BALL_RADIUS,
  PINBALL_BUMPERS,
  pocketPinballReducer,
  pocketPinballTime,
  type PocketPinballState,
} from './pocketPinball'

function liveBall(state: PocketPinballState, values: Partial<PocketPinballState['ball']>): PocketPinballState {
  return {
    ...state,
    phase: 'playing',
    ballInShooter: false,
    ball: { ...state.ball, ...values },
  }
}

describe('Pocket Pinball table', () => {
  it('starts with a shooter ball and serves it with a clean upward shot', () => {
    const ready = createPocketPinballState()
    expect(ready.ballsRemaining).toBe(3)
    expect(ready.ballInShooter).toBe(true)

    let state = pocketPinballReducer(ready, { type: 'start' })
    expect(state.phase).toBe('playing')
    state = pocketPinballReducer(state, { type: 'launch' })
    expect(state.ballInShooter).toBe(false)
    expect(state.ball.vy).toBeLessThan(-400)
    state = pocketPinballReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.ball.y).toBeLessThan(ready.ball.y)
  })

  it('moves each flipper continuously while its control is held', () => {
    let state = pocketPinballReducer(createPocketPinballState(), { type: 'start' })
    state = pocketPinballReducer(state, { type: 'control', control: 'left', pressed: true })
    state = pocketPinballReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.leftFlipper.angle).toBeLessThan(0.35)
    expect(state.leftFlipper.angularVelocity).toBeLessThan(0)
    state = pocketPinballReducer(state, { type: 'control', control: 'left', pressed: false })
    state = pocketPinballReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.leftFlipper.angle).toBeGreaterThan(-0.12)
  })

  it('bounces off a bumper and awards its points once per clean hit', () => {
    const bumper = PINBALL_BUMPERS[0]!
    let state = liveBall(createPocketPinballState(), {
      x: bumper.x - bumper.radius - PINBALL_BALL_RADIUS - 5,
      y: bumper.y,
      vx: 420,
      vy: 0,
    })
    state = pocketPinballReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.score).toBe(bumper.points)
    expect(state.ball.vx).toBeLessThan(0)
  })

  it('spends a timed nudge for a controlled save and restores its cooldown', () => {
    let state = liveBall(createPocketPinballState(), { x: 180, y: 500, vx: 20, vy: 150 })
    state = { ...state, score: 300 }
    state = pocketPinballReducer(state, { type: 'nudge' })
    expect(state.score).toBe(200)
    expect(state.ball.vy).toBe(-115)
    expect(state.nudgeCooldownMs).toBe(900)
    expect(pocketPinballReducer(state, { type: 'nudge' })).toBe(state)
    for (let frame = 0; frame < 18; frame += 1) state = pocketPinballReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.nudgeCooldownMs).toBe(0)
    expect(pocketPinballReducer(state, { type: 'nudge' }).score).toBe(100)
  })

  it('returns a drained ball to the shooter, pauses, resumes, and restarts cleanly', () => {
    let state = liveBall(createPocketPinballState(), { x: 260, y: 770, vx: 0, vy: 80 })
    state = pocketPinballReducer(state, { type: 'tick', deltaMs: 16 })
    expect(state.ballsRemaining).toBe(2)
    expect(state.ballInShooter).toBe(true)
    expect(state.ball).toMatchObject({ x: 452, y: 701, vx: 0, vy: 0 })
    state = pocketPinballReducer(state, { type: 'pause' })
    expect(state.phase).toBe('paused')
    expect(state.controls.left).toBe(false)
    state = pocketPinballReducer(state, { type: 'resume' })
    expect(state.phase).toBe('playing')
    expect(pocketPinballTime(125_900)).toBe('02:05')
    expect(pocketPinballReducer(state, { type: 'restart' })).toMatchObject({ phase: 'ready', score: 0, ballsRemaining: 3, targetMask: 0 })
  })
})
