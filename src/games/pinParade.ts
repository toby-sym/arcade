export const PIN_PARADE_LANE_WIDTH = 400
export const PIN_PARADE_LANE_HEIGHT = 720
export const PIN_PARADE_PIN_RADIUS = 8
export const PIN_PARADE_BALL_RADIUS = 11
export const PIN_PARADE_FRAME_COUNT = 10

export type PinParadePhase = 'ready' | 'aiming' | 'rolling' | 'result' | 'paused' | 'complete'

export interface PinParadePin {
  number: number
  x: number
  y: number
  vx: number
  vy: number
  upright: boolean
}

export interface PinParadeBall {
  x: number
  y: number
  vx: number
  vy: number
}

export interface PinParadeFrameScore {
  rolls: number[]
  score: number | null
  cumulative: number | null
}

export interface PinParadeState {
  phase: PinParadePhase
  resumePhase: 'aiming' | 'rolling' | null
  frameIndex: number
  frames: number[][]
  pins: PinParadePin[]
  ball: PinParadeBall | null
  standingAtRollStart: number | null
  aimDegrees: number
  power: number
  spin: number
  pinsKnocked: number | null
  message: string
}

const PIN_LAYOUT: readonly Pick<PinParadePin, 'number' | 'x' | 'y'>[] = [
  { number: 1, x: 200, y: 233 },
  { number: 2, x: 189, y: 214 }, { number: 3, x: 211, y: 214 },
  { number: 4, x: 178, y: 195 }, { number: 5, x: 200, y: 195 }, { number: 6, x: 222, y: 195 },
  { number: 7, x: 167, y: 176 }, { number: 8, x: 189, y: 176 }, { number: 9, x: 211, y: 176 }, { number: 10, x: 233, y: 176 },
]

const BALL_START = { x: 200, y: 652 }
const LANE_LEFT = 45
const LANE_RIGHT = PIN_PARADE_LANE_WIDTH - LANE_LEFT
const PIN_GUTTER_LEFT = 115
const PIN_GUTTER_RIGHT = PIN_PARADE_LANE_WIDTH - PIN_GUTTER_LEFT
const PIN_DIAMETER = PIN_PARADE_PIN_RADIUS * 2
const BALL_DIAMETER = PIN_PARADE_BALL_RADIUS + PIN_PARADE_PIN_RADIUS
const BALL_MASS = 2.2
const PIN_MASS = 1
const BALL_RESTITUTION = 0.83
const PIN_RESTITUTION = 0.72
const BALL_ROLL_RESISTANCE = 0.13
const PIN_RESISTANCE = 3.8
const STOP_SPEED = 14
const SUBSTEP_SECONDS = 1 / 120

export function createPinParadeState(): PinParadeState {
  return {
    phase: 'ready',
    resumePhase: null,
    frameIndex: 0,
    frames: Array.from({ length: PIN_PARADE_FRAME_COUNT }, () => []),
    pins: rackPins(),
    ball: null,
    standingAtRollStart: null,
    aimDegrees: 0,
    power: 65,
    spin: 0,
    pinsKnocked: null,
    message: 'Set your line, power, and spin. Bowl ten frames for a high score.',
  }
}

export function startPinParade(_state: PinParadeState): PinParadeState {
  return { ...createPinParadeState(), phase: 'aiming', message: 'Frame 1 is up. Set your line and roll when ready.' }
}

export function restartPinParade(_state: PinParadeState): PinParadeState {
  return createPinParadeState()
}

export function setPinParadeControls(state: PinParadeState, aimDegrees: number, power: number, spin: number): PinParadeState {
  if (state.phase !== 'aiming' || !Number.isFinite(aimDegrees) || !Number.isFinite(power) || !Number.isFinite(spin)) return state
  return {
    ...state,
    aimDegrees: clamp(aimDegrees, -18, 18),
    power: clamp(power, 35, 100),
    spin: clamp(spin, -100, 100),
  }
}

export function adjustPinParadeAim(state: PinParadeState, delta: number): PinParadeState {
  return Number.isFinite(delta) ? setPinParadeControls(state, state.aimDegrees + delta, state.power, state.spin) : state
}

