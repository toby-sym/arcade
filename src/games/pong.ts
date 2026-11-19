export const PONG_WIDTH = 640
export const PONG_HEIGHT = 400
export const PONG_BALL_RADIUS = 7
export const PONG_PADDLE_WIDTH = 12
export const PONG_PADDLE_HEIGHT = 74
export const PONG_LEFT_X = 26
export const PONG_RIGHT_X = PONG_WIDTH - PONG_LEFT_X - PONG_PADDLE_WIDTH
export const PONG_WIN_SCORE = 5

export type PongPhase = 'ready' | 'playing' | 'paused' | 'over'
export type PongWinner = 'player' | 'opponent' | null

export interface PongState {
  phase: PongPhase
  ball: { x: number; y: number; vx: number; vy: number }
  paddleY: number
  opponentY: number
  score: number
  opponentScore: number
  winner: PongWinner
  message: string
}

export type PongAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'movePaddle'; centerY: number }
  | { type: 'tick' }
  | { type: 'restart' }

export function createPongState(): PongState {
  return {
    phase: 'ready',
    ball: startingBall(1),
    paddleY: (PONG_HEIGHT - PONG_PADDLE_HEIGHT) / 2,
    opponentY: (PONG_HEIGHT - PONG_PADDLE_HEIGHT) / 2,
    score: 0,
    opponentScore: 0,
    winner: null,
    message: `First to ${PONG_WIN_SCORE} points. Serve when ready.`,
  }
}

export function pongReducer(state: PongState, action: PongAction): PongState {
  switch (action.type) {
    case 'start':
      if (state.phase !== 'ready') return state
      return { ...state, phase: 'playing', message: 'Ball in play. Move your paddle to return it.' }

    case 'pause':
      if (state.phase !== 'playing') return state
      return { ...state, phase: 'paused', message: 'Match paused.' }

    case 'resume':
      if (state.phase !== 'paused') return state
      return { ...state, phase: 'playing', message: 'Ball in play. Move your paddle to return it.' }

    case 'movePaddle':
      if (state.phase === 'paused' || state.phase === 'over') return state
      return { ...state, paddleY: clamp(action.centerY - PONG_PADDLE_HEIGHT / 2, 0, PONG_HEIGHT - PONG_PADDLE_HEIGHT) }

    case 'tick':
      if (state.phase !== 'playing') return state
      return advanceBall(state)

    case 'restart':
      return createPongState()
  }
}

function advanceBall(state: PongState): PongState {
  let { x, y, vx, vy } = state.ball
  let nextX = x + vx
  let nextY = y + vy

  if (nextY - PONG_BALL_RADIUS < 0) {
    nextY = PONG_BALL_RADIUS
    vy = Math.abs(vy)
  } else if (nextY + PONG_BALL_RADIUS > PONG_HEIGHT) {
    nextY = PONG_HEIGHT - PONG_BALL_RADIUS
    vy = -Math.abs(vy)
  }

  const nextOpponentY = clamp(
    state.opponentY + clamp(y - (state.opponentY + PONG_PADDLE_HEIGHT / 2), -3.2, 3.2),
    0,
    PONG_HEIGHT - PONG_PADDLE_HEIGHT,
  )

  if (vx < 0 && x - PONG_BALL_RADIUS >= PONG_LEFT_X + PONG_PADDLE_WIDTH
    && nextX - PONG_BALL_RADIUS <= PONG_LEFT_X + PONG_PADDLE_WIDTH
    && nextY + PONG_BALL_RADIUS >= state.paddleY
    && nextY - PONG_BALL_RADIUS <= state.paddleY + PONG_PADDLE_HEIGHT) {
    const offset = clamp((nextY - (state.paddleY + PONG_PADDLE_HEIGHT / 2)) / (PONG_PADDLE_HEIGHT / 2), -1, 1)
    ;({ vx, vy } = paddleBounce(vx, vy, offset, 1))
    nextX = PONG_LEFT_X + PONG_PADDLE_WIDTH + PONG_BALL_RADIUS
  } else if (vx > 0 && x + PONG_BALL_RADIUS <= PONG_RIGHT_X
    && nextX + PONG_BALL_RADIUS >= PONG_RIGHT_X
    && nextY + PONG_BALL_RADIUS >= nextOpponentY
    && nextY - PONG_BALL_RADIUS <= nextOpponentY + PONG_PADDLE_HEIGHT) {
    const offset = clamp((nextY - (nextOpponentY + PONG_PADDLE_HEIGHT / 2)) / (PONG_PADDLE_HEIGHT / 2), -1, 1)
    ;({ vx, vy } = paddleBounce(vx, vy, offset, -1))
    nextX = PONG_RIGHT_X - PONG_BALL_RADIUS
  }

  if (nextX + PONG_BALL_RADIUS < 0) return awardPoint(state, 'opponent', nextOpponentY)
  if (nextX - PONG_BALL_RADIUS > PONG_WIDTH) return awardPoint(state, 'player', nextOpponentY)

  return { ...state, ball: { x: nextX, y: nextY, vx, vy }, opponentY: nextOpponentY }
}

function awardPoint(state: PongState, scorer: 'player' | 'opponent', opponentY: number): PongState {
  const score = state.score + (scorer === 'player' ? 1 : 0)
  const opponentScore = state.opponentScore + (scorer === 'opponent' ? 1 : 0)
  const winner = score >= PONG_WIN_SCORE ? 'player' : opponentScore >= PONG_WIN_SCORE ? 'opponent' : null
  const message = winner === 'player'
    ? `Match won ${score} to ${opponentScore}. Play again for another match.`
    : winner === 'opponent'
      ? `The computer won ${opponentScore} to ${score}. Start another match when ready.`
      : scorer === 'player'
        ? `Point for you. ${score} to ${opponentScore}. Serve when ready.`
        : `Point for the computer. ${score} to ${opponentScore}. Serve when ready.`

  return {
    ...state,
    phase: winner ? 'over' : 'ready',
    ball: startingBall(scorer === 'player' ? 1 : -1),
    opponentY,
    score,
    opponentScore,
    winner,
    message,
  }
}

function startingBall(direction: -1 | 1) {
  return { x: PONG_WIDTH / 2, y: PONG_HEIGHT / 2, vx: direction * 4.4, vy: 2.2 }
}

function paddleBounce(vx: number, vy: number, offset: number, direction: -1 | 1) {
  const speed = Math.min(8.5, Math.hypot(vx, vy) + 0.08)
  const angle = offset * 0.95
  return { vx: direction * Math.cos(angle) * speed, vy: Math.sin(angle) * speed }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
