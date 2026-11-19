export const SKYLINE_WIDTH = 2700
export const SKYLINE_VIEW_WIDTH = 840
export const SKYLINE_VIEW_HEIGHT = 360
export const SKYLINE_PLAYER_WIDTH = 28
export const SKYLINE_PLAYER_HEIGHT = 36
export const SKYLINE_FINISH_X = 2580
export const SKYLINE_MAX_LIVES = 3
export const SKYLINE_CHECKPOINTS = [0, 1170, 2270]

export interface SkylinePlatform {
  x: number
  width: number
  top: number
}

export interface SkylineHazard {
  x: number
  width: number
  top: number
  height: number
}

export interface SkylineShard {
  x: number
  y: number
}

export const SKYLINE_PLATFORMS: SkylinePlatform[] = [
  { x: 0, width: 350, top: 304 },
  { x: 420, width: 110, top: 268 },
  { x: 610, width: 320, top: 304 },
  { x: 990, width: 120, top: 255 },
  { x: 1170, width: 340, top: 304 },
  { x: 1570, width: 120, top: 260 },
  { x: 1740, width: 340, top: 304 },
  { x: 2110, width: 110, top: 265 },
  { x: 2270, width: 430, top: 304 },
]

export const SKYLINE_HAZARDS: SkylineHazard[] = [
  { x: 210, width: 28, top: 280, height: 24 },
  { x: 675, width: 32, top: 280, height: 24 },
  { x: 1284, width: 32, top: 280, height: 24 },
  { x: 1810, width: 32, top: 280, height: 24 },
  { x: 2330, width: 32, top: 280, height: 24 },
]

export const SKYLINE_SHARDS: SkylineShard[] = [
  { x: 126, y: 262 },
  { x: 475, y: 236 },
  { x: 785, y: 262 },
  { x: 1048, y: 224 },
  { x: 1356, y: 262 },
  { x: 1612, y: 230 },
  { x: 1855, y: 262 },
  { x: 2156, y: 235 },
  { x: 2460, y: 262 },
]

export type SkylinePhase = 'ready' | 'playing' | 'paused' | 'won' | 'over'

export interface SkylineState {
  x: number
  y: number
  vx: number
  vy: number
  grounded: boolean
  coyoteMs: number
  jumpBufferMs: number
  checkpoint: number
  shards: number[]
  score: number
  lives: number
  elapsedMs: number
  phase: SkylinePhase
}

export type SkylineAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'step'; deltaMs: number; direction: -1 | 0 | 1; jumpPressed?: boolean }

const GRAVITY = 1520
const JUMP_SPEED = -585
const RUN_SPEED = 270
const ACCELERATION = 1680
const BRAKING = 2050
const COYOTE_TIME_MS = 105
const JUMP_BUFFER_TIME_MS = 125

export function createSkylineState(): SkylineState {
  return {
    x: SKYLINE_CHECKPOINTS[0]!,
    y: platformAt(SKYLINE_CHECKPOINTS[0]!).top - SKYLINE_PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    grounded: true,
    coyoteMs: COYOTE_TIME_MS,
    jumpBufferMs: 0,
    checkpoint: 0,
    shards: [],
    score: 0,
    lives: SKYLINE_MAX_LIVES,
    elapsedMs: 0,
    phase: 'ready',
  }
}

export function skylineReducer(state: SkylineState, action: SkylineAction): SkylineState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing' } : state
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing' } : state
    case 'restart':
      return createSkylineState()
    case 'step':
      return stepSkyline(state, action)
  }
}

export function skylineCameraX(playerX: number): number {
  return Math.max(0, Math.min(SKYLINE_WIDTH - SKYLINE_VIEW_WIDTH, playerX - SKYLINE_VIEW_WIDTH * 0.36))
}

