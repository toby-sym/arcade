export type InvadersPhase = 'ready' | 'playing' | 'paused' | 'over' | 'won'

export interface Invader {
  id: number
  column: number
  row: number
  x: number
  y: number
  alive: boolean
}

export interface InvaderShot {
  x: number
  y: number
}

export interface InvadersState {
  phase: InvadersPhase
  score: number
  lives: number
  playerX: number
  aliens: Invader[]
  playerShots: InvaderShot[]
  enemyShots: InvaderShot[]
  direction: -1 | 1
  tick: number
  message: string
}

export type InvadersAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'movePlayer'; amount: number }
  | { type: 'shoot' }
  | { type: 'tick' }

const PLAYER_MIN_X = 4
const PLAYER_MAX_X = 96
const PLAYER_Y = 90

export function createInvadersState(): InvadersState {
  const aliens = Array.from({ length: 32 }, (_, id) => {
    const row = Math.floor(id / 8)
    const column = id % 8
    return { id, row, column, x: 12 + column * 11, y: 16 + row * 8, alive: true }
  })

  return {
    phase: 'ready',
    score: 0,
    lives: 3,
    playerX: 50,
    aliens,
    playerShots: [],
    enemyShots: [],
    direction: 1,
    tick: 0,
    message: 'Clear the formation before it reaches your ship.',
  }
}

export function invadersReducer(state: InvadersState, action: InvadersAction): InvadersState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Move and fire. Keep the formation back.' } : state
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Game paused.' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Back in the fight.' } : state
    case 'restart':
      return createInvadersState()
    case 'movePlayer':
      if (state.phase === 'paused' || state.phase === 'over' || state.phase === 'won') return state
      if (!Number.isFinite(action.amount)) return state
      return { ...state, playerX: clamp(state.playerX + action.amount, PLAYER_MIN_X, PLAYER_MAX_X) }
    case 'shoot':
      if (state.phase !== 'playing' || state.playerShots.length > 0) return state
      return { ...state, playerShots: [{ x: state.playerX, y: PLAYER_Y - 5 }] }
    case 'tick':
      return tickInvaders(state)
  }
}

function tickInvaders(state: InvadersState): InvadersState {
  if (state.phase !== 'playing') return state

  const tick = state.tick + 1
  let direction = state.direction
  let aliens = state.aliens
  let fleetReachedShip = false

  if (tick % 3 === 0) {
    const living = state.aliens.filter((alien) => alien.alive)
    const leftEdge = Math.min(...living.map((alien) => alien.x))
    const rightEdge = Math.max(...living.map((alien) => alien.x))
    const hitEdge = direction === 1 ? rightEdge >= 94 : leftEdge <= 6

    if (hitEdge) {
      direction = direction === 1 ? -1 : 1
      aliens = state.aliens.map((alien) => ({ ...alien, y: alien.alive ? alien.y + 2.5 : alien.y }))
    } else {
      aliens = state.aliens.map((alien) => ({ ...alien, x: alien.alive ? alien.x + direction * 1.6 : alien.x }))
    }

    fleetReachedShip = aliens.some((alien) => alien.alive && alien.y >= 82)
  }

  let score = state.score
  let playerShots: InvaderShot[] = []
  const nextAliens = aliens.map((alien) => ({ ...alien }))

  for (const shot of state.playerShots) {
    const y = shot.y - 5.5
    const target = nextAliens.find((alien) =>
      alien.alive && Math.abs(alien.x - shot.x) < 4.8 && Math.abs(alien.y - y) < 4.2,
    )

    if (target) {
      target.alive = false
      score += (4 - target.row) * 10
    } else if (y > 0) {
      playerShots.push({ x: shot.x, y })
    }
  }

  let enemyShots = state.enemyShots.map((shot) => ({ ...shot, y: shot.y + 3.1 }))
  if (tick % 24 === 0) {
    const living = nextAliens.filter((alien) => alien.alive)
    if (living.length > 0) {
      const column = Math.floor(tick / 24) % 8
      const source = living
        .filter((alien) => alien.column === column)
        .sort((first, second) => second.y - first.y)[0] ?? living[tick % living.length]
      enemyShots = [...enemyShots, { x: source.x, y: source.y + 4 }]
    }
  }

  const hitByShot = enemyShots.some((shot) => shot.y >= PLAYER_Y - 3 && Math.abs(shot.x - state.playerX) < 5)
  enemyShots = enemyShots.filter((shot) => shot.y < 100 && !(shot.y >= PLAYER_Y - 3 && Math.abs(shot.x - state.playerX) < 5))
  const lives = state.lives - Number(hitByShot)

  if (fleetReachedShip) {
    return { ...state, phase: 'over', tick, aliens: nextAliens, playerShots, enemyShots, score, message: 'The formation reached your ship. Game over.' }
  }
  if (lives <= 0) {
    return { ...state, phase: 'over', tick, aliens: nextAliens, playerShots, enemyShots, score, lives: 0, message: 'Your last ship is gone. Game over.' }
  }
  if (nextAliens.every((alien) => !alien.alive)) {
    return { ...state, phase: 'won', tick, aliens: nextAliens, playerShots: [], enemyShots, score, lives, message: 'Formation cleared. You saved the cabinet.' }
  }

  return {
    ...state,
    tick,
    direction,
    aliens: nextAliens,
    playerShots,
    enemyShots,
    score,
    lives,
    message: hitByShot ? `${lives} ${lives === 1 ? 'ship' : 'ships'} left.` : state.message,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
