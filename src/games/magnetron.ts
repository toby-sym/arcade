export const MAGNETRON_WIDTH = 600
export const MAGNETRON_HEIGHT = 400
export const MAGNETRON_COURSES = [
  {
    title: 'Warm Start',
    start: { x: 58, y: 200 },
    exit: { x: 552, y: 200 },
    walls: [
      { x: 220, y: 0, width: 28, height: 135 },
      { x: 220, y: 285, width: 28, height: 115 },
      { x: 388, y: 0, width: 28, height: 180 },
      { x: 388, y: 320, width: 28, height: 80 },
    ],
    posts: [
      { x: 145, y: 80, polarity: -1 as const, name: 'North' },
      { x: 328, y: 198, polarity: 1 as const, name: 'Relay' },
      { x: 490, y: 330, polarity: -1 as const, name: 'South' },
    ],
  },
  {
    title: 'Chicane',
    start: { x: 58, y: 320 },
    exit: { x: 552, y: 320 },
    walls: [
      { x: 188, y: 0, width: 28, height: 258 },
      { x: 340, y: 170, width: 28, height: 230 },
      { x: 477, y: 0, width: 28, height: 252 },
    ],
    posts: [
      { x: 120, y: 340, polarity: 1 as const, name: 'Low rail' },
      { x: 270, y: 95, polarity: 1 as const, name: 'High rail' },
      { x: 405, y: 85, polarity: -1 as const, name: 'Turn' },
      { x: 525, y: 335, polarity: 1 as const, name: 'Finish' },
    ],
  },
  {
    title: 'Split Rail',
    start: { x: 58, y: 82 },
    exit: { x: 552, y: 92 },
    walls: [
      { x: 175, y: 140, width: 28, height: 260 },
      { x: 310, y: 0, width: 28, height: 252 },
      { x: 440, y: 140, width: 28, height: 260 },
    ],
    posts: [
      { x: 118, y: 75, polarity: 1 as const, name: 'Upper rail' },
      { x: 260, y: 90, polarity: -1 as const, name: 'Dive' },
      { x: 375, y: 335, polarity: 1 as const, name: 'Rise' },
      { x: 510, y: 78, polarity: 1 as const, name: 'Dock' },
    ],
  },
] as const

export type MagnetronPolarity = 1 | -1
export interface MagnetronPoint { x: number; y: number }
export interface MagnetronPuck extends MagnetronPoint { vx: number; vy: number }
export interface MagnetronPost extends MagnetronPoint { polarity: MagnetronPolarity; name: string }
export interface MagnetronWall { x: number; y: number; width: number; height: number }
export type MagnetronPhase = 'ready' | 'playing' | 'paused' | 'won'

export interface MagnetronState {
  phase: MagnetronPhase
  courseIndex: number
  puck: MagnetronPuck
  posts: MagnetronPost[]
  elapsedMs: number
  resets: number
  collisions: number
  message: string
}

export const MAGNETRON_PUCK_RADIUS = 12
export const MAGNETRON_POST_RADIUS = 18
export const MAGNETRON_EXIT_RADIUS = 25
export const MAGNETRON_RESET_PENALTY_MS = 3_000
const FIELD_STRENGTH = 3_500
const POLARITY_FLIP_PULSE = 72
const FORWARD_ACCELERATION = 19
const DRAG_PER_SECOND = 0.34
const MAX_SPEED = 180
const MAX_ACCELERATION = 280

type Course = typeof MAGNETRON_COURSES[number]

export function magnetronCourse(index: number): Course {
  return MAGNETRON_COURSES[Math.max(0, Math.min(MAGNETRON_COURSES.length - 1, Math.floor(index)))]!
}

export function createMagnetronState(): MagnetronState {
  const course = magnetronCourse(0)
  return {
    phase: 'ready',
    courseIndex: 0,
    puck: { ...course.start, vx: 68, vy: 0 },
    posts: course.posts.map((post) => ({ ...post })),
    elapsedMs: 0,
    resets: 0,
    collisions: 0,
    message: 'Switch each field post between pull and push to guide the puck through all three rails.',
  }
}

export function startMagnetron(_state: MagnetronState): MagnetronState {
  return { ...createMagnetronState(), phase: 'playing', message: 'Field live. Reverse a post before the puck reaches the next rail.' }
}

