import { describe, expect, it } from 'vitest'
import {
  BALL_RADIUS,
  BREAKOUT_HEIGHT,
  BREAKOUT_WIDTH,
  PADDLE_WIDTH,
  PADDLE_Y,
  breakoutBrickRect,
  breakoutReducer,
  createBreakoutState,
  remainingBricks,
} from './breakout'

describe('Breakout game rules', () => {
  it('clamps the paddle to the playfield', () => {
    const state = createBreakoutState()
    expect(breakoutReducer(state, { type: 'movePaddle', centerX: -100 }).paddleX).toBe(0)
    expect(breakoutReducer(state, { type: 'movePaddle', centerX: 900 }).paddleX).toBe(BREAKOUT_WIDTH - PADDLE_WIDTH)
  })

  it('pauses and resumes without moving the ball while paused', () => {
    const playing = breakoutReducer(createBreakoutState(), { type: 'start' })
    const paused = breakoutReducer(playing, { type: 'pause' })
    expect(breakoutReducer(paused, { type: 'tick' })).toEqual(paused)
    expect(breakoutReducer(paused, { type: 'resume' }).phase).toBe('playing')
  })

  it('clears a struck brick, scores, and bounces away from it', () => {
    const brick = breakoutBrickRect(0)
    const bricks = Array.from({ length: 40 }, () => false)
    bricks[0] = true
    const state = {
      ...createBreakoutState(),
      phase: 'playing' as const,
      bricks,
      ball: { x: brick.x + brick.width / 2, y: brick.y + brick.height + BALL_RADIUS + 1, vx: 0, vy: -4 },
    }
    const next = breakoutReducer(state, { type: 'tick' })
    expect(next.bricks[0]).toBe(false)
    expect(next.score).toBe(10)
    expect(next.ball.vy).toBeGreaterThan(0)
    expect(remainingBricks(next.bricks)).toBe(0)
    expect(next.phase).toBe('won')
  })

  it('bounces from the paddle and steers with the hit position', () => {
    const state = {
      ...createBreakoutState(),
      phase: 'playing' as const,
      ball: { x: BREAKOUT_WIDTH / 2 + 25, y: PADDLE_Y - BALL_RADIUS - 1, vx: 0, vy: 4 },
    }
    const next = breakoutReducer(state, { type: 'tick' })
    expect(next.ball.vy).toBeLessThan(0)
    expect(next.ball.vx).toBeGreaterThan(0)
  })

  it('returns to a launch state after losing a life and resets cleanly', () => {
    const state = {
      ...createBreakoutState(),
      phase: 'playing' as const,
      score: 30,
      ball: { x: 200, y: BREAKOUT_HEIGHT - 1, vx: 0, vy: 10 },
    }
    const next = breakoutReducer(state, { type: 'tick' })
    expect(next.phase).toBe('ready')
    expect(next.lives).toBe(2)
    expect(next.score).toBe(30)
    expect(breakoutReducer(next, { type: 'restart' })).toEqual(createBreakoutState())
  })

  it('ends the game when the final life is lost', () => {
    const state = {
      ...createBreakoutState(),
      phase: 'playing' as const,
      lives: 1,
      ball: { x: 200, y: BREAKOUT_HEIGHT - 1, vx: 0, vy: 10 },
    }
    const next = breakoutReducer(state, { type: 'tick' })
    expect(next.phase).toBe('over')
    expect(next.lives).toBe(0)
  })
})
