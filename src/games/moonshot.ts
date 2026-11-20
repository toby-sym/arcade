export const MOONSHOT_WIDTH = 640
export const MOONSHOT_HEIGHT = 780
export const MOONSHOT_HOLE_COUNT = 5
export const MOONSHOT_MIN_POWER = 70
export const MOONSHOT_MAX_POWER = 410
export const MOONSHOT_BALL_RADIUS = 9

export interface MoonshotPoint {
  x: number
  y: number
}

export interface MoonshotWall {
  x: number
  y: number
  width: number
  height: number
}

export interface MoonshotObstacle extends MoonshotPoint {
  radius: number
}

export interface MoonshotHole {
  name: string
  par: number
  tee: MoonshotPoint
  cup: MoonshotPoint
  walls: MoonshotWall[]
  bumpers: MoonshotObstacle[]
  craters: MoonshotObstacle[]
}

export const MOONSHOT_HOLES: MoonshotHole[] = [
  {
    name: 'Sidewinder', par: 3, tee: { x: 320, y: 690 }, cup: { x: 320, y: 102 },
    walls: [
      { x: 60, y: 515, width: 350, height: 18 },
      { x: 228, y: 335, width: 352, height: 18 },
      { x: 60, y: 164, width: 350, height: 18 },
    ],
    bumpers: [{ x: 315, y: 435, radius: 26 }],
    craters: [{ x: 485, y: 590, radius: 48 }, { x: 162, y: 250, radius: 42 }],
  },
  {
    name: 'Twin Moons', par: 3, tee: { x: 112, y: 690 }, cup: { x: 525, y: 100 },
    walls: [
      { x: 164, y: 495, width: 416, height: 18 },
      { x: 62, y: 294, width: 370, height: 18 },
      { x: 255, y: 135, width: 325, height: 18 },
    ],
    bumpers: [{ x: 360, y: 610, radius: 29 }, { x: 206, y: 383, radius: 25 }, { x: 468, y: 218, radius: 26 }],
    craters: [{ x: 113, y: 390, radius: 44 }, { x: 411, y: 420, radius: 48 }],
  },
  {
    name: 'Cold Crater', par: 4, tee: { x: 522, y: 690 }, cup: { x: 118, y: 102 },
    walls: [
      { x: 62, y: 535, width: 390, height: 18 },
      { x: 212, y: 362, width: 368, height: 18 },
      { x: 62, y: 194, width: 378, height: 18 },
    ],
    bumpers: [{ x: 484, y: 448, radius: 28 }, { x: 176, y: 279, radius: 24 }],
    craters: [{ x: 355, y: 620, radius: 66 }, { x: 140, y: 455, radius: 62 }, { x: 475, y: 276, radius: 60 }],
  },
  {
    name: 'Switchback', par: 4, tee: { x: 318, y: 690 }, cup: { x: 318, y: 102 },
    walls: [
      { x: 195, y: 540, width: 385, height: 18 },
      { x: 62, y: 374, width: 382, height: 18 },
      { x: 195, y: 218, width: 385, height: 18 },
    ],
    bumpers: [{ x: 160, y: 603, radius: 27 }, { x: 492, y: 453, radius: 27 }, { x: 151, y: 294, radius: 27 }],
    craters: [{ x: 330, y: 467, radius: 53 }, { x: 333, y: 143, radius: 36 }],
  },
  {
    name: 'Eclipse Basin', par: 4, tee: { x: 112, y: 686 }, cup: { x: 528, y: 104 },
    walls: [
      { x: 62, y: 512, width: 352, height: 18 },
      { x: 226, y: 328, width: 354, height: 18 },
      { x: 62, y: 156, width: 350, height: 18 },
      { x: 285, y: 438, width: 18, height: 82 },
    ],
    bumpers: [{ x: 320, y: 575, radius: 34 }, { x: 320, y: 389, radius: 42 }, { x: 324, y: 230, radius: 32 }],
    craters: [{ x: 166, y: 390, radius: 50 }, { x: 492, y: 590, radius: 48 }, { x: 467, y: 235, radius: 45 }],
  },
]

