export const BLOCK_DROP_WIDTH = 10
export const BLOCK_DROP_HEIGHT = 20
export const BLOCK_TYPES = ['i', 'j', 'l', 'o', 's', 't', 'z'] as const

export type BlockType = typeof BLOCK_TYPES[number]
export type BlockPhase = 'ready' | 'playing' | 'paused' | 'over'
export type RotationDirection = -1 | 1

export interface BlockPiece {
  type: BlockType
  rotation: number
  x: number
  y: number
}

export interface BlockDropState {
  phase: BlockPhase
  board: (BlockType | null)[][]
  current: BlockPiece
  next: BlockType[]
  hold: BlockType | null
  canHold: boolean
  score: number
  lines: number
  level: number
  randomSeed: number
  message: string
}

export type BlockDropAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'move'; dx: number }
  | { type: 'rotate'; direction: RotationDirection }
  | { type: 'softDrop' }
  | { type: 'hardDrop' }
  | { type: 'hold' }
  | { type: 'tick' }

const SHAPES: Record<BlockType, Array<[number, number]>> = {
  i: [[0, 1], [1, 1], [2, 1], [3, 1]],
  j: [[0, 0], [0, 1], [1, 1], [2, 1]],
  l: [[2, 0], [0, 1], [1, 1], [2, 1]],
  o: [[1, 0], [2, 0], [1, 1], [2, 1]],
  s: [[1, 0], [2, 0], [0, 1], [1, 1]],
  t: [[1, 0], [0, 1], [1, 1], [2, 1]],
  z: [[0, 0], [1, 0], [1, 1], [2, 1]],
}

const EMPTY_ROW = (): (BlockType | null)[] => Array(BLOCK_DROP_WIDTH).fill(null)

export function createBlockDropState(seed = randomSeed()): BlockDropState {
  const bag = shuffleBag(normalizeSeed(seed))
  return {
    phase: 'ready',
    board: Array.from({ length: BLOCK_DROP_HEIGHT }, EMPTY_ROW),
    current: { type: bag.pieces[0]!, rotation: 0, x: 3, y: -1 },
    next: bag.pieces.slice(1),
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    randomSeed: bag.seed,
    message: 'Stack the blocks. Clear rows to keep the board open.',
  }
}

export function blockDropReducer(state: BlockDropState, action: BlockDropAction): BlockDropState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Find a fit. Clear rows to score.' } : state
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Game paused.' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Back to the stack.' } : state
    case 'restart':
      return createBlockDropState()
    case 'move':
      return movePiece(state, action.dx)
    case 'rotate':
      return rotatePiece(state, action.direction)
    case 'softDrop':
      return softDrop(state)
    case 'hardDrop':
      return hardDrop(state)
    case 'hold':
      return holdPiece(state)
    case 'tick':
      return tickPiece(state)
  }
}

export function getPieceCells(piece: BlockPiece): Array<{ x: number; y: number }> {
  let cells = SHAPES[piece.type].map(([x, y]) => ({ x, y }))
  if (piece.type === 'o') return cells

  const rotationSize = piece.type === 'i' ? 4 : 3
  const turns = ((piece.rotation % 4) + 4) % 4
  for (let turn = 0; turn < turns; turn += 1) {
    cells = cells.map(({ x, y }) => ({ x: rotationSize - 1 - y, y: x }))
  }
  return cells
}

export function canPlacePiece(board: BlockDropState['board'], piece: BlockPiece): boolean {
  return getPieceCells(piece).every(({ x, y }) => {
    const boardX = piece.x + x
    const boardY = piece.y + y
    if (boardX < 0 || boardX >= BLOCK_DROP_WIDTH || boardY >= BLOCK_DROP_HEIGHT) return false
    return boardY < 0 || board[boardY]?.[boardX] === null
  })
}

export function getGhostY(state: BlockDropState): number {
  let y = state.current.y
  while (canPlacePiece(state.board, { ...state.current, y: y + 1 })) y += 1
  return y
}

export function gravityInterval(level: number): number {
  return Math.max(80, 800 - (Math.max(1, level) - 1) * 65)
}

function movePiece(state: BlockDropState, dx: number): BlockDropState {
  if (state.phase !== 'playing' || !Number.isInteger(dx) || dx === 0) return state
  const current = { ...state.current, x: state.current.x + Math.sign(dx) }
  return canPlacePiece(state.board, current) ? { ...state, current } : state
}

function rotatePiece(state: BlockDropState, direction: RotationDirection): BlockDropState {
  if (state.phase !== 'playing') return state
  const rotation = (state.current.rotation + direction + 4) % 4
  const kicks = [0, -1, 1, -2, 2, -3, 3]
  for (const dx of kicks) {
    const current = { ...state.current, rotation, x: state.current.x + dx }
    if (canPlacePiece(state.board, current)) return { ...state, current }
  }
  return state
}

