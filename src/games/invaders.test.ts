import { describe, expect, it } from 'vitest'
import { createInvadersState, invadersReducer } from './invaders'

describe('Space Invaders', () => {
  it('starts with three ships and a full formation', () => {
    const state = createInvadersState()

    expect(state.phase).toBe('ready')
    expect(state.lives).toBe(3)
    expect(state.aliens.filter((alien) => alien.alive)).toHaveLength(32)
  })

  it('moves the ship within the field and allows only one player shot at a time', () => {
    const ready = createInvadersState()
    const left = invadersReducer(ready, { type: 'movePlayer', amount: -200 })
    const right = invadersReducer(left, { type: 'movePlayer', amount: 200 })
    const playing = invadersReducer(right, { type: 'start' })
    const fired = invadersReducer(playing, { type: 'shoot' })

    expect(left.playerX).toBe(4)
    expect(right.playerX).toBe(96)
    expect(fired.playerShots).toEqual([{ x: 96, y: 85 }])
    expect(invadersReducer(fired, { type: 'shoot' }).playerShots).toHaveLength(1)
  })

  it('scores a hit and finishes the wave when the last invader is cleared', () => {
    const initial = createInvadersState()
    const target = { ...initial.aliens[8]!, x: 50, y: 58, alive: true }
    const state = {
      ...initial,
      phase: 'playing' as const,
      aliens: initial.aliens.map((alien) => ({ ...alien, alive: false })).map((alien) => alien.id === target.id ? target : alien),
      playerShots: [{ x: 50, y: 64 }],
    }

    const next = invadersReducer(state, { type: 'tick' })

    expect(next.score).toBe(30)
    expect(next.phase).toBe('won')
    expect(next.aliens.every((alien) => !alien.alive)).toBe(true)
  })

  it('loses a ship when an enemy shot reaches the player', () => {
    const state = {
      ...createInvadersState(),
      phase: 'playing' as const,
      enemyShots: [{ x: 50, y: 85 }],
    }

    const next = invadersReducer(state, { type: 'tick' })

    expect(next.lives).toBe(2)
    expect(next.enemyShots).toHaveLength(0)
    expect(next.message).toBe('2 ships left.')
  })

  it('drops the formation when it reaches an edge and ends the run when it reaches the ship', () => {
    const nearEdge = {
      ...createInvadersState(),
      phase: 'playing' as const,
      tick: 2,
      aliens: createInvadersState().aliens.map((alien) => ({ ...alien, x: 95 })),
    }
    const dropped = invadersReducer(nearEdge, { type: 'tick' })

    expect(dropped.direction).toBe(-1)
    expect(dropped.aliens[0]?.y).toBe(18.5)

    const atShip = {
      ...nearEdge,
      aliens: nearEdge.aliens.map((alien) => ({ ...alien, x: 95, y: 82 })),
    }
    expect(invadersReducer(atShip, { type: 'tick' }).phase).toBe('over')
  })

  it('pauses time and resets a finished run', () => {
    const playing = invadersReducer(createInvadersState(), { type: 'start' })
    const paused = invadersReducer(playing, { type: 'pause' })

    expect(invadersReducer(paused, { type: 'tick' })).toBe(paused)
    expect(invadersReducer(paused, { type: 'resume' }).phase).toBe('playing')
    const restarted = invadersReducer({ ...playing, phase: 'over', score: 120, lives: 0 }, { type: 'restart' })
    expect(restarted).toEqual(createInvadersState())
  })
})