export type MoonshotPhase = 'ready' | 'playing' | 'paused' | 'holeComplete' | 'won'

export interface MoonshotState {
  phase: MoonshotPhase
  holeIndex: number
  ball: MoonshotPoint & { vx: number; vy: number }
  ballMoving: boolean
  stoppedMs: number
  aimAngle: number
  power: number
  strokes: number
  holeStrokes: number
  completedHoles: number[]
  message: string
}

export type MoonshotAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'next-hole' }
  | { type: 'reset-hole' }
  | { type: 'aim'; angleDelta?: number; powerDelta?: number }
  | { type: 'set-aim'; angle: number; power: number }
  | { type: 'shot'; angle?: number; power?: number }
  | { type: 'tick'; deltaMs: number }

const FRAME_CAP_MS = 50
const STEP_SECONDS = 1 / 120
const STOP_SPEED = 11
const STOP_SETTLE_MS = 115
const FIELD = { left: 48, right: 592, top: 48, bottom: 732 }

export function moonshotHole(state: MoonshotState): MoonshotHole {
  return MOONSHOT_HOLES[state.holeIndex]!
}

export function createMoonshotState(): MoonshotState {
  const hole = MOONSHOT_HOLES[0]!
  return {
    phase: 'ready', holeIndex: 0,
    ball: { ...hole.tee, vx: 0, vy: 0 }, ballMoving: false, stoppedMs: 0,
    aimAngle: Math.atan2(hole.cup.y - hole.tee.y, hole.cup.x - hole.tee.x), power: 230,
    strokes: 0, holeStrokes: 0, completedHoles: [],
    message: 'Pull back from the ball and release, or set aim and power below.',
  }
}

export function moonshotReducer(state: MoonshotState, action: MoonshotAction): MoonshotState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'The first hole is open. Pick your line.' } : state
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Round paused.' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Back on the green.' } : state
    case 'restart':
      return createMoonshotState()
    case 'aim':
      if (state.phase !== 'playing' || state.ballMoving) return state
      return {
        ...state,
        aimAngle: wrapAngle(state.aimAngle + (action.angleDelta ?? 0)),
        power: clamp(state.power + (action.powerDelta ?? 0), MOONSHOT_MIN_POWER, MOONSHOT_MAX_POWER),
      }
    case 'set-aim':
      if (state.phase !== 'playing' || state.ballMoving || !Number.isFinite(action.angle) || !Number.isFinite(action.power)) return state
      return { ...state, aimAngle: wrapAngle(action.angle), power: clamp(action.power, MOONSHOT_MIN_POWER, MOONSHOT_MAX_POWER) }
    case 'shot':
      return takeMoonshot(state, action.angle, action.power)
    case 'tick':
      return advanceMoonshot(state, action.deltaMs)
    case 'reset-hole':
      return resetMoonshotHole(state)
    case 'next-hole':
      return advanceMoonshotHole(state)
  }
}

function takeMoonshot(state: MoonshotState, angle = state.aimAngle, power = state.power): MoonshotState {
  if (state.phase !== 'playing' || state.ballMoving || !Number.isFinite(angle) || !Number.isFinite(power)) return state
  const speed = clamp(power, MOONSHOT_MIN_POWER, MOONSHOT_MAX_POWER)
  return {
    ...state,
    ball: { ...state.ball, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed },
    ballMoving: true,
    stoppedMs: 0,
    aimAngle: wrapAngle(angle),
    power: speed,
    strokes: state.strokes + 1,
    holeStrokes: state.holeStrokes + 1,
    message: `Shot ${state.holeStrokes + 1}. Watch the roll.`,
  }
}

function resetMoonshotHole(state: MoonshotState): MoonshotState {
  if (state.phase !== 'playing' || !state.ballMoving && state.holeStrokes === 0) return state
  const hole = moonshotHole(state)
  return {
    ...state,
    ball: { ...hole.tee, vx: 0, vy: 0 }, ballMoving: false, stoppedMs: 0,
    aimAngle: Math.atan2(hole.cup.y - hole.tee.y, hole.cup.x - hole.tee.x),
    power: 190, strokes: state.strokes + 1, holeStrokes: state.holeStrokes + 1,
    message: 'Returned to the tee. One penalty stroke added.',
  }
}

