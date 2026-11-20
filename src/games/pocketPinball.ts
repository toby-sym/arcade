export const PINBALL_WIDTH = 520
export const PINBALL_HEIGHT = 780
export const PINBALL_MAX_BALLS = 3
export const PINBALL_BALL_RADIUS = 9

export interface PinballPoint {
  x: number
  y: number
}

export interface PinballBall extends PinballPoint {
  vx: number
  vy: number
}

export interface PinballBumper extends PinballPoint {
  id: string
  radius: number
  points: number
}

export interface PinballFlipper {
  angle: number
  angularVelocity: number
}

export type PinballControl = 'left' | 'right'
export type PinballPhase = 'ready' | 'playing' | 'paused' | 'over'

export interface PocketPinballState {
  phase: PinballPhase
  ball: PinballBall
  ballInShooter: boolean
  controls: Record<PinballControl, boolean>
  leftFlipper: PinballFlipper
  rightFlipper: PinballFlipper
  ballsRemaining: number
  score: number
  targetMask: number
  elapsedMs: number
  nudgeCooldownMs: number
  message: string
}

export type PocketPinballAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'control'; control: PinballControl; pressed: boolean }
  | { type: 'launch' }
  | { type: 'nudge' }
  | { type: 'tick'; deltaMs: number }

export const PINBALL_BUMPERS: readonly PinballBumper[] = [
  { id: 'northwest', x: 145, y: 183, radius: 33, points: 100 },
  { id: 'northstar', x: 260, y: 144, radius: 39, points: 150 },
  { id: 'northeast', x: 375, y: 183, radius: 33, points: 100 },
  { id: 'west', x: 174, y: 334, radius: 29, points: 75 },
  { id: 'east', x: 346, y: 334, radius: 29, points: 75 },
]

export const PINBALL_TARGETS: readonly PinballPoint[] = [
  { x: 197, y: 265 },
  { x: 260, y: 245 },
  { x: 323, y: 265 },
]

export const PINBALL_SLINGS: readonly { start: PinballPoint; end: PinballPoint }[] = [
  { start: { x: 61, y: 497 }, end: { x: 142, y: 582 } },
  { start: { x: 459, y: 497 }, end: { x: 378, y: 582 } },
]

export const PINBALL_FLIPPER_LENGTH = 101

const GRAVITY = 720
const MAX_BALL_SPEED = 820
const SIDE_WALL = 39
const TOP_WALL = 34
const DRAIN_LINE = PINBALL_HEIGHT - 25
const LEFT_HINGE: PinballPoint = { x: 170, y: 655 }
const RIGHT_HINGE: PinballPoint = { x: 350, y: 655 }
const LEFT_REST_ANGLE = 0.35
const LEFT_UP_ANGLE = -0.57
const RIGHT_REST_ANGLE = Math.PI - 0.35
const RIGHT_UP_ANGLE = Math.PI + 0.57
const FLIPPER_SPEED = 10
const FLIPPER_RADIUS = 9
const BUMPER_RADIUS = 12
const NUDGE_COOLDOWN_MS = 900
const MAX_DELTA_MS = 50
const SUBSTEPS_PER_SECOND = 120

function emptyControls(): Record<PinballControl, boolean> {
  return { left: false, right: false }
}

export function createPocketPinballState(): PocketPinballState {
  return {
    phase: 'ready',
    ball: { x: 452, y: 701, vx: 0, vy: 0 },
    ballInShooter: true,
    controls: emptyControls(),
    leftFlipper: { angle: LEFT_REST_ANGLE, angularVelocity: 0 },
    rightFlipper: { angle: RIGHT_REST_ANGLE, angularVelocity: 0 },
    ballsRemaining: PINBALL_MAX_BALLS,
    score: 0,
    targetMask: 0,
    elapsedMs: 0,
    nudgeCooldownMs: 0,
    message: 'Three balls. Two flippers. Keep the silver ball in play and light every target.',
  }
}

export function pocketPinballReducer(state: PocketPinballState, action: PocketPinballAction): PocketPinballState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Ball in the shooter lane. Press Space or Launch ball.' } : state
    case 'pause':
      return state.phase === 'playing'
        ? { ...state, phase: 'paused', controls: emptyControls(), message: 'Table paused. Your ball and score are held.' }
        : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Table live. Keep those flippers moving.' } : state
    case 'restart':
      return createPocketPinballState()
    case 'control':
      if (state.phase !== 'playing' || state.controls[action.control] === action.pressed) return state
      return { ...state, controls: { ...state.controls, [action.control]: action.pressed } }
    case 'launch':
      if (state.phase !== 'playing' || !state.ballInShooter) return state
      return {
        ...state,
        ballInShooter: false,
        ball: { ...state.ball, vx: -175, vy: -455 },
        message: 'Shot away. The lit bumpers and three upper targets score points.',
      }
    case 'nudge':
      if (state.phase !== 'playing' || state.ballInShooter || state.nudgeCooldownMs > 0) return state
      return {
        ...state,
        ball: {
          ...state.ball,
          vx: clamp(state.ball.vx + (state.ball.x < PINBALL_WIDTH / 2 ? 115 : -115), -MAX_BALL_SPEED, MAX_BALL_SPEED),
          vy: Math.max(-MAX_BALL_SPEED, state.ball.vy - 265),
        },
        score: Math.max(0, state.score - 100),
        nudgeCooldownMs: NUDGE_COOLDOWN_MS,
        message: 'Nudge spent. The next one comes back after a short cooldown and costs 100 points.',
      }
    case 'tick':
      return advancePocketPinball(state, action.deltaMs)
  }
}