export function pauseMagnetron(state: MagnetronState): MagnetronState {
  return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Course paused. Your field settings and puck are held.' } : state
}

export function resumeMagnetron(state: MagnetronState): MagnetronState {
  return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Field live. Guide the puck to the exit ring.' } : state
}

export function toggleMagnetronPost(state: MagnetronState, postIndex: number): MagnetronState {
  if (state.phase !== 'playing' || !Number.isInteger(postIndex) || postIndex < 0 || postIndex >= state.posts.length) return state
  const posts: MagnetronPost[] = state.posts.map((post, index) => index === postIndex
    ? { ...post, polarity: (post.polarity === 1 ? -1 : 1) as MagnetronPolarity }
    : post)
  const post = posts[postIndex]!
  const dx = post.x - state.puck.x
  const dy = post.y - state.puck.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const direction = post.polarity * POLARITY_FLIP_PULSE / distance
  const vx = state.puck.vx + dx * direction
  const vy = state.puck.vy + dy * direction
  const speed = Math.hypot(vx, vy)
  const scale = speed > MAX_SPEED ? MAX_SPEED / speed : 1
  const polarity = post.polarity === 1 ? 'pulls' : 'pushes'
  return {
    ...state,
    posts,
    puck: { ...state.puck, vx: vx * scale, vy: vy * scale },
    message: `${post.name} now ${polarity} the puck. The polarity flip sent a field pulse.`,
  }
}

export function resetMagnetronCourse(state: MagnetronState): MagnetronState {
  if (state.phase !== 'playing' && state.phase !== 'paused') return state
  const course = magnetronCourse(state.courseIndex)
  return {
    ...state,
    phase: state.phase,
    puck: { ...course.start, vx: 68, vy: 0 },
    posts: course.posts.map((post) => ({ ...post })),
    elapsedMs: state.elapsedMs + MAGNETRON_RESET_PENALTY_MS,
    resets: state.resets + 1,
    message: `Puck reset to the course start. ${MAGNETRON_RESET_PENALTY_MS / 1000} second penalty applied.`,
  }
}

export function restartMagnetron(_state: MagnetronState): MagnetronState {
  return createMagnetronState()
}

export function magnetronAcceleration(puck: MagnetronPoint, posts: readonly MagnetronPost[]): MagnetronPoint {
  let ax = FORWARD_ACCELERATION
  let ay = 0
  for (const post of posts) {
    const dx = post.x - puck.x
    const dy = post.y - puck.y
    const distance = Math.max(24, Math.hypot(dx, dy))
    const strength = post.polarity * FIELD_STRENGTH / (distance + 55)
    ax += dx / distance * strength
    ay += dy / distance * strength
  }
  const magnitude = Math.hypot(ax, ay)
  if (magnitude > MAX_ACCELERATION) {
    ax = ax / magnitude * MAX_ACCELERATION
    ay = ay / magnitude * MAX_ACCELERATION
  }
  return { x: ax, y: ay }
}