export function adjustPinParadePower(state: PinParadeState, delta: number): PinParadeState {
  return Number.isFinite(delta) ? setPinParadeControls(state, state.aimDegrees, state.power + delta, state.spin) : state
}

export function adjustPinParadeSpin(state: PinParadeState, delta: number): PinParadeState {
  return Number.isFinite(delta) ? setPinParadeControls(state, state.aimDegrees, state.power, state.spin + delta) : state
}

export function launchPinParadeBall(state: PinParadeState): PinParadeState {
  if (state.phase !== 'aiming') return state
  const angle = state.aimDegrees * Math.PI / 180
  const speed = 420 + state.power * 6.2
  return {
    ...state,
    phase: 'rolling',
    resumePhase: null,
    pinsKnocked: null,
    ball: { ...BALL_START, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed },
    standingAtRollStart: state.pins.filter((pin) => pin.upright).length,
    message: `Frame ${state.frameIndex + 1}. The ball is rolling.`,
  }
}

export function pausePinParade(state: PinParadeState): PinParadeState {
  if (state.phase !== 'aiming' && state.phase !== 'rolling') return state
  return {
    ...state,
    phase: 'paused',
    resumePhase: state.phase,
    message: state.phase === 'rolling' ? 'Lane paused. The ball and pins hold their positions.' : 'Game paused. Your line and controls are held.',
  }
}

export function resumePinParade(state: PinParadeState): PinParadeState {
  if (state.phase !== 'paused' || state.resumePhase === null) return state
  return {
    ...state,
    phase: state.resumePhase,
    resumePhase: null,
    message: state.resumePhase === 'rolling' ? 'The ball is rolling.' : `Frame ${state.frameIndex + 1}. Set your next line.`,
  }
}

export function nextPinParadeRoll(state: PinParadeState): PinParadeState {
  if (state.phase !== 'result') return state
  return {
    ...state,
    phase: 'aiming',
    pinsKnocked: null,
    ball: null,
    message: `Frame ${state.frameIndex + 1}. Set your next line.`,
  }
}

