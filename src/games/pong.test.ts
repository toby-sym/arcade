import { describe, expect, it } from 'vitest'
import {
  PONG_BALL_RADIUS,
  PONG_HEIGHT,
  PONG_LEFT_X,
  PONG_PADDLE_HEIGHT,
  PONG_PADDLE_WIDTH,
  PONG_RIGHT_X,
  PONG_WIDTH,
  PONG_WIN_SCORE,
  createPongState,
  pongReducer,
} from './pong'

describe('Pong game rules', () => {
  it('clamps the player paddle and blocks movement while paused', () => {
    const state = createPongState()
    expect(pongReducer(state, { type: 'movePaddle', centerY: -100 }).paddleY).toBe(0)
    expect(pongReducer(state, { type: 'movePaddle', centerY: 900 }).paddleY).toBe(PONG_HEIGHT - PONG_PADDLE_HEIGHT)
    const paused = { ...state, phase: 'paused' as const }
    expect(pongReducer(paused, { type: 'movePaddle', centerY: 10 })).toBe(paused)
  })

  it('freezes the match while paused and resumes it', () => {
    const playing = pongReducer(createPongState(), { type: 'start' })
    const paused = pongReducer(playing, { type: 'pause' })
    expect(pongReducer(paused, { type: 'tick' })).toBe(paused)
    expect(pongReducer(paused, { type: 'resume' }).phase).toBe('playing')
  })

  it('returns the ball from the player paddle at an angle', () => {
    const state = {
      ...createPongState(),
      phase: 'playing' as const,
      ball: { x: PONG_LEFT_X + PONG_PADDLE_WIDTH + PONG_BALL_RADIUS + 1, y: 220, vx: -4, vy: 0 },
    }
    const next = pongReducer(state, { type: 'tick' })
    expect(next.ball.vx).toBeGreaterThan(0)
    expect(next.ball.vy).toBeGreaterThan(0)
  })

  it('returns the ball from the computer paddle', () => {
    const state = {
      ...createPongState(),
      phase: 'playing' as const,
      ball: { x: PONG_RIGHT_X - PONG_BALL_RADIUS - 1, y: PONG_HEIGHT / 2, vx: 4, vy: 0 },
    }
    const next = pongReducer(state, { type: 'tick' })
    expect(next.ball.vx).toBeLessThan(0)
    expect(next.opponentScore).toBe(0)
  })

  it('bounces from the top and awards the computer a missed return', () => {
    const nearWall = {
      ...createPongState(),
      phase: 'playing' as const,
      ball: { x: PONG_WIDTH / 2, y: PONG_BALL_RADIUS + 1, vx: 0, vy: -4 },
    }
    expect(pongReducer(nearWall, { type: 'tick' }).ball.vy).toBeGreaterThan(0)

    const missedByPlayer = {
      ...createPongState(),
      phase: 'playing' as const,
      score: 2,
      opponentScore: PONG_WIN_SCORE - 1,
      ball: { x: -PONG_BALL_RADIUS - 2, y: 200, vx: -4, vy: 0 },
    }
    const over = pongReducer(missedByPlayer, { type: 'tick' })
    expect(over.opponentScore).toBe(PONG_WIN_SCORE)
    expect(over.winner).toBe('opponent')
    expect(over.phase).toBe('over')
  })

  it('awards a point and serves toward the player who conceded', () => {
    const state = {
      ...createPongState(),
      phase: 'playing' as const,
      ball: { x: PONG_WIDTH + PONG_BALL_RADIUS - 2, y: 200, vx: 4, vy: 0 },
    }
    const next = pongReducer(state, { type: 'tick' })
    expect(next.score).toBe(1)
    expect(next.phase).toBe('ready')
    expect(next.ball.vx).toBeGreaterThan(0)
    expect(next.message).toContain('Point for you')
  })

  it('ends a match at five points and supports restart', () => {
    const state = {
      ...createPongState(),
      phase: 'playing' as const,
      score: PONG_WIN_SCORE - 1,
      ball: { x: PONG_WIDTH + PONG_BALL_RADIUS - 2, y: 200, vx: 4, vy: 0 },
    }
    const won = pongReducer(state, { type: 'tick' })
    expect(won.phase).toBe('over')
    expect(won.winner).toBe('player')
    expect(pongReducer(won, { type: 'restart' })).toEqual(createPongState())
  })
})
