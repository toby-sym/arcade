export const RACK_RUN_WIDTH = 720
export const RACK_RUN_HEIGHT = 360
export const RACK_RUN_BALL_RADIUS = 11
export const RACK_RUN_POCKET_RADIUS = 22
export const RACK_RUN_COLORS = ['one', 'two', 'three'] as const

export type RackRunBallId = 'cue' | 'one' | 'two' | 'three' | 'eight'
export type RackRunPocketId = 'upper-left' | 'upper-middle' | 'upper-right' | 'lower-left' | 'lower-middle' | 'lower-right'
export type RackRunPhase = 'ready' | 'aiming' | 'rolling' | 'paused' | 'complete' | 'lost'

export interface RackRunPocket {
  id: RackRunPocketId
  label: string
  shortLabel: string
  x: number
  y: number
}

export interface RackRunBall {
  id: RackRunBallId
  number: number | null
  x: number
  y: number
  vx: number
  vy: number
  pocketed: boolean
  pocketedAt: RackRunPocketId | null
}

export interface RackRunState {
  phase: RackRunPhase
  resumePhase: 'aiming' | 'rolling' | null
  balls: RackRunBall[]
  shots: number
  fouls: number
  angle: number
  power: number
  calledPocket: RackRunPocketId | null
  shotFoul: boolean
  message: string
}

export const RACK_RUN_POCKETS: readonly RackRunPocket[] = [
  { id: 'upper-left', label: 'Upper-left pocket', shortLabel: 'UPPER LEFT', x: 36, y: 36 },
  { id: 'upper-middle', label: 'Upper-middle pocket', shortLabel: 'UPPER MIDDLE', x: 360, y: 36 },
  { id: 'upper-right', label: 'Upper-right pocket', shortLabel: 'UPPER RIGHT', x: 684, y: 36 },
  { id: 'lower-left', label: 'Lower-left pocket', shortLabel: 'LOWER LEFT', x: 36, y: 324 },
  { id: 'lower-middle', label: 'Lower-middle pocket', shortLabel: 'LOWER MIDDLE', x: 360, y: 324 },
  { id: 'lower-right', label: 'Lower-right pocket', shortLabel: 'LOWER RIGHT', x: 684, y: 324 },
]

const initialBalls: readonly RackRunBall[] = [
  { id: 'cue', number: null, x: 164, y: 180, vx: 0, vy: 0, pocketed: false, pocketedAt: null },
  { id: 'one', number: 1, x: 453, y: 160, vx: 0, vy: 0, pocketed: false, pocketedAt: null },
  { id: 'two', number: 2, x: 476, y: 180, vx: 0, vy: 0, pocketed: false, pocketedAt: null },
  { id: 'three', number: 3, x: 453, y: 200, vx: 0, vy: 0, pocketed: false, pocketedAt: null },
  { id: 'eight', number: 8, x: 499, y: 180, vx: 0, vy: 0, pocketed: false, pocketedAt: null },
]

const MIN_X = 48
const MAX_X = RACK_RUN_WIDTH - MIN_X
const MIN_Y = 48
const MAX_Y = RACK_RUN_HEIGHT - MIN_Y
const BALL_DIAMETER = RACK_RUN_BALL_RADIUS * 2
const CUSHION_RESTITUTION = 0.86
const BALL_RESTITUTION = 0.96
const FRICTION_PER_SECOND = 1.55
const STOP_SPEED = 4
const SUBSTEP_SECONDS = 1 / 120

export function createRackRunState(): RackRunState {
  return {
    phase: 'ready',
    resumePhase: null,
    balls: initialBalls.map((ball) => ({ ...ball })),
    shots: 0,
    fouls: 0,
    angle: 0,
    power: 55,
    calledPocket: null,
    shotFoul: false,
    message: 'Call a pocket, line up the cue, and clear the three colors before the eight.',
  }
}

export function startRackRun(_state: RackRunState): RackRunState {
  return { ...createRackRunState(), phase: 'aiming', message: 'Rack is open. Call the pocket for your first shot.' }
}

export function restartRackRun(_state: RackRunState): RackRunState {
  return createRackRunState()
}

