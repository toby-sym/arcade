import { describe, expect, it } from 'vitest'
import {
  createMoonshotState,
  MOONSHOT_HOLES,
  moonshotHole,
  moonshotReducer,
  type MoonshotState,
} from './moonshot'

function atCup(state: MoonshotState, holeIndex = state.holeIndex): MoonshotState {
  const hole = MOONSHOT_HOLES[holeIndex]!
  return {
    ...state,
    phase: 'playing', holeIndex,
    ball: { x: hole.cup.x - 26, y: hole.cup.y, vx: 80, vy: 0 },
    ballMoving: true, stoppedMs: 0,
    strokes: state.strokes + 1,
    holeStrokes: Math.max(1, state.holeStrokes),
  }
}

function rollUntilSettled(state: MoonshotState): MoonshotState {
  let next = state
  for (let index = 0; index < 200 && next.ballMoving; index += 1) next = moonshotReducer(next, { type: 'tick', deltaMs: 25 })
  return next
}

describe('Moonshot Mini Golf', () => {
  it('starts the round, strokes toward a line, and moves the ball with rolling drag', () => {
    let state = createMoonshotState()
    expect(moonshotReducer(state, { type: 'shot', angle: -Math.PI / 2, power: 180 })).toBe(state)
    state = moonshotReducer(state, { type: 'start' })
    state = moonshotReducer(state, { type: 'shot', angle: -Math.PI / 2, power: 180 })
    expect(state.strokes).toBe(1)
    expect(state.ballMoving).toBe(true)
    state = moonshotReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.ball.y).toBeLessThan(MOONSHOT_HOLES[0]!.tee.y)
    expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeLessThan(180)
  })

  it('adjusts aim and clamps shot power to the playable range', () => {
    let state = moonshotReducer(createMoonshotState(), { type: 'start' })
    state = moonshotReducer(state, { type: 'aim', angleDelta: Math.PI / 6, powerDelta: 1000 })
    expect(state.aimAngle).not.toBe(Math.atan2(MOONSHOT_HOLES[0]!.cup.y - MOONSHOT_HOLES[0]!.tee.y, 0))
    expect(state.power).toBe(410)
    state = moonshotReducer(state, { type: 'aim', powerDelta: -1000 })
    expect(state.power).toBe(70)
  })

  it('banks away from a rail without passing through it', () => {
    let state = moonshotReducer(createMoonshotState(), { type: 'start' })
    const wall = MOONSHOT_HOLES[0]!.walls[0]!
    state = { ...state, ballMoving: true, ball: { x: 210, y: wall.y - 15, vx: 0, vy: 240 } }
    state = moonshotReducer(state, { type: 'tick', deltaMs: 50 })
    expect(state.ball.vy).toBeLessThan(0)
    expect(state.ball.y).toBeLessThan(wall.y)
  })

  it('lets a ball settle in a crater sooner than it settles on the flat', () => {
    const crater = MOONSHOT_HOLES[2]!.craters[0]!
    const state = { ...moonshotReducer(createMoonshotState(), { type: 'start' }), holeIndex: 2, ballMoving: true }
    const inCrater = rollUntilSettled({ ...state, ball: { x: crater.x, y: crater.y, vx: 180, vy: 0 } })
    const flat = rollUntilSettled({ ...state, ball: { x: 300, y: 100, vx: 180, vy: 0 } })
    expect(inCrater.ball.x - crater.x).toBeLessThan(flat.ball.x - 300)
    expect(inCrater.ballMoving).toBe(false)
  })

  it('captures a measured putt and rattles a fast shot from the cup', () => {
    let slow = atCup(moonshotReducer(createMoonshotState(), { type: 'start' }))
    for (let index = 0; index < 10 && slow.phase === 'playing'; index += 1) slow = moonshotReducer(slow, { type: 'tick', deltaMs: 25 })
    expect(slow.phase).toBe('holeComplete')
    expect(slow.completedHoles).toEqual([1])

    let fast = moonshotReducer(createMoonshotState(), { type: 'start' })
    const cup = moonshotHole(fast).cup
    fast = { ...fast, ballMoving: true, ball: { x: cup.x - 38, y: cup.y, vx: 360, vy: 0 } }
    fast = moonshotReducer(fast, { type: 'tick', deltaMs: 50 })
    expect(fast.phase).toBe('playing')
    expect(fast.ball.x).toBeLessThan(cup.x)
  })

  it('advances through all five holes and finishes with total strokes', () => {
    let state = moonshotReducer(createMoonshotState(), { type: 'start' })
    for (let holeIndex = 0; holeIndex < MOONSHOT_HOLES.length; holeIndex += 1) {
      state = atCup(state, holeIndex)
      for (let tick = 0; tick < 10 && state.phase === 'playing'; tick += 1) state = moonshotReducer(state, { type: 'tick', deltaMs: 25 })
      if (holeIndex < MOONSHOT_HOLES.length - 1) {
        expect(state.phase).toBe('holeComplete')
        state = moonshotReducer(state, { type: 'next-hole' })
        expect(state.holeIndex).toBe(holeIndex + 1)
        expect(state.holeStrokes).toBe(0)
      }
    }
    expect(state.phase).toBe('won')
    expect(state.completedHoles).toHaveLength(5)
    expect(state.strokes).toBe(5)
    expect(moonshotReducer(state, { type: 'next-hole' })).toBe(state)
  })

  it('adds a penalty when returning to the tee', () => {
    let state = moonshotReducer(createMoonshotState(), { type: 'start' })
    state = moonshotReducer(state, { type: 'shot', angle: 0, power: 140 })
    state = moonshotReducer(state, { type: 'reset-hole' })
    expect(state.strokes).toBe(2)
    expect(state.holeStrokes).toBe(2)
    expect(state.ball).toEqual({ ...MOONSHOT_HOLES[0]!.tee, vx: 0, vy: 0 })
  })

  it('pauses the ball in motion and restarts a fresh round', () => {
    let state = moonshotReducer(createMoonshotState(), { type: 'start' })
    state = moonshotReducer(state, { type: 'shot', angle: -Math.PI / 2, power: 180 })
    state = moonshotReducer(state, { type: 'pause' })
    const paused = moonshotReducer(state, { type: 'tick', deltaMs: 50 })
    expect(paused.ball).toEqual(state.ball)
    state = moonshotReducer(state, { type: 'resume' })
    expect(state.phase).toBe('playing')
    expect(moonshotReducer(state, { type: 'restart' })).toEqual(createMoonshotState())
  })
})