function advanceMoonshotHole(state: MoonshotState): MoonshotState {
  if (state.phase !== 'holeComplete' || state.holeIndex >= MOONSHOT_HOLE_COUNT - 1) return state
  const nextIndex = state.holeIndex + 1
  const hole = MOONSHOT_HOLES[nextIndex]!
  return {
    ...state,
    phase: 'playing', holeIndex: nextIndex,
    ball: { ...hole.tee, vx: 0, vy: 0 }, ballMoving: false, stoppedMs: 0,
    aimAngle: Math.atan2(hole.cup.y - hole.tee.y, hole.cup.x - hole.tee.x), power: 230,
    holeStrokes: 0,
    message: `Hole ${nextIndex + 1}: ${hole.name}. Find the route to the cup.`,
  }
}

function advanceMoonshot(state: MoonshotState, deltaMs: number): MoonshotState {
  if (state.phase !== 'playing' || !state.ballMoving || !Number.isFinite(deltaMs) || deltaMs <= 0) return state
  const frameMs = Math.min(deltaMs, FRAME_CAP_MS)
  const stepCount = Math.max(1, Math.ceil((frameMs / 1000) / STEP_SECONDS))
  const stepMs = frameMs / stepCount
  let next = state
  for (let index = 0; index < stepCount && next.phase === 'playing' && next.ballMoving; index += 1) {
    next = moveMoonshotBall(next, stepMs)
  }
  return next
}

function moveMoonshotBall(state: MoonshotState, deltaMs: number): MoonshotState {
  const dt = deltaMs / 1000
  const hole = moonshotHole(state)
  let { x, y, vx, vy } = state.ball
  x += vx * dt
  y += vy * dt

  if (x < FIELD.left + MOONSHOT_BALL_RADIUS || x > FIELD.right - MOONSHOT_BALL_RADIUS) {
    x = clamp(x, FIELD.left + MOONSHOT_BALL_RADIUS, FIELD.right - MOONSHOT_BALL_RADIUS)
    vx = -vx * 0.72
  }
  if (y < FIELD.top + MOONSHOT_BALL_RADIUS || y > FIELD.bottom - MOONSHOT_BALL_RADIUS) {
    y = clamp(y, FIELD.top + MOONSHOT_BALL_RADIUS, FIELD.bottom - MOONSHOT_BALL_RADIUS)
    vy = -vy * 0.72
  }

  for (const wall of hole.walls) {
    const collision = circleRectCollision({ x, y, vx, vy }, wall)
    x = collision.x; y = collision.y; vx = collision.vx; vy = collision.vy
  }
  for (const bumper of hole.bumpers) {
    const collision = circleCircleCollision({ x, y, vx, vy }, bumper, 0.86)
    x = collision.x; y = collision.y; vx = collision.vx; vy = collision.vy
  }

  const speed = Math.hypot(vx, vy)
  const cupDistance = Math.hypot(x - hole.cup.x, y - hole.cup.y)
  const cupRadius = 23
  if (cupDistance <= cupRadius && speed <= 132) return sinkMoonshot(state, { x: hole.cup.x, y: hole.cup.y })
  if (cupDistance < cupRadius + MOONSHOT_BALL_RADIUS && speed > 132) {
    const direction = safeDirection(x - hole.cup.x, y - hole.cup.y)
    x = hole.cup.x + direction.x * (cupRadius + MOONSHOT_BALL_RADIUS)
    y = hole.cup.y + direction.y * (cupRadius + MOONSHOT_BALL_RADIUS)
    const inward = vx * direction.x + vy * direction.y
    if (inward < 0) { vx -= 1.7 * inward * direction.x; vy -= 1.7 * inward * direction.y }
    vx *= 0.82; vy *= 0.82
  }

  const inCrater = hole.craters.some((crater) => Math.hypot(x - crater.x, y - crater.y) < crater.radius)
  const drag = Math.exp(-(1.16 + (inCrater ? 1.9 : 0)) * dt)
  vx *= drag
  vy *= drag

  let stoppedMs = state.stoppedMs
  const settled = Math.hypot(vx, vy) < STOP_SPEED
  if (settled) stoppedMs += deltaMs
  else stoppedMs = 0
  if (settled && stoppedMs >= STOP_SETTLE_MS) {
    return { ...state, ball: { x, y, vx: 0, vy: 0 }, ballMoving: false, stoppedMs: 0, message: `Ball settled after ${state.holeStrokes} ${state.holeStrokes === 1 ? 'stroke' : 'strokes'}. Aim the next shot.` }
  }
  return { ...state, ball: { x, y, vx, vy }, stoppedMs }
}