export function callRackRunPocket(state: RackRunState, pocket: RackRunPocketId): RackRunState {
  if (state.phase !== 'aiming' || !RACK_RUN_POCKETS.some((item) => item.id === pocket)) return state
  return { ...state, calledPocket: pocket, message: `${pocketLabel(pocket)} called. Set your angle and power.` }
}

export function setRackRunAim(state: RackRunState, angle: number, power: number): RackRunState {
  if (state.phase !== 'aiming' || !Number.isFinite(angle) || !Number.isFinite(power)) return state
  return {
    ...state,
    angle: normalizeAngle(angle),
    power: clamp(power, 10, 100),
  }
}

export function rotateRackRunAim(state: RackRunState, delta: number): RackRunState {
  if (!Number.isFinite(delta)) return state
  return setRackRunAim(state, state.angle + delta, state.power)
}

export function adjustRackRunPower(state: RackRunState, delta: number): RackRunState {
  if (!Number.isFinite(delta)) return state
  return setRackRunAim(state, state.angle, state.power + delta)
}

export function shootRackRun(state: RackRunState): RackRunState {
  if (state.phase !== 'aiming' || state.calledPocket === null) return state
  const cue = state.balls.find((ball) => ball.id === 'cue')
  if (!cue || cue.pocketed) return state
  const speed = state.power * 6.2
  const balls = state.balls.map((ball) => ball.id === 'cue'
    ? { ...ball, vx: Math.cos(state.angle) * speed, vy: Math.sin(state.angle) * speed }
    : ball)
  return {
    ...state,
    phase: 'rolling',
    resumePhase: null,
    balls,
    shots: state.shots + 1,
    shotFoul: false,
    message: `Shot ${state.shots + 1}. The balls are moving.`,
  }
}

export function pauseRackRun(state: RackRunState): RackRunState {
  if (state.phase !== 'aiming' && state.phase !== 'rolling') return state
  return {
    ...state,
    phase: 'paused',
    resumePhase: state.phase,
    message: state.phase === 'rolling' ? 'Table paused. The balls hold their positions.' : 'Rack paused. Your aim and called pocket are held.',
  }
}

export function resumeRackRun(state: RackRunState): RackRunState {
  if (state.phase !== 'paused' || state.resumePhase === null) return state
  return {
    ...state,
    phase: state.resumePhase,
    resumePhase: null,
    message: state.resumePhase === 'rolling' ? 'Balls moving.' : 'Rack ready. Finish lining up your shot.',
  }
}