function stepSkyline(state: SkylineState, action: Extract<SkylineAction, { type: 'step' }>): SkylineState {
  if (state.phase !== 'playing') return state
  const dt = Math.min(Math.max(action.deltaMs, 0), 50) / 1000
  if (dt === 0) return state

  const jumpBufferMs = action.jumpPressed
    ? JUMP_BUFFER_TIME_MS
    : Math.max(0, state.jumpBufferMs - dt * 1000)
  const canJump = state.grounded || state.coyoteMs > 0
  const jumping = jumpBufferMs > 0 && canJump
  const wasGrounded = state.grounded
  let vy = jumping ? JUMP_SPEED : state.vy
  if (jumping) vy = JUMP_SPEED
  const targetVx = action.direction * RUN_SPEED
  const amount = (action.direction === 0 ? BRAKING : ACCELERATION) * dt
  const vx = approach(state.vx, targetVx, amount)
  const x = Math.max(0, Math.min(SKYLINE_WIDTH - SKYLINE_PLAYER_WIDTH, state.x + vx * dt))
  const oldBottom = state.y + SKYLINE_PLAYER_HEIGHT
  vy += GRAVITY * dt
  let y = state.y + vy * dt
  let grounded = false

  if (vy >= 0) {
    const landing = SKYLINE_PLATFORMS
      .filter((platform) =>
        state.x + SKYLINE_PLAYER_WIDTH > platform.x &&
        x < platform.x + platform.width &&
        oldBottom <= platform.top &&
        y + SKYLINE_PLAYER_HEIGHT >= platform.top,
      )
      .sort((left, right) => left.top - right.top)[0]
    if (landing) {
      y = landing.top - SKYLINE_PLAYER_HEIGHT
      vy = 0
      grounded = true
    }
  }

  const coyoteMs = grounded ? COYOTE_TIME_MS : wasGrounded ? COYOTE_TIME_MS : Math.max(0, state.coyoteMs - dt * 1000)
  let shards = state.shards
  let score = state.score
  const collected: number[] = []
  for (let index = 0; index < SKYLINE_SHARDS.length; index += 1) {
    const shard = SKYLINE_SHARDS[index]!
    if (shards.includes(index)) continue
    const dx = x + SKYLINE_PLAYER_WIDTH / 2 - shard.x
    const dy = y + SKYLINE_PLAYER_HEIGHT / 2 - shard.y
    if (Math.abs(dx) < SKYLINE_PLAYER_WIDTH / 2 + 9 && Math.abs(dy) < SKYLINE_PLAYER_HEIGHT / 2 + 9) collected.push(index)
  }
  if (collected.length > 0) {
    shards = [...shards, ...collected]
    score += collected.length * 10
  }

  const checkpoint = Math.max(state.checkpoint, SKYLINE_CHECKPOINTS.findIndex((point) => x >= point))
  const next: SkylineState = {
    ...state,
    x,
    y,
    vx,
    vy,
    grounded,
    coyoteMs: jumping ? 0 : coyoteMs,
    jumpBufferMs: jumping ? 0 : jumpBufferMs,
    checkpoint,
    shards,
    score,
    elapsedMs: state.elapsedMs + dt * 1000,
  }

  if (y > SKYLINE_VIEW_HEIGHT + 44 || SKYLINE_HAZARDS.some((hazard) => overlaps(x, y, hazard.x, hazard.top, hazard.width, hazard.height))) {
    return loseLife(next)
  }
  if (x + SKYLINE_PLAYER_WIDTH >= SKYLINE_FINISH_X) {
    return { ...next, score: next.score + 50 + next.lives * 10, phase: 'won' }
  }
  return next
}

function loseLife(state: SkylineState): SkylineState {
  const lives = state.lives - 1
  const x = SKYLINE_CHECKPOINTS[state.checkpoint]!
  return {
    ...state,
    x,
    y: platformAt(x).top - SKYLINE_PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    grounded: true,
    coyoteMs: COYOTE_TIME_MS,
    jumpBufferMs: 0,
    lives,
    phase: lives === 0 ? 'over' : 'playing',
  }
}

function platformAt(x: number): SkylinePlatform {
  return SKYLINE_PLATFORMS.find((platform) => x >= platform.x && x < platform.x + platform.width) ?? SKYLINE_PLATFORMS[0]!
}

function approach(value: number, target: number, amount: number): number {
  return value < target ? Math.min(value + amount, target) : Math.max(value - amount, target)
}

function overlaps(x: number, y: number, rx: number, ry: number, width: number, height: number): boolean {
  return x < rx + width && x + SKYLINE_PLAYER_WIDTH > rx && y < ry + height && y + SKYLINE_PLAYER_HEIGHT > ry
}