function sinkMoonshot(state: MoonshotState, ball: MoonshotPoint): MoonshotState {
  const completedHoles = [...state.completedHoles, state.holeStrokes]
  const finalHole = state.holeIndex === MOONSHOT_HOLE_COUNT - 1
  return {
    ...state,
    phase: finalHole ? 'won' : 'holeComplete',
    ball: { ...ball, vx: 0, vy: 0 }, ballMoving: false, stoppedMs: 0,
    completedHoles,
    message: finalHole ? `Five holes banked in ${state.strokes} strokes.` : `${MOONSHOT_HOLES[state.holeIndex]!.name} banked in ${state.holeStrokes}.`,
  }
}

function circleRectCollision(ball: MoonshotState['ball'], wall: MoonshotWall): MoonshotState['ball'] {
  const closestX = clamp(ball.x, wall.x, wall.x + wall.width)
  const closestY = clamp(ball.y, wall.y, wall.y + wall.height)
  let dx = ball.x - closestX
  let dy = ball.y - closestY
  let distance = Math.hypot(dx, dy)
  if (distance >= MOONSHOT_BALL_RADIUS) return ball
  if (distance < 0.001) {
    const distances = [
      { gap: ball.x - wall.x, x: -1, y: 0, px: wall.x - MOONSHOT_BALL_RADIUS, py: ball.y },
      { gap: wall.x + wall.width - ball.x, x: 1, y: 0, px: wall.x + wall.width + MOONSHOT_BALL_RADIUS, py: ball.y },
      { gap: ball.y - wall.y, x: 0, y: -1, px: ball.x, py: wall.y - MOONSHOT_BALL_RADIUS },
      { gap: wall.y + wall.height - ball.y, x: 0, y: 1, px: ball.x, py: wall.y + wall.height + MOONSHOT_BALL_RADIUS },
    ].sort((a, b) => a.gap - b.gap)[0]!
    dx = distances.x; dy = distances.y; distance = 1
    ball.x = distances.px; ball.y = distances.py
  } else {
    ball.x = closestX + (dx / distance) * MOONSHOT_BALL_RADIUS
    ball.y = closestY + (dy / distance) * MOONSHOT_BALL_RADIUS
  }
  const nx = dx / distance; const ny = dy / distance
  const inward = ball.vx * nx + ball.vy * ny
  if (inward < 0) { ball.vx -= 1.68 * inward * nx; ball.vy -= 1.68 * inward * ny }
  return ball
}

function circleCircleCollision(ball: MoonshotState['ball'], obstacle: MoonshotObstacle, restitution: number): MoonshotState['ball'] {
  const dx = ball.x - obstacle.x
  const dy = ball.y - obstacle.y
  const distance = Math.hypot(dx, dy)
  const minimum = MOONSHOT_BALL_RADIUS + obstacle.radius
  if (distance >= minimum) return ball
  const direction = safeDirection(dx, dy)
  ball.x = obstacle.x + direction.x * minimum
  ball.y = obstacle.y + direction.y * minimum
  const inward = ball.vx * direction.x + ball.vy * direction.y
  if (inward < 0) {
    const impulse = (1 + restitution) * inward
    ball.vx -= impulse * direction.x
    ball.vy -= impulse * direction.y
  }
  return ball
}

function safeDirection(x: number, y: number): MoonshotPoint {
  const length = Math.hypot(x, y)
  return length < 0.001 ? { x: 0, y: -1 } : { x: x / length, y: y / length }
}

function wrapAngle(angle: number): number {
  const fullTurn = Math.PI * 2
  return ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
