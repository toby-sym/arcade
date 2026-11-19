export const ASTEROIDS_WIDTH = 600
export const ASTEROIDS_HEIGHT = 600

export type AsteroidSize = 'large' | 'medium' | 'small'
export type AsteroidsPhase = 'ready' | 'playing' | 'paused' | 'over'
export type AsteroidsControl = 'left' | 'right' | 'thrust' | 'fire'

export interface Asteroid {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: AsteroidSize
  rotation: number
  spin: number
}

export interface AsteroidsShip {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  invulnerable: number
}

export interface AsteroidShot {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export interface AsteroidsState {
  phase: AsteroidsPhase
  score: number
  lives: number
  wave: number
  ship: AsteroidsShip
  rocks: Asteroid[]
  shots: AsteroidShot[]
  controls: Record<AsteroidsControl, boolean>
  shotCooldown: number
  tick: number
  nextId: number
  message: string
}

export type AsteroidsAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'control'; control: AsteroidsControl; pressed: boolean }
  | { type: 'tick'; deltaMs: number }

export const ASTEROID_RADII: Record<AsteroidSize, number> = { large: 29, medium: 18, small: 10 }
const FRAME_MS = 1000 / 60
const MAX_DELTA_MS = 50
const TURN_SPEED = 0.078
const THRUST_POWER = 0.105
const SHIP_DRAG = 0.993
const MAX_SHIP_SPEED = 5.5

const emptyControls = (): Record<AsteroidsControl, boolean> => ({ left: false, right: false, thrust: false, fire: false })

export function createAsteroidsState(): AsteroidsState {
  const rocks = createWaveRocks(1, 0)
  return {
    phase: 'ready',
    score: 0,
    lives: 3,
    wave: 1,
    ship: { x: ASTEROIDS_WIDTH / 2, y: ASTEROIDS_HEIGHT / 2, vx: 0, vy: 0, angle: 0, invulnerable: 0 },
    rocks,
    shots: [],
    controls: emptyControls(),
    shotCooldown: 0,
    tick: 0,
    nextId: rocks.length,
    message: 'Rotate, thrust, and clear the field. The rocks wrap around the screen.',
  }
}

export function asteroidsReducer(state: AsteroidsState, action: AsteroidsAction): AsteroidsState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing', message: `Wave ${state.wave}. Keep moving and watch the whole field.` } : state
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused', controls: emptyControls(), message: 'Game paused.' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing', message: `Wave ${state.wave}. Back in the field.` } : state
    case 'restart':
      return createAsteroidsState()
    case 'control':
      if (state.phase !== 'playing') return state
      return state.controls[action.control] === action.pressed
        ? state
        : { ...state, controls: { ...state.controls, [action.control]: action.pressed } }
    case 'tick':
      return advanceAsteroids(state, action.deltaMs)
  }
}