export function pocketPinballTime(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function advancePocketPinball(state: PocketPinballState, deltaMs: number): PocketPinballState {
  if (state.phase !== 'playing' || !Number.isFinite(deltaMs) || deltaMs <= 0) return state

  const dtMs = Math.min(deltaMs, MAX_DELTA_MS)
  const stepCount = Math.ceil(dtMs / 1000 * SUBSTEPS_PER_SECOND)
  const stepSeconds = dtMs / 1000 / stepCount
  let next: PocketPinballState = {
    ...state,
    elapsedMs: state.elapsedMs + dtMs,
    nudgeCooldownMs: Math.max(0, state.nudgeCooldownMs - dtMs),
  }

  for (let index = 0; index < stepCount && next.phase === 'playing'; index += 1) {
    next = advancePinballStep(next, stepSeconds)
  }
  return next
}

function advancePinballStep(state: PocketPinballState, dt: number): PocketPinballState {
  const leftFlipper = moveFlipper(state.leftFlipper, state.controls.left ? LEFT_UP_ANGLE : LEFT_REST_ANGLE, dt)
  const rightFlipper = moveFlipper(state.rightFlipper, state.controls.right ? RIGHT_UP_ANGLE : RIGHT_REST_ANGLE, dt)
  const movedFlippers = { ...state, leftFlipper, rightFlipper }
  if (state.ballInShooter) return movedFlippers

  let ball: PinballBall = {
    ...state.ball,
    vx: state.ball.vx,
    vy: Math.min(MAX_BALL_SPEED, state.ball.vy + GRAVITY * dt),
  }
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt
  let score = state.score
  let targetMask = state.targetMask
  let message = state.message

  if (ball.x - PINBALL_BALL_RADIUS < SIDE_WALL) {
    ball.x = SIDE_WALL + PINBALL_BALL_RADIUS
    ball.vx = Math.abs(ball.vx) * 0.84
  } else if (ball.x + PINBALL_BALL_RADIUS > PINBALL_WIDTH - SIDE_WALL) {
    ball.x = PINBALL_WIDTH - SIDE_WALL - PINBALL_BALL_RADIUS
    ball.vx = -Math.abs(ball.vx) * 0.84
  }
  if (ball.y - PINBALL_BALL_RADIUS < TOP_WALL) {
    ball.y = TOP_WALL + PINBALL_BALL_RADIUS
    ball.vy = Math.abs(ball.vy) * 0.8
  }

  if (ball.y > 420 && ball.x < 416 && ball.x > 365) {
    ball.x = 416 - PINBALL_BALL_RADIUS
    ball.vx = -Math.abs(ball.vx) * 0.82
  }

  for (const sling of PINBALL_SLINGS) {
    const collision = reflectFromSegment(ball, sling.start, sling.end, 8, 1.08)
    if (collision.hit) {
      ball = collision.ball
      if (collision.approaching) {
        score += 50
        message = 'Slingshot! The lower rails send the ball back upfield.'
      }
    }
  }

  for (const bumper of PINBALL_BUMPERS) {
    const collision = reflectFromCircle(ball, bumper, bumper.radius + BUMPER_RADIUS, 1.14)
    if (collision.hit) {
      ball = collision.ball
      if (collision.approaching) {
        score += bumper.points
        message = `${bumper.id === 'northstar' ? 'Northstar' : 'Pop'} bumper · ${bumper.points} points.`
      }
    }
  }

  for (let index = 0; index < PINBALL_TARGETS.length; index += 1) {
    const target = PINBALL_TARGETS[index]!
    const bit = 1 << index
    const collision = reflectFromCircle(ball, target, 12 + PINBALL_BALL_RADIUS, 1.04)
    if (collision.hit) {
      ball = collision.ball
      if (collision.approaching && (targetMask & bit) === 0) {
        targetMask |= bit
        score += 250
        message = targetMask === 0b111 ? 'All three upper targets are lit · 750 point sweep.' : `Target ${index + 1} lit · 250 points.`
      }
    }
  }

  for (const [flipper, hinge] of [[leftFlipper, LEFT_HINGE], [rightFlipper, RIGHT_HINGE]] as const) {
    const collision = reflectFromFlipper(ball, flipper, hinge)
    if (collision) {
      ball = collision.ball
      if (collision.approaching) message = 'Clean flipper return. Keep the silver ball moving.'
    }
  }

  ball = limitBallSpeed(ball)
  if (ball.y > DRAIN_LINE) {
    const ballsRemaining = state.ballsRemaining - 1
    if (ballsRemaining <= 0) {
      return {
        ...movedFlippers,
        ball,
        controls: emptyControls(),
        ballsRemaining: 0,
        score,
        targetMask,
        phase: 'over',
        message: `Table over · ${score} points in ${pocketPinballTime(state.elapsedMs)}.`,
      }
    }
    return {
      ...movedFlippers,
      ball: { x: 452, y: 701, vx: 0, vy: 0 },
      ballInShooter: true,
      controls: emptyControls(),
      ballsRemaining,
      score,
      targetMask,
      message: `Ball drained. ${ballsRemaining} ${ballsRemaining === 1 ? 'ball' : 'balls'} remain · press Space to launch.`,
    }
  }

  return { ...movedFlippers, ball, score, targetMask, message }
}

function moveFlipper(flipper: PinballFlipper, targetAngle: number, dt: number): PinballFlipper {
  const difference = targetAngle - flipper.angle
  const delta = clamp(difference, -FLIPPER_SPEED * dt, FLIPPER_SPEED * dt)
  return { angle: flipper.angle + delta, angularVelocity: delta / dt }
}

function reflectFromCircle(
  ball: PinballBall,
  circle: PinballPoint & { radius?: number },
  collisionRadius: number,
  restitution: number,
): { hit: boolean; approaching: boolean; ball: PinballBall } {
  const dx = ball.x - circle.x
  const dy = ball.y - circle.y
  const distance = Math.hypot(dx, dy)
  if (distance >= collisionRadius) return { hit: false, approaching: false, ball }
  const nx = distance > 0.001 ? dx / distance : 0
  const ny = distance > 0.001 ? dy / distance : -1
  const normalSpeed = ball.vx * nx + ball.vy * ny
  const approaching = normalSpeed < 0
  return {
    hit: true,
    approaching,
    ball: {
      ...ball,
      x: circle.x + nx * collisionRadius,
      y: circle.y + ny * collisionRadius,
      vx: approaching ? ball.vx - (1 + restitution) * normalSpeed * nx : ball.vx,
      vy: approaching ? ball.vy - (1 + restitution) * normalSpeed * ny : ball.vy,
    },
  }
}

function reflectFromSegment(
  ball: PinballBall,
  start: PinballPoint,
  end: PinballPoint,
  radius: number,
  restitution: number,
): { hit: boolean; approaching: boolean; ball: PinballBall } {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const ratio = clamp(((ball.x - start.x) * dx + (ball.y - start.y) * dy) / lengthSquared, 0, 1)
  return reflectFromCircle(ball, { x: start.x + dx * ratio, y: start.y + dy * ratio }, radius + PINBALL_BALL_RADIUS, restitution)
}

function reflectFromFlipper(
  ball: PinballBall,
  flipper: PinballFlipper,
  hinge: PinballPoint,
): { approaching: boolean; ball: PinballBall } | null {
  const tipX = hinge.x + Math.cos(flipper.angle) * PINBALL_FLIPPER_LENGTH
  const tipY = hinge.y + Math.sin(flipper.angle) * PINBALL_FLIPPER_LENGTH
  const dx = tipX - hinge.x
  const dy = tipY - hinge.y
  const lengthSquared = dx * dx + dy * dy
  const ratio = clamp(((ball.x - hinge.x) * dx + (ball.y - hinge.y) * dy) / lengthSquared, 0, 1)
  const pointX = hinge.x + dx * ratio
  const pointY = hinge.y + dy * ratio
  let nx = ball.x - pointX
  let ny = ball.y - pointY
  const distance = Math.hypot(nx, ny)
  const collisionRadius = PINBALL_BALL_RADIUS + FLIPPER_RADIUS
  if (distance >= collisionRadius) return null
  if (distance <= 0.001) {
    nx = 0
    ny = -1
  } else {
    nx /= distance
    ny /= distance
  }
  const contactRadius = ratio * PINBALL_FLIPPER_LENGTH
  const paddleVx = -Math.sin(flipper.angle) * flipper.angularVelocity * contactRadius
  const paddleVy = Math.cos(flipper.angle) * flipper.angularVelocity * contactRadius
  const relativeVx = ball.vx - paddleVx
  const relativeVy = ball.vy - paddleVy
  const normalSpeed = relativeVx * nx + relativeVy * ny
  const approaching = normalSpeed < 0
  let vx = ball.vx
  let vy = ball.vy
  if (approaching) {
    vx = relativeVx - (1.85 * normalSpeed * nx) + paddleVx
    vy = relativeVy - (1.85 * normalSpeed * ny) + paddleVy
    if (ratio > 0.35 && (flipper.angle < LEFT_REST_ANGLE - 0.1 || flipper.angle > RIGHT_REST_ANGLE + 0.1)) {
      vy = Math.min(vy, -300)
    }
  }
  return {
    approaching,
    ball: {
      ...ball,
      x: pointX + nx * collisionRadius,
      y: pointY + ny * collisionRadius,
      vx,
      vy,
    },
  }
}

function limitBallSpeed(ball: PinballBall): PinballBall {
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed <= MAX_BALL_SPEED) return ball
  const scale = MAX_BALL_SPEED / speed
  return { ...ball, vx: ball.vx * scale, vy: ball.vy * scale }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
