export const BOARD_SIZE = 18

export type Point = { x: number; y: number }
export type Direction = 'up' | 'right' | 'down' | 'left'
export type SnakeStatus = 'ready' | 'playing' | 'paused' | 'over' | 'won'

export type SnakeState = {
  snake: Point[]
  food: Point | null
  direction: Direction
  nextDirection: Direction | null
  status: SnakeStatus
  score: number
}

export type SnakeAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'turn'; direction: Direction }
  | { type: 'tick'; foodRoll: number }
  | { type: 'restart'; foodRoll: number }

const opposite: Record<Direction, Direction> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
}

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y
}

function placeFood(snake: Point[], roll: number): Point | null {
  const occupied = new Set(snake.map(({ x, y }) => `${x},${y}`))
  const open: Point[] = []

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!occupied.has(`${x},${y}`)) open.push({ x, y })
    }
  }

  if (open.length === 0) return null
  const safeRoll = Math.min(Math.max(roll, 0), 0.999999999)
  return open[Math.floor(safeRoll * open.length)] ?? null
}

export function createSnakeState(foodRoll = Math.random()): SnakeState {
  const center = Math.floor(BOARD_SIZE / 2)
  const snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ]

  return {
    snake,
    food: placeFood(snake, foodRoll),
    direction: 'right',
    nextDirection: null,
    status: 'ready',
    score: 0,
  }
}

export function turnSnake(state: SnakeState, direction: Direction): SnakeState {
  if (state.status !== 'playing') return state
  const current = state.nextDirection ?? state.direction
  if (opposite[current] === direction) return state
  return { ...state, nextDirection: direction }
}

export function stepSnake(state: SnakeState, foodRoll: number): SnakeState {
  if (state.status !== 'playing' || state.food === null) return state

  const direction = state.nextDirection ?? state.direction
  const head = state.snake[0]
  if (!head) return { ...state, status: 'over' }

  const delta: Record<Direction, Point> = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  }
  const nextHead = {
    x: head.x + delta[direction].x,
    y: head.y + delta[direction].y,
  }
  const eating = samePoint(nextHead, state.food)
  const bodyToCheck = eating ? state.snake : state.snake.slice(0, -1)
  const hitsWall =
    nextHead.x < 0 ||
    nextHead.x >= BOARD_SIZE ||
    nextHead.y < 0 ||
    nextHead.y >= BOARD_SIZE
  const hitsBody = bodyToCheck.some((segment) => samePoint(segment, nextHead))

  if (hitsWall || hitsBody) {
    return { ...state, direction, nextDirection: null, status: 'over' }
  }

  const snake = [nextHead, ...state.snake.slice(0, eating ? undefined : -1)]
  const food = eating ? placeFood(snake, foodRoll) : state.food

  return {
    ...state,
    snake,
    food,
    direction,
    nextDirection: null,
    score: state.score + (eating ? 1 : 0),
    status: eating && food === null ? 'won' : 'playing',
  }
}

export function snakeReducer(state: SnakeState, action: SnakeAction): SnakeState {
  switch (action.type) {
    case 'start':
      return state.status === 'ready' || state.status === 'paused'
        ? { ...state, status: 'playing' }
        : state
    case 'pause':
      return state.status === 'playing'
        ? { ...state, status: 'paused' }
        : state.status === 'paused'
          ? { ...state, status: 'playing' }
          : state
    case 'turn':
      return turnSnake(state, action.direction)
    case 'tick':
      return stepSnake(state, action.foodRoll)
    case 'restart':
      return createSnakeState(action.foodRoll)
  }
}
