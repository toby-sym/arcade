import { describe, expect, it } from 'vitest'
import {
  BOARD_SIZE,
  createSnakeState,
  snakeReducer,
  stepSnake,
  turnSnake,
} from './snake'

describe('Snake game rules', () => {
  it('starts with a three-segment snake inside the field and food on an open cell', () => {
    const state = createSnakeState(0)

    expect(state.snake).toHaveLength(3)
    expect(state.snake[0]).toEqual({ x: 9, y: 9 })
    expect(state.food).not.toBeNull()
    expect(state.snake).not.toContainEqual(state.food)
    expect(state.status).toBe('ready')
  })

  it('does not allow an immediate reversal, but queues a legal turn', () => {
    const playing = { ...createSnakeState(0), status: 'playing' as const }

    expect(turnSnake(playing, 'left')).toBe(playing)
    expect(turnSnake(playing, 'up').nextDirection).toBe('up')
  })

  it('moves one cell and clears the queued direction after a step', () => {
    const playing = {
      ...createSnakeState(0),
      status: 'playing' as const,
      nextDirection: 'down' as const,
    }

    const next = stepSnake(playing, 0)

    expect(next.snake[0]).toEqual({ x: 9, y: 10 })
    expect(next.snake).toHaveLength(3)
    expect(next.direction).toBe('down')
    expect(next.nextDirection).toBeNull()
  })

  it('grows and scores when the head reaches food', () => {
    const playing = {
      ...createSnakeState(0),
      status: 'playing' as const,
      food: { x: 10, y: 9 },
    }

    const next = stepSnake(playing, 0.5)

    expect(next.snake).toHaveLength(4)
    expect(next.snake[0]).toEqual({ x: 10, y: 9 })
    expect(next.score).toBe(1)
    expect(next.food).not.toBeNull()
    expect(next.snake).not.toContainEqual(next.food)
  })

  it('ends the run when the snake hits a wall', () => {
    const playing = {
      ...createSnakeState(0),
      status: 'playing' as const,
      snake: [{ x: BOARD_SIZE - 1, y: 4 }, { x: BOARD_SIZE - 2, y: 4 }],
      direction: 'right' as const,
      food: { x: 0, y: 0 },
    }

    expect(stepSnake(playing, 0).status).toBe('over')
  })

  it('allows the head to move into the cell vacated by the tail', () => {
    const playing = {
      ...createSnakeState(0),
      status: 'playing' as const,
      snake: [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 }],
      direction: 'left' as const,
      food: { x: 12, y: 12 },
    }

    const next = stepSnake(playing, 0)

    expect(next.status).toBe('playing')
    expect(next.snake[0]).toEqual({ x: 1, y: 2 })
  })

  it('toggles pause and creates a fresh run on restart', () => {
    const ready = createSnakeState(0)
    const playing = snakeReducer(ready, { type: 'start' })
    const paused = snakeReducer(playing, { type: 'pause' })
    const resumed = snakeReducer(paused, { type: 'pause' })
    const restarted = snakeReducer(resumed, { type: 'restart', foodRoll: 0.5 })

    expect(paused.status).toBe('paused')
    expect(resumed.status).toBe('playing')
    expect(restarted.status).toBe('ready')
    expect(restarted.score).toBe(0)
    expect(restarted.snake).toHaveLength(3)
  })
})