function advanceAsteroids(state: AsteroidsState, deltaMs: number): AsteroidsState {
  if (state.phase !== 'playing' || !Number.isFinite(deltaMs) || deltaMs <= 0) return state
  const frames = Math.min(deltaMs, MAX_DELTA_MS) / FRAME_MS
  let angle = state.ship.angle
  if (state.controls.left) angle -= TURN_SPEED * frames
  if (state.controls.right) angle += TURN_SPEED * frames

  let vx = state.ship.vx
  let vy = state.ship.vy
  if (state.controls.thrust) {
    vx += Math.sin(angle) * THRUST_POWER * frames
    vy -= Math.cos(angle) * THRUST_POWER * frames
  }
  const speed = Math.hypot(vx, vy)
  if (speed > MAX_SHIP_SPEED) {
    vx = (vx / speed) * MAX_SHIP_SPEED
    vy = (vy / speed) * MAX_SHIP_SPEED
  }
  const ship: AsteroidsShip = {
    x: wrap(state.ship.x + vx * frames, ASTEROIDS_WIDTH),
    y: wrap(state.ship.y + vy * frames, ASTEROIDS_HEIGHT),
    vx: vx * Math.pow(SHIP_DRAG, frames),
    vy: vy * Math.pow(SHIP_DRAG, frames),
    angle,
    invulnerable: Math.max(0, state.ship.invulnerable - frames),
  }

  const rocks = state.rocks.map((rock) => ({
    ...rock,
    x: wrap(rock.x + rock.vx * frames, ASTEROIDS_WIDTH),
    y: wrap(rock.y + rock.vy * frames, ASTEROIDS_HEIGHT),
    rotation: rock.rotation + rock.spin * frames,
  }))
  let nextId = state.nextId
  let score = state.score
  const shots: AsteroidShot[] = []
  let rocksAfterShots = rocks

  for (const previousShot of state.shots) {
    const shot = { ...previousShot, x: wrap(previousShot.x + previousShot.vx * frames, ASTEROIDS_WIDTH), y: wrap(previousShot.y + previousShot.vy * frames, ASTEROIDS_HEIGHT), life: previousShot.life - frames }
    const targetIndex = rocksAfterShots.findIndex((rock) => distance(shipDelta(rock.x - shot.x, ASTEROIDS_WIDTH), shipDelta(rock.y - shot.y, ASTEROIDS_HEIGHT)) < ASTEROID_RADII[rock.size])
    if (targetIndex >= 0) {
      const target = rocksAfterShots[targetIndex]!
      score += target.size === 'large' ? 20 : target.size === 'medium' ? 50 : 100
      const children = splitAsteroid(target, nextId)
      nextId += children.length
      rocksAfterShots = [...rocksAfterShots.slice(0, targetIndex), ...rocksAfterShots.slice(targetIndex + 1), ...children]
    } else if (shot.life > 0) {
      shots.push(shot)
    }
  }

  let shotCooldown = Math.max(0, state.shotCooldown - frames)
  if (state.controls.fire && shotCooldown <= 0) {
    const noseX = ship.x + Math.sin(angle) * 19
    const noseY = ship.y - Math.cos(angle) * 19
    shots.push({ x: noseX, y: noseY, vx: ship.vx + Math.sin(angle) * 8.5, vy: ship.vy - Math.cos(angle) * 8.5, life: 56 })
    shotCooldown = 9
  }

  const shipHit = ship.invulnerable <= 0 && rocksAfterShots.some((rock) => distance(shipDelta(rock.x - ship.x, ASTEROIDS_WIDTH), shipDelta(rock.y - ship.y, ASTEROIDS_HEIGHT)) < ASTEROID_RADII[rock.size] + 11)
  const lives = state.lives - Number(shipHit)
  if (shipHit) {
    ship.x = ASTEROIDS_WIDTH / 2
    ship.y = ASTEROIDS_HEIGHT / 2
    ship.vx = 0
    ship.vy = 0
    ship.invulnerable = 120
  }

  const tick = state.tick + 1
  if (lives <= 0) {
    return { ...state, phase: 'over', lives: 0, tick, score, ship, rocks: rocksAfterShots, shots, message: 'Your last ship is gone. Game over.' }
  }

  let wave = state.wave
  let message = shipHit ? `${lives} ${lives === 1 ? 'ship' : 'ships'} left. Keep moving.` : state.message
  if (rocksAfterShots.length === 0) {
    wave += 1
    const newRocks = createWaveRocks(wave, nextId)
    nextId += newRocks.length
    rocksAfterShots = newRocks
    message = `Wave ${wave}. More rocks are on the way.`
  }

  return { ...state, tick, wave, score, lives, ship, rocks: rocksAfterShots, shots, shotCooldown, nextId, message }
}

function createWaveRocks(wave: number, firstId: number): Asteroid[] {
  const count = Math.min(5 + wave, 12)
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + wave * 0.17
    const distanceFromCenter = 218 + (index % 2) * 54
    const driftAngle = angle + 1.3
    return {
      id: firstId + index,
      x: wrap(ASTEROIDS_WIDTH / 2 + Math.cos(angle) * distanceFromCenter, ASTEROIDS_WIDTH),
      y: wrap(ASTEROIDS_HEIGHT / 2 + Math.sin(angle) * distanceFromCenter, ASTEROIDS_HEIGHT),
      vx: Math.cos(driftAngle) * (0.55 + (index % 3) * 0.13),
      vy: Math.sin(driftAngle) * (0.55 + (index % 2) * 0.16),
      size: 'large' as const,
      rotation: index * 27,
      spin: index % 2 === 0 ? 0.22 : -0.17,
    }
  })
}

function splitAsteroid(rock: Asteroid, firstId: number): Asteroid[] {
  if (rock.size === 'small') return []
  const childSize: AsteroidSize = rock.size === 'large' ? 'medium' : 'small'
  const childCount = rock.size === 'large' ? 2 : 2
  return Array.from({ length: childCount }, (_, index) => {
    const direction = Math.atan2(rock.vy, rock.vx) + (index === 0 ? -0.75 : 0.75)
    return {
      id: firstId + index,
      x: rock.x,
      y: rock.y,
      vx: Math.cos(direction) * 1.5,
      vy: Math.sin(direction) * 1.5,
      size: childSize,
      rotation: rock.rotation + index * 45,
      spin: index === 0 ? 0.32 : -0.28,
    }
  })
}

function shipDelta(delta: number, size: number) {
  return ((delta + size / 2) % size + size) % size - size / 2
}

function distance(x: number, y: number) {
  return Math.hypot(x, y)
}

function wrap(value: number, size: number) {
  return ((value % size) + size) % size
}
