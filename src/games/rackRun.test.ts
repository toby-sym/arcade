import { describe, expect, it } from 'vitest'
import {
  RACK_RUN_POCKETS,
  advanceRackRun,
  callRackRunPocket,
  createRackRunState,
  pauseRackRun,
  restartRackRun,
  resumeRackRun,
  rotateRackRunAim,
  setRackRunAim,
  shootRackRun,
  startRackRun,
  type RackRunState,
} from './rackRun'

function runUntilSettled(state: RackRunState): RackRunState {
  for (let step = 0; step < 900 && state.phase === 'rolling'; step += 1) state = advanceRackRun(state, 1 / 60)
  return state
}

describe('Rack Run pool table', () => {
  it('starts a five-ball rack with six clearly named pockets', () => {
    const state = createRackRunState()
    expect(state.phase).toBe('ready')
    expect(state.balls.map((ball) => ball.id)).toEqual(['cue', 'one', 'two', 'three', 'eight'])
    expect(RACK_RUN_POCKETS.map((pocket) => pocket.shortLabel)).toHaveLength(6)
  })

  it('requires a called pocket and clamps aim power before shooting', () => {
    const aiming = startRackRun(createRackRunState())
    expect(shootRackRun(aiming)).toBe(aiming)
    const called = callRackRunPocket(aiming, 'upper-middle')
    const setAim = setRackRunAim(called, Math.PI * 4, 140)
    expect(setAim.angle).toBe(0)
    expect(setAim.power).toBe(100)
    expect(shootRackRun(setAim)).toMatchObject({ phase: 'rolling', shots: 1, calledPocket: 'upper-middle' })
    expect(setRackRunAim(setAim, Number.NaN, 20)).toBe(setAim)
  })

  it('lets a drag-free player make a collision shot and lets balls settle', () => {
    const aiming = startRackRun(createRackRunState())
    const arranged: RackRunState = {
      ...aiming,
      balls: aiming.balls.map((ball) => ball.id === 'one'
        ? { ...ball, x: 240, y: 180 }
        : ball.id === 'two' || ball.id === 'three' || ball.id === 'eight'
          ? { ...ball, x: 570, y: ball.id === 'two' ? 250 : ball.id === 'three' ? 280 : 310 }
          : ball),
    }
    let state = shootRackRun(setRackRunAim(callRackRunPocket(arranged, 'lower-left'), 0, 60))
    state = runUntilSettled(state)
    expect(state.phase).toBe('aiming')
    expect(state.shots).toBe(1)
    expect(state.balls.find((ball) => ball.id === 'one')?.pocketed).toBe(false)
    expect(state.message).toContain('Call the next pocket')
  })

  it('sinks a called color into its pocket while preserving the remaining rack', () => {
    const aiming = startRackRun(createRackRunState())
    const calledPocket = 'upper-middle'
    const arranged: RackRunState = {
      ...aiming,
      balls: aiming.balls.map((ball) => ball.id === 'one'
        ? { ...ball, x: 240, y: 124 }
        : ball.id === 'two' || ball.id === 'three' || ball.id === 'eight'
          ? { ...ball, x: 590, y: ball.id === 'two' ? 230 : ball.id === 'three' ? 260 : 290 }
          : ball),
    }
    const angle = Math.atan2(36 - 180, 360 - 164)
    const shot = shootRackRun(setRackRunAim(callRackRunPocket(arranged, calledPocket), angle, 100))
    const state = runUntilSettled(shot)
    expect(state.phase).toBe('aiming')
    expect(state.balls.find((ball) => ball.id === 'one')).toMatchObject({ pocketed: true, pocketedAt: calledPocket })
    expect(state.fouls).toBe(0)
    expect(state.message).toContain('1 of 3 colors are down')
  })

  it('returns a scratched cue ball to the kitchen and counts one foul', () => {
    const aiming = startRackRun(createRackRunState())
    const arranged: RackRunState = {
      ...aiming,
      balls: aiming.balls.map((ball) => ball.id === 'cue'
        ? { ...ball, x: 72, y: 72 }
        : { ...ball, x: 580, y: ball.id === 'one' ? 110 : ball.id === 'two' ? 180 : ball.id === 'three' ? 250 : 300 }),
    }
    const angle = Math.atan2(36 - 72, 36 - 72)
    const shot = shootRackRun(setRackRunAim(callRackRunPocket(arranged, 'upper-left'), angle, 65))
    const state = runUntilSettled(shot)
    expect(state.phase).toBe('aiming')
    expect(state.fouls).toBe(1)
    expect(state.calledPocket).toBeNull()
    expect(state.balls.find((ball) => ball.id === 'cue')).toMatchObject({ x: 164, y: 180, pocketed: false })
  })

  it('ends the rack when the eight is pocketed before the colors are down', () => {
    const aiming = startRackRun(createRackRunState())
    const arranged: RackRunState = {
      ...aiming,
      balls: aiming.balls.map((ball) => ball.id === 'eight' ? { ...ball, x: 360, y: 62, vx: 0, vy: -100 } : ball),
    }
    const shot = shootRackRun(callRackRunPocket(arranged, 'upper-middle'))
    expect(runUntilSettled(shot).phase).toBe('lost')
  })

  it('clears a clean rack only after the final called eight ball drops', () => {
    const aiming = startRackRun(createRackRunState())
    const arranged: RackRunState = {
      ...aiming,
      balls: aiming.balls.map((ball) => ball.id === 'eight'
        ? { ...ball, x: 360, y: 62, vx: 0, vy: -100 }
        : ball.id === 'one' || ball.id === 'two' || ball.id === 'three'
          ? { ...ball, pocketed: true, pocketedAt: 'lower-left' }
          : ball),
    }
    const shot = shootRackRun(callRackRunPocket(arranged, 'upper-middle'))
    const state = runUntilSettled(shot)
    expect(state.phase).toBe('complete')
    expect(state.shots).toBe(1)
    expect(state.message).toContain('clean-rack best is saved')
  })

  it('pauses a moving table without advancing it and resets the full rack', () => {
    const aiming = callRackRunPocket(startRackRun(createRackRunState()), 'lower-middle')
    const shot = shootRackRun(aiming)
    const paused = pauseRackRun(shot)
    expect(paused).toMatchObject({ phase: 'paused', resumePhase: 'rolling' })
    expect(advanceRackRun(paused, 1).balls).toEqual(paused.balls)
    expect(resumeRackRun(paused).phase).toBe('rolling')
    expect(restartRackRun(paused)).toMatchObject({ phase: 'ready', shots: 0, fouls: 0, calledPocket: null })
  })

  it('rotates and clamps touch or keyboard aim controls only while aiming', () => {
    const aiming = startRackRun(createRackRunState())
    expect(rotateRackRunAim(aiming, Math.PI / 2).angle).toBeCloseTo(Math.PI / 2)
    expect(rotateRackRunAim(aiming, Number.POSITIVE_INFINITY)).toBe(aiming)
    expect(setRackRunAim(aiming, 0, 1).power).toBe(10)
    expect(setRackRunAim(shootRackRun(callRackRunPocket(aiming, 'lower-left')), 0, 50)).toMatchObject({ phase: 'rolling' })
  })
})
