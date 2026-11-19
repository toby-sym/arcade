export const BREAKOUT_WIDTH = 480
export const BREAKOUT_HEIGHT = 360
export const BALL_RADIUS = 6
export const PADDLE_WIDTH = 88
export const PADDLE_HEIGHT = 12
export const PADDLE_Y = 330
export const BRICK_COLUMNS = 8
export const BRICK_ROWS = 5
export const BRICK_WIDTH = 50
export const BRICK_HEIGHT = 16
export const BRICK_GAP_X = 6
export const BRICK_GAP_Y = 8
export const BRICK_TOP = 42
export const BRICK_LEFT = (BREAKOUT_WIDTH - (BRICK_COLUMNS * BRICK_WIDTH + (BRICK_COLUMNS - 1) * BRICK_GAP_X)) / 2

export type BreakoutPhase = 'ready' | 'playing' | 'paused' | 'over' | 'won'

export interface BreakoutState {
  phase: BreakoutPhase
  ball: { x: number; y: number; vx: number; vy: number }
  paddleX: number
  bricks: boolean[]
  score: number
  lives: number
  message: string
}

export type BreakoutAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'movePaddle'; centerX: number }
  | { type: 'tick' }
  | { type: 'restart' }

export function createBreakoutState(): BreakoutState {
  return {
    phase: 'ready',
    ball: startingBall(),
    paddleX: (BREAKOUT_WIDTH - PADDLE_WIDTH) / 2,
    bricks: Array.from({ length: BRICK_ROWS * BRICK_COLUMNS }, () => true),
    score: 0,
    lives: 3,
    message: 'Ready. Launch the ball to begin.',
  }
}

export function breakoutReducer(state: BreakoutState, action: BreakoutAction): BreakoutState {
  switch (action.type) {
    case 'start':
      if (state.phase !== 'ready') return state
      return { ...state, phase: 'playing', message: 'Ball in play. Move the paddle to keep it up.' }

    case 'pause':
      if (state.phase !== 'playing') return state
      return { ...state, phase: 'paused', message: 'Paused. Resume when you are ready.' }

    case 'resume':
      if (state.phase !== 'paused') return state
      return { ...state, phase: 'playing', message: 'Ball in play. Move the paddle to keep it up.' }

    case 'movePaddle':
      if (state.phase === 'paused' || state.phase === 'over' || state.phase === 'won') return state
      return { ...state, paddleX: clamp(action.centerX - PADDLE_WIDTH / 2, 0, BREAKOUT_WIDTH - PADDLE_WIDTH) }

    case 'tick':
      if (state.phase !== 'playing') return state
      return advanceBall(state)

    case 'restart':
      return createBreakoutState()
  }
}

export function breakoutBrickRect(index: number) {
  const row = Math.floor(index / BRICK_COLUMNS)
  const column = index % BRICK_COLUMNS
  return {
    x: BRICK_LEFT + column * (BRICK_WIDTH + BRICK_GAP_X),
    y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP_Y),
    width: BRICK_WIDTH,
    height: BRICK_HEIGHT,
  }
}

export function remainingBricks(bricks: boolean[]) {
  return bricks.reduce((count, alive) => count + (alive ? 1 : 0), 0)
}

function advanceBall(state: BreakoutState): BreakoutState {
  let { x, y, vx, vy } = state.ball
  let nextX = x + vx
  let nextY = y + vy

  if (nextX - BALL_RADIUS < 0) {
    nextX = BALL_RADIUS
    vx = Math.abs(vx)
  } else if (nextX + BALL_RADIUS > BREAKOUT_WIDTH) {
    nextX = BREAKOUT_WIDTH - BALL_RADIUS
    vx = -Math.abs(vx)
  }
  if (nextY - BALL_RADIUS < 0) {
    nextY = BALL_RADIUS
    vy = Math.abs(vy)
  }

  let bricks = state.bricks
  let score = state.score
  let message = state.message
  for (let index = 0; index < bricks.length; index += 1) {
    if (!bricks[index]) continue
    const brick = breakoutBrickRect(index)
    const overlapping = nextX + BALL_RADIUS > brick.x
      && nextX - BALL_RADIUS < brick.x + brick.width
      && nextY + BALL_RADIUS > brick.y
      && nextY - BALL_RADIUS < brick.y + brick.height
    if (!overlapping) continue

    const previouslyAbove = y + BALL_RADIUS <= brick.y
    const previouslyBelow = y - BALL_RADIUS >= brick.y + brick.height
    const previouslyLeft = x + BALL_RADIUS <= brick.x
    const previouslyRight = x - BALL_RADIUS >= brick.x + brick.width
    if (previouslyAbove || previouslyBelow) vy = -vy
    else if (previouslyLeft || previouslyRight) vx = -vx
    else if (Math.abs(nextX - (brick.x + brick.width / 2)) / brick.width > Math.abs(nextY - (brick.y + brick.height / 2)) / brick.height) vx = -vx
    else vy = -vy

    bricks = [...bricks]
    bricks[index] = false
    score += 10
    const left = remainingBricks(bricks)
    message = left === 0 ? `Wall cleared. Final score ${score}.` : `Brick cleared. Score ${score}. ${left} left.`
    break
  }

  if (vy > 0 && y + BALL_RADIUS <= PADDLE_Y && nextY + BALL_RADIUS >= PADDLE_Y
    && nextX + BALL_RADIUS >= state.paddleX && nextX - BALL_RADIUS <= state.paddleX + PADDLE_WIDTH) {
    const offset = clamp((nextX - (state.paddleX + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2), -1, 1)
    const speed = Math.hypot(vx, vy)
    vx = offset * speed * 0.82
    vy = -Math.sqrt(Math.max(4, speed * speed - vx * vx))
    nextY = PADDLE_Y - BALL_RADIUS
  }

  if (nextY - BALL_RADIUS > BREAKOUT_HEIGHT) {
    const lives = state.lives - 1
    if (lives === 0) return { ...state, phase: 'over', ball: startingBall(), lives: 0, message: `Game over. Final score ${score}. Restart for another go.` }
    return { ...state, phase: 'ready', ball: startingBall(), bricks, score, lives, message: `Ball lost. ${lives} ${lives === 1 ? 'life' : 'lives'} left. Launch again when ready.` }
  }

  const phase = remainingBricks(bricks) === 0 ? 'won' : 'playing'
  return { ...state, phase, ball: { x: nextX, y: nextY, vx, vy }, bricks, score, message: phase === 'won' ? `Wall cleared. Final score ${score}.` : message }
}

function startingBall() {
  return { x: BREAKOUT_WIDTH / 2, y: PADDLE_Y - 35, vx: 3.1, vy: -4 }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