export function advanceMagnetron(state: MagnetronState, deltaMs: number): MagnetronState {
  if (state.phase !== 'playing' || !Number.isFinite(deltaMs) || deltaMs <= 0) return state
  const elapsed = deltaMs
  const physicsElapsed = Math.min(deltaMs, 50)
  const dt = physicsElapsed / 1000
  const course = magnetronCourse(state.courseIndex)
  const acceleration = magnetronAcceleration(state.puck, state.posts)
  const damping = Math.exp(-DRAG_PER_SECOND * dt)
  let puck: MagnetronPuck = {
    x: state.puck.x,
    y: state.puck.y,
    vx: (state.puck.vx + acceleration.x * dt) * damping,
    vy: (state.puck.vy + acceleration.y * dt) * damping,
  }
  const speed = Math.hypot(puck.vx, puck.vy)
  if (speed > MAX_SPEED) puck = { ...puck, vx: puck.vx / speed * MAX_SPEED, vy: puck.vy / speed * MAX_SPEED }
  puck = { ...puck, x: puck.x + puck.vx * dt, y: puck.y + puck.vy * dt }

  let collisions = 0
  let message = state.message
  const boundaryX = MAGNETRON_WIDTH - MAGNETRON_PUCK_RADIUS
  const boundaryY = MAGNETRON_HEIGHT - MAGNETRON_PUCK_RADIUS
  if (puck.x < MAGNETRON_PUCK_RADIUS || puck.x > boundaryX) {
    puck = { ...puck, x: clamp(puck.x, MAGNETRON_PUCK_RADIUS, boundaryX), vx: -puck.vx * 0.48 }
    collisions += 1
  }
  if (puck.y < MAGNETRON_PUCK_RADIUS || puck.y > boundaryY) {
    puck = { ...puck, y: clamp(puck.y, MAGNETRON_PUCK_RADIUS, boundaryY), vy: -puck.vy * 0.48 }
    collisions += 1
  }
  for (const wall of course.walls) {
    const resolved = resolveWallCollision(puck, wall)
    if (resolved) {
      puck = resolved
      collisions += 1
    }
  }
  if (collisions > 0) message = 'Rail contact. Reverse a nearby post to clear a new path.'

  const elapsedMs = state.elapsedMs + elapsed
  if (Math.hypot(puck.x - course.exit.x, puck.y - course.exit.y) <= MAGNETRON_EXIT_RADIUS) {
    if (state.courseIndex === MAGNETRON_COURSES.length - 1) {
      return { ...state, phase: 'won', puck, elapsedMs, collisions: state.collisions + collisions, message: 'All three pucks docked. New best times are saved in this browser.' }
    }
    const nextIndex = state.courseIndex + 1
    const next = magnetronCourse(nextIndex)
    return {
      ...state,
      courseIndex: nextIndex,
      puck: { ...next.start, vx: 68, vy: 0 },
      posts: next.posts.map((post) => ({ ...post })),
      elapsedMs,
      collisions: state.collisions + collisions,
      message: `${course.title} cleared. ${next.title} is live.`,
    }
  }
  return { ...state, puck, elapsedMs, collisions: state.collisions + collisions, message }
}

export function formatMagnetronTime(timeMs: number): string {
  const centiseconds = Math.floor(Math.max(0, timeMs) / 10)
  const minutes = Math.floor(centiseconds / 6000)
  const seconds = Math.floor(centiseconds / 100) % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`
}

function resolveWallCollision(puck: MagnetronPuck, wall: MagnetronWall): MagnetronPuck | null {
  const closestX = clamp(puck.x, wall.x, wall.x + wall.width)
  const closestY = clamp(puck.y, wall.y, wall.y + wall.height)
  let dx = puck.x - closestX
  let dy = puck.y - closestY
  const distanceSquared = dx * dx + dy * dy
  if (distanceSquared >= MAGNETRON_PUCK_RADIUS ** 2) return null
  if (distanceSquared < 0.0001) {
    const edges = [
      { depth: puck.x - wall.x, nx: -1, ny: 0, x: wall.x - MAGNETRON_PUCK_RADIUS },
      { depth: wall.x + wall.width - puck.x, nx: 1, ny: 0, x: wall.x + wall.width + MAGNETRON_PUCK_RADIUS },
      { depth: puck.y - wall.y, nx: 0, ny: -1, y: wall.y - MAGNETRON_PUCK_RADIUS },
      { depth: wall.y + wall.height - puck.y, nx: 0, ny: 1, y: wall.y + wall.height + MAGNETRON_PUCK_RADIUS },
    ].sort((a, b) => a.depth - b.depth)
    const edge = edges[0]!
    return {
      ...puck,
      x: edge.x ?? puck.x,
      y: edge.y ?? puck.y,
      vx: edge.nx !== 0 ? -puck.vx * 0.48 : puck.vx,
      vy: edge.ny !== 0 ? -puck.vy * 0.48 : puck.vy,
    }
  }
  const distance = Math.sqrt(distanceSquared)
  const nx = dx / distance
  const ny = dy / distance
  dx = nx * (MAGNETRON_PUCK_RADIUS - distance)
  dy = ny * (MAGNETRON_PUCK_RADIUS - distance)
  const velocityAlongNormal = puck.vx * nx + puck.vy * ny
  const bounce = velocityAlongNormal < 0 ? 1.48 * velocityAlongNormal : 0
  return { x: puck.x + dx, y: puck.y + dy, vx: puck.vx - bounce * nx, vy: puck.vy - bounce * ny }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