export function advanceRackRun(state: RackRunState, elapsedSeconds: number): RackRunState {
  if (state.phase !== 'rolling' || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return state
  const duration = Math.min(elapsedSeconds, 0.05)
  const substeps = Math.max(1, Math.ceil(duration / SUBSTEP_SECONDS))
  const step = duration / substeps
  const balls = state.balls.map((ball) => ({ ...ball }))
  let shotFoul = state.shotFoul
  for (let index = 0; index < substeps; index += 1) {
    for (const ball of balls) {
      if (ball.pocketed) continue
      ball.x += ball.vx * step
      ball.y += ball.vy * step
      const pocket = RACK_RUN_POCKETS.find((item) => Math.hypot(ball.x - item.x, ball.y - item.y) <= RACK_RUN_POCKET_RADIUS)
      if (pocket) {
        ball.pocketed = true
        ball.pocketedAt = pocket.id
        ball.vx = 0
        ball.vy = 0
        if (ball.id === 'cue') shotFoul = true
        else if (ball.id !== 'eight' && pocket.id !== state.calledPocket) shotFoul = true
        continue
      }
      if (ball.x < MIN_X) { ball.x = MIN_X; ball.vx = Math.abs(ball.vx) * CUSHION_RESTITUTION }
      else if (ball.x > MAX_X) { ball.x = MAX_X; ball.vx = -Math.abs(ball.vx) * CUSHION_RESTITUTION }
      if (ball.y < MIN_Y) { ball.y = MIN_Y; ball.vy = Math.abs(ball.vy) * CUSHION_RESTITUTION }
      else if (ball.y > MAX_Y) { ball.y = MAX_Y; ball.vy = -Math.abs(ball.vy) * CUSHION_RESTITUTION }
    }
    resolveBallCollisions(balls)
    const friction = Math.exp(-FRICTION_PER_SECOND * step)
    for (const ball of balls) {
      if (ball.pocketed) continue
      ball.vx *= friction
      ball.vy *= friction
      if (Math.hypot(ball.vx, ball.vy) < STOP_SPEED) { ball.vx = 0; ball.vy = 0 }
    }
  }

  const inMotion = balls.some((ball) => !ball.pocketed && Math.hypot(ball.vx, ball.vy) >= STOP_SPEED)
  if (inMotion) return { ...state, balls, shotFoul }

  for (const ball of balls) { ball.vx = 0; ball.vy = 0 }
  const eight = balls.find((ball) => ball.id === 'eight')!
  const colorsRemaining = balls.some((ball) => (RACK_RUN_COLORS as readonly string[]).includes(ball.id) && !ball.pocketed)
  if (eight.pocketed) {
    if (colorsRemaining || eight.pocketedAt !== state.calledPocket || shotFoul) {
      return { ...state, phase: 'lost', resumePhase: null, balls, shotFoul, message: 'The eight dropped too soon, into the wrong pocket, or after a scratch. Rack over.' }
    }
    const message = state.fouls === 0
      ? `Rack cleared in ${state.shots} shots. Your clean-rack best is saved in this browser.`
      : `Rack cleared in ${state.shots} shots with ${state.fouls} fouls. The clean-rack best is unchanged.`
    return { ...state, phase: 'complete', resumePhase: null, balls, shotFoul, message }
  }
  if (balls.find((ball) => ball.id === 'cue')!.pocketed) {
    const cue = balls.find((ball) => ball.id === 'cue')!
    cue.x = initialBalls[0]!.x
    cue.y = initialBalls[0]!.y
    cue.vx = 0
    cue.vy = 0
    cue.pocketed = false
    cue.pocketedAt = null
    return { ...state, phase: 'aiming', resumePhase: null, balls, fouls: state.fouls + 1, calledPocket: null, shotFoul: false, message: 'Cue scratch. One foul added; call a pocket for the next shot.' }
  }
  const foulMessage = shotFoul ? ' A called-pocket foul was added.' : ''
  const colorsDown = balls.filter((ball) => (RACK_RUN_COLORS as readonly string[]).includes(ball.id) && ball.pocketed).length
  const message = colorsRemaining
    ? `${colorsDown} of 3 colors are down.${foulMessage} Call the next pocket.`
    : `All three colors are down. Call a pocket for the eight ball.${foulMessage}`
  return { ...state, phase: 'aiming', resumePhase: null, balls, fouls: state.fouls + (shotFoul ? 1 : 0), calledPocket: null, shotFoul: false, message }
}

export function rackRunRemainingColors(state: RackRunState): number {
  return state.balls.filter((ball) => (RACK_RUN_COLORS as readonly string[]).includes(ball.id) && !ball.pocketed).length
}

function resolveBallCollisions(balls: RackRunBall[]): void {
  for (let first = 0; first < balls.length; first += 1) {
    const a = balls[first]!
    if (a.pocketed) continue
    for (let second = first + 1; second < balls.length; second += 1) {
      const b = balls[second]!
      if (b.pocketed) continue
      let dx = b.x - a.x
      let dy = b.y - a.y
      const distance = Math.hypot(dx, dy)
      if (distance >= BALL_DIAMETER) continue
      if (distance === 0) { dx = 1; dy = 0 }
      const safeDistance = distance || 1
      const nx = dx / safeDistance
      const ny = dy / safeDistance
      const overlap = BALL_DIAMETER - distance
      a.x -= nx * overlap / 2
      a.y -= ny * overlap / 2
      b.x += nx * overlap / 2
      b.y += ny * overlap / 2
      const relativeNormalSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (relativeNormalSpeed >= 0) continue
      const impulse = -(1 + BALL_RESTITUTION) * relativeNormalSpeed / 2
      a.vx -= impulse * nx
      a.vy -= impulse * ny
      b.vx += impulse * nx
      b.vy += impulse * ny
    }
  }
}

function normalizeAngle(angle: number): number {
  const fullTurn = Math.PI * 2
  return ((angle % fullTurn) + fullTurn) % fullTurn
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function pocketLabel(id: RackRunPocketId): string {
  return RACK_RUN_POCKETS.find((pocket) => pocket.id === id)!.label
}