export function advancePinParade(state: PinParadeState, elapsedSeconds: number): PinParadeState {
  if (state.phase !== 'rolling' || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return state
  const duration = Math.min(elapsedSeconds, 0.05)
  const substeps = Math.max(1, Math.ceil(duration / SUBSTEP_SECONDS))
  const step = duration / substeps
  let ball: PinParadeBall | null = state.ball ? { ...state.ball } : null
  const pins = state.pins.map((pin) => ({ ...pin }))

  for (let index = 0; index < substeps; index += 1) {
    if (ball) {
      ball.vx += state.spin * .8 * step
      ball.x += ball.vx * step
      ball.y += ball.vy * step
      if (ball.x < LANE_LEFT + PIN_PARADE_BALL_RADIUS) { ball.x = LANE_LEFT + PIN_PARADE_BALL_RADIUS; ball.vx = Math.abs(ball.vx) * .64 }
      else if (ball.x > LANE_RIGHT - PIN_PARADE_BALL_RADIUS) { ball.x = LANE_RIGHT - PIN_PARADE_BALL_RADIUS; ball.vx = -Math.abs(ball.vx) * .64 }
      if (ball.y <= 62 || Math.hypot(ball.vx, ball.vy) < STOP_SPEED) ball = null
    }

    for (const pin of pins) {
      pin.x += pin.vx * step
      pin.y += pin.vy * step
      if (pin.x < PIN_GUTTER_LEFT || pin.x > PIN_GUTTER_RIGHT) pin.upright = false
      if (Math.hypot(pin.vx, pin.vy) > 54) pin.upright = false
      const resistance = Math.exp(-PIN_RESISTANCE * step)
      pin.vx *= resistance
      pin.vy *= resistance
      if (Math.hypot(pin.vx, pin.vy) < STOP_SPEED) { pin.vx = 0; pin.vy = 0 }
    }

    if (ball) resolveBallPinCollision(ball, pins)
    resolvePinCollisions(pins)
  }

  const pinsMoving = pins.some((pin) => Math.hypot(pin.vx, pin.vy) >= STOP_SPEED)
  const ballMoving = ball !== null && Math.hypot(ball.vx, ball.vy) >= STOP_SPEED
  if (pinsMoving || ballMoving) return { ...state, ball, pins }

  const uprightCount = pins.filter((pin) => pin.upright).length
  const knocked = (state.standingAtRollStart ?? state.pins.filter((pin) => pin.upright).length) - uprightCount
  return settleRoll(state, rackPins(pins.filter((pin) => pin.upright).map((pin) => pin.number)), knocked)
}

export function scorePinParade(frames: readonly (readonly number[])[]): { frames: PinParadeFrameScore[]; total: number } {
  const rolls = frames.flatMap((frame) => [...frame])
  const scores: PinParadeFrameScore[] = Array.from({ length: PIN_PARADE_FRAME_COUNT }, (_, index) => ({ rolls: [...(frames[index] ?? [])], score: null, cumulative: null }))
  let cursor = 0
  let cumulative = 0
  for (let frame = 0; frame < PIN_PARADE_FRAME_COUNT - 1; frame += 1) {
    const first = rolls[cursor]
    if (first === undefined) break
    let score: number
    if (first === 10) {
      const bonusOne = rolls[cursor + 1]
      const bonusTwo = rolls[cursor + 2]
      if (bonusOne === undefined || bonusTwo === undefined) break
      score = 10 + bonusOne + bonusTwo
      cursor += 1
    } else {
      const second = rolls[cursor + 1]
      if (second === undefined) break
      if (first + second === 10) {
        const bonus = rolls[cursor + 2]
        if (bonus === undefined) break
        score = 10 + bonus
      } else score = first + second
      cursor += 2
    }
    cumulative += score
    scores[frame] = { ...scores[frame]!, score, cumulative }
  }
  const tenth = frames[PIN_PARADE_FRAME_COUNT - 1] ?? []
  if (tenth.length > 0) {
    const score = tenth.reduce((sum, pins) => sum + pins, 0)
    cumulative += score
    scores[PIN_PARADE_FRAME_COUNT - 1] = { rolls: [...tenth], score: tenth.length === 3 || (tenth.length === 2 && tenth[0]! + tenth[1]! < 10) ? score : null, cumulative: tenth.length === 3 || (tenth.length === 2 && tenth[0]! + tenth[1]! < 10) ? cumulative : null }
  }
  return { frames: scores, total: cumulative }
}

export function pinParadeNextRollLabel(state: PinParadeState): string {
  if (state.phase !== 'result') return 'Next roll'
  const rolls = state.frames[state.frameIndex]!
  if (state.frameIndex === PIN_PARADE_FRAME_COUNT - 1) {
    if (rolls.length < 3 && (rolls.length === 1 && rolls[0] === 10 || rolls.length === 2 && (rolls[0] === 10 || rolls[0]! + rolls[1]! === 10))) return 'Bonus roll'
    if (rolls.length === 1 && rolls[0] !== 10) return 'Second ball'
  }
  if (rolls.length === 1 && rolls[0] !== 10) return 'Second ball'
  return 'Next frame'
}

function settleRoll(state: PinParadeState, remainingPins: PinParadePin[], knocked: number): PinParadeState {
  const frames = state.frames.map((frame) => [...frame])
  const rolls = frames[state.frameIndex]!
  rolls.push(knocked)
  const tenth = state.frameIndex === PIN_PARADE_FRAME_COUNT - 1
  const firstRoll = rolls.length === 1
  const strike = firstRoll && knocked === 10
  const frameClosed = !tenth && (strike || rolls.length === 2)
  let frameIndex = state.frameIndex
  let complete = false
  let pins: PinParadePin[]

  if (!tenth) {
    const frameOver = strike || rolls.length === 2
    if (frameOver) {
      frameIndex += 1
      pins = rackPins()
    } else pins = remainingPins
  } else if (firstRoll) {
    pins = strike ? rackPins() : remainingPins
  } else if (rolls.length === 2) {
    const spare = rolls[0]! + rolls[1]! === 10
    const earnedBonus = rolls[0] === 10 || spare
    if (earnedBonus) pins = rolls[0] !== 10 || rolls[1] === 10 ? rackPins() : remainingPins
    else { pins = remainingPins; complete = true }
  } else {
    pins = remainingPins
    complete = true
  }

  const phase: PinParadePhase = complete ? 'complete' : 'result'
  const result = strike ? 'Strike!' : rolls.length === 2 && rolls[0]! + rolls[1]! === 10 ? 'Spare!' : `${knocked} pin${knocked === 1 ? '' : 's'} down.`
  return {
    ...state,
    phase,
    resumePhase: null,
    frames,
    frameIndex,
    pins,
    ball: null,
    standingAtRollStart: null,
    pinsKnocked: knocked,
    message: complete
      ? `Ten frames complete. ${scorePinParade(frames).total} points. Your local high score stays in this browser.`
      : tenth && rolls.length < 3
        ? `${result} Take your bonus ball.`
        : frameClosed
          ? `${result} Frame ${state.frameIndex + 1} complete. Frame ${frameIndex + 1} is up.`
          : `${result} Frame ${state.frameIndex + 1} is ready for the second ball.`,
  }
}

function rackPins(standingNumbers?: readonly number[]): PinParadePin[] {
  const standing = standingNumbers ? new Set(standingNumbers) : null
  return PIN_LAYOUT.filter((pin) => !standing || standing.has(pin.number)).map((pin) => ({ ...pin, vx: 0, vy: 0, upright: true }))
}

function resolveBallPinCollision(ball: PinParadeBall, pins: PinParadePin[]): void {
  for (const pin of pins) {
    if (!pin.upright) continue
    let dx = pin.x - ball.x
    let dy = pin.y - ball.y
    const distance = Math.hypot(dx, dy)
    if (distance >= BALL_DIAMETER) continue
    if (distance === 0) { dx = 0; dy = -1 }
    const safeDistance = distance || 1
    const nx = dx / safeDistance
    const ny = dy / safeDistance
    const overlap = BALL_DIAMETER - distance
    ball.x -= nx * overlap * .2
    ball.y -= ny * overlap * .2
    pin.x += nx * overlap * .8
    pin.y += ny * overlap * .8
    const relativeNormalSpeed = (pin.vx - ball.vx) * nx + (pin.vy - ball.vy) * ny
    if (relativeNormalSpeed >= 0) continue
    const impulse = -(1 + BALL_RESTITUTION) * relativeNormalSpeed / (1 / BALL_MASS + 1 / PIN_MASS)
    ball.vx -= impulse / BALL_MASS * nx
    ball.vy -= impulse / BALL_MASS * ny
    pin.vx += impulse / PIN_MASS * nx
    pin.vy += impulse / PIN_MASS * ny
  }
  ball.vx *= Math.exp(-BALL_ROLL_RESISTANCE / 120)
  ball.vy *= Math.exp(-BALL_ROLL_RESISTANCE / 120)
}

function resolvePinCollisions(pins: PinParadePin[]): void {
  for (let first = 0; first < pins.length; first += 1) {
    const a = pins[first]!
    if (!a.upright) continue
    for (let second = first + 1; second < pins.length; second += 1) {
      const b = pins[second]!
      if (!b.upright) continue
      let dx = b.x - a.x
      let dy = b.y - a.y
      const distance = Math.hypot(dx, dy)
      if (distance >= PIN_DIAMETER) continue
      if (distance === 0) { dx = 1; dy = 0 }
      const safeDistance = distance || 1
      const nx = dx / safeDistance
      const ny = dy / safeDistance
      const overlap = PIN_DIAMETER - distance
      a.x -= nx * overlap / 2
      a.y -= ny * overlap / 2
      b.x += nx * overlap / 2
      b.y += ny * overlap / 2
      const relativeNormalSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (relativeNormalSpeed >= 0) continue
      const impulse = -(1 + PIN_RESTITUTION) * relativeNormalSpeed / 2
      a.vx -= impulse * nx
      a.vy -= impulse * ny
      b.vx += impulse * nx
      b.vy += impulse * ny
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