function softDrop(state: BlockDropState): BlockDropState {
  if (state.phase !== 'playing') return state
  const current = { ...state.current, y: state.current.y + 1 }
  return canPlacePiece(state.board, current)
    ? { ...state, current, score: state.score + 1 }
    : lockPiece(state)
}

function hardDrop(state: BlockDropState): BlockDropState {
  if (state.phase !== 'playing') return state
  const ghostY = getGhostY(state)
  const distance = Math.max(0, ghostY - state.current.y)
  return lockPiece({ ...state, current: { ...state.current, y: ghostY }, score: state.score + distance * 2 })
}

function tickPiece(state: BlockDropState): BlockDropState {
  if (state.phase !== 'playing') return state
  const current = { ...state.current, y: state.current.y + 1 }
  return canPlacePiece(state.board, current) ? { ...state, current } : lockPiece(state)
}

function holdPiece(state: BlockDropState): BlockDropState {
  if (state.phase !== 'playing' || !state.canHold) return state
  if (state.hold) {
    const current = spawnPiece(state.hold)
    if (!canPlacePiece(state.board, current)) return { ...state, phase: 'over', current, canHold: false, message: 'The stack is full. Game over.' }
    return { ...state, current, hold: state.current.type, canHold: false, message: 'Piece held. Make room for the next block.' }
  }

  const next = takeNextPiece(state.next, state.randomSeed)
  if (!canPlacePiece(state.board, spawnPiece(next.piece))) {
    return { ...state, phase: 'over', hold: state.current.type, next: next.queue, randomSeed: next.seed, canHold: false, message: 'The stack is full. Game over.' }
  }
  return { ...state, current: spawnPiece(next.piece), hold: state.current.type, next: next.queue, randomSeed: next.seed, canHold: false, message: 'Piece held. Make room for the next block.' }
}

function lockPiece(state: BlockDropState): BlockDropState {
  const board = state.board.map((row) => [...row])
  for (const cell of getPieceCells(state.current)) {
    const x = state.current.x + cell.x
    const y = state.current.y + cell.y
    if (y < 0) return { ...state, phase: 'over', board, message: 'The stack is full. Game over.' }
    const row = board[y]
    if (row) row[x] = state.current.type
  }

  const remainingRows = board.filter((row) => row.some((cell) => cell === null))
  const cleared = BLOCK_DROP_HEIGHT - remainingRows.length
  const nextBoard = [...Array.from({ length: cleared }, EMPTY_ROW), ...remainingRows]
  const lines = state.lines + cleared
  const level = Math.floor(lines / 10) + 1
  const linePoints = [0, 100, 300, 500, 800][cleared] ?? 0
  const score = state.score + linePoints * state.level
  const next = takeNextPiece(state.next, state.randomSeed)
  const current = spawnPiece(next.piece)
  if (!canPlacePiece(nextBoard, current)) {
    return { ...state, phase: 'over', board: nextBoard, next: next.queue, randomSeed: next.seed, score, lines, level, canHold: false, message: 'The stack is full. Game over.' }
  }

  return {
    ...state,
    board: nextBoard,
    current,
    next: next.queue,
    randomSeed: next.seed,
    canHold: true,
    score,
    lines,
    level,
    message: cleared > 0 ? `${cleared} ${cleared === 1 ? 'row' : 'rows'} cleared.` : state.message,
  }
}

function spawnPiece(type: BlockType): BlockPiece {
  return { type, rotation: 0, x: 3, y: -1 }
}

function takeNextPiece(queue: BlockType[], seed: number): { piece: BlockType; queue: BlockType[]; seed: number } {
  let nextQueue = queue
  let nextSeed = seed
  if (nextQueue.length === 0) {
    const bag = shuffleBag(seed)
    nextQueue = bag.pieces
    nextSeed = bag.seed
  }
  return { piece: nextQueue[0]!, queue: nextQueue.slice(1), seed: nextSeed }
}

function shuffleBag(seed: number): { pieces: BlockType[]; seed: number } {
  const pieces = [...BLOCK_TYPES]
  let nextSeed = seed
  for (let index = pieces.length - 1; index > 0; index -= 1) {
    const next = nextRandom(nextSeed)
    nextSeed = next.seed
    const swapIndex = Math.floor(next.value * (index + 1))
    ;[pieces[index], pieces[swapIndex]] = [pieces[swapIndex]!, pieces[index]!]
  }
  return { pieces, seed: nextSeed }
}

function nextRandom(seed: number): { value: number; seed: number } {
  let value = seed || 0x9e3779b9
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  const nextSeed = value >>> 0
  return { value: nextSeed / 0x1_0000_0000, seed: nextSeed }
}

function normalizeSeed(seed: number): number {
  if (!Number.isSafeInteger(seed)) return randomSeed()
  return (seed >>> 0) || 0x9e3779b9
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffff_ffff) || 0x9e3779b9
}
