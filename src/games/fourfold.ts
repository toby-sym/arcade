export const FOURFOLD_COLUMNS = 7
export const FOURFOLD_ROWS = 6
export const FOURFOLD_CELL_COUNT = FOURFOLD_COLUMNS * FOURFOLD_ROWS
export const FOURFOLD_CENTER_ORDER = [3, 2, 4, 1, 5, 0, 6] as const

export type FourfoldDisc = 0 | 1 | 2
export type FourfoldPhase = 'ready' | 'player-turn' | 'cpu-turn' | 'paused' | 'won' | 'lost' | 'draw'
export type FourfoldSide = 'player' | 'cpu'

export interface FourfoldState {
  phase: FourfoldPhase
  board: FourfoldDisc[]
  streak: number
  pausedPhase: 'player-turn' | 'cpu-turn' | null
  message: string
}

export function createFourfoldState(): FourfoldState {
  return { phase: 'ready', board: Array<FourfoldDisc>(FOURFOLD_CELL_COUNT).fill(0), streak: 0, pausedPhase: null, message: 'Make a line of four before the local opponent does.' }
}

export function startFourfold(state: FourfoldState): FourfoldState {
  return state.phase === 'ready' ? { ...state, phase: 'player-turn', message: 'Your move. A winning line can run in any direction.' } : state
}

export function dropFourfold(state: FourfoldState, column: number): FourfoldState {
  if (state.phase !== 'player-turn' || !isValidColumn(column)) return state
  const row = findOpenRow(state.board, column)
  if (row < 0) return { ...state, message: `Column ${column + 1} is full. Choose another.` }
  const board = [...state.board]
  board[cellIndex(row, column)] = 1
  if (hasFour(board, 1)) {
    const streak = state.streak + 1
    return { ...state, board, phase: 'won', streak, message: `Four in a row. Your win streak is ${streak}.` }
  }
  if (isFull(board)) return { ...state, board, phase: 'draw', message: 'The board is full. No line this round.' }
  return { ...state, board, phase: 'cpu-turn', message: 'Your disc is down. The local opponent is choosing.' }
}

export function playFourfoldCpuTurn(state: FourfoldState): FourfoldState {
  if (state.phase !== 'cpu-turn') return state
  const column = chooseFourfoldMove(state.board)
  if (column < 0) return { ...state, phase: 'draw', message: 'The board is full. No line this round.' }
  const row = findOpenRow(state.board, column)
  const board = [...state.board]
  board[cellIndex(row, column)] = 2
  if (hasFour(board, 2)) return { ...state, board, phase: 'lost', streak: 0, message: 'The opponent found a line. Your win streak resets.' }
  if (isFull(board)) return { ...state, board, phase: 'draw', message: 'The board is full. No line this round.' }
  return { ...state, board, phase: 'player-turn', message: 'Opponent moved. Your turn.' }
}

export function newFourfoldRound(state: FourfoldState): FourfoldState {
  if (state.phase !== 'won' && state.phase !== 'lost' && state.phase !== 'draw') return state
  const message = state.streak > 0 ? `Next board. Win streak: ${state.streak}.` : 'Next board. Make the first line.'
  return { ...state, phase: 'player-turn', board: Array<FourfoldDisc>(FOURFOLD_CELL_COUNT).fill(0), pausedPhase: null, message }
}

export function restartFourfold(state: FourfoldState): FourfoldState {
  return { ...createFourfoldState(), phase: state.phase === 'ready' ? 'ready' : 'player-turn' }
}

export function pauseFourfold(state: FourfoldState): FourfoldState {
  if (state.phase !== 'player-turn' && state.phase !== 'cpu-turn') return state
  return { ...state, phase: 'paused', pausedPhase: state.phase, message: 'Match paused.' }
}

export function resumeFourfold(state: FourfoldState): FourfoldState {
  if (state.phase !== 'paused') return state
  const phase = state.pausedPhase ?? 'player-turn'
  return { ...state, phase, pausedPhase: null, message: phase === 'cpu-turn' ? 'The local opponent is choosing.' : 'Your move.' }
}

export function chooseFourfoldMove(board: readonly FourfoldDisc[]): number {
  const legalColumns = FOURFOLD_CENTER_ORDER.filter((column) => findOpenRow(board, column) >= 0)
  if (legalColumns.length === 0) return -1

  let bestColumn = legalColumns[0]!
  let bestScore = Number.NEGATIVE_INFINITY
  let alpha = Number.NEGATIVE_INFINITY
  const beta = Number.POSITIVE_INFINITY
  for (const column of legalColumns) {
    const row = findOpenRow(board, column)
    const next = [...board]
    next[cellIndex(row, column)] = 2
    const score = hasFour(next, 2) ? 1_000_000 : search(next, 3, alpha, beta, false)
    if (score > bestScore) {
      bestScore = score
      bestColumn = column
    }
    alpha = Math.max(alpha, bestScore)
  }
  return bestColumn
}

export function getFourfoldCell(board: readonly FourfoldDisc[], row: number, column: number): FourfoldDisc {
  if (row < 0 || row >= FOURFOLD_ROWS || column < 0 || column >= FOURFOLD_COLUMNS) return 0
  return board[cellIndex(row, column)] ?? 0
}

export function hasFour(board: readonly FourfoldDisc[], side: FourfoldSide | FourfoldDisc): boolean {
  const disc = side === 'player' ? 1 : side === 'cpu' ? 2 : side
  if (disc !== 1 && disc !== 2) return false
  for (let row = 0; row < FOURFOLD_ROWS; row += 1) {
    for (let column = 0; column < FOURFOLD_COLUMNS; column += 1) {
      if (getFourfoldCell(board, row, column) !== disc) continue
      if (hasRun(board, row, column, 0, 1, disc)
        || hasRun(board, row, column, 1, 0, disc)
        || hasRun(board, row, column, 1, 1, disc)
        || hasRun(board, row, column, 1, -1, disc)) return true
    }
  }
  return false
}

function search(board: FourfoldDisc[], depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (hasFour(board, 2)) return 1_000_000 + depth
  if (hasFour(board, 1)) return -1_000_000 - depth
  if (depth === 0 || isFull(board)) return evaluate(board)

  const legalColumns = FOURFOLD_CENTER_ORDER.filter((column) => findOpenRow(board, column) >= 0)
  if (maximizing) {
    let score = Number.NEGATIVE_INFINITY
    for (const column of legalColumns) {
      const row = findOpenRow(board, column)
      const next = [...board]
      next[cellIndex(row, column)] = 2
      score = Math.max(score, search(next, depth - 1, alpha, beta, false))
      alpha = Math.max(alpha, score)
      if (alpha >= beta) break
    }
    return score
  }

  let score = Number.POSITIVE_INFINITY
  for (const column of legalColumns) {
    const row = findOpenRow(board, column)
    const next = [...board]
    next[cellIndex(row, column)] = 1
    score = Math.min(score, search(next, depth - 1, alpha, beta, true))
    beta = Math.min(beta, score)
    if (alpha >= beta) break
  }
  return score
}

function evaluate(board: readonly FourfoldDisc[]): number {
  let score = 0
  for (let row = 0; row < FOURFOLD_ROWS; row += 1) {
    const centerDisc = getFourfoldCell(board, row, 3)
    score += centerDisc === 2 ? 4 : centerDisc === 1 ? -4 : 0
    for (let column = 0; column < FOURFOLD_COLUMNS; column += 1) {
      for (const [rowStep, columnStep] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const) {
        const endRow = row + rowStep * 3
        const endColumn = column + columnStep * 3
        if (endRow < 0 || endRow >= FOURFOLD_ROWS || endColumn < 0 || endColumn >= FOURFOLD_COLUMNS) continue
        const window = Array.from({ length: 4 }, (_, offset) => getFourfoldCell(board, row + rowStep * offset, column + columnStep * offset))
        const cpu = window.filter((disc) => disc === 2).length
        const player = window.filter((disc) => disc === 1).length
        if (cpu > 0 && player > 0) continue
        if (cpu > 0) score += [0, 2, 12, 72, 0][cpu]!
        if (player > 0) score -= [0, 3, 20, 100, 0][player]!
      }
    }
  }
  return score
}

function hasRun(board: readonly FourfoldDisc[], row: number, column: number, rowStep: number, columnStep: number, disc: FourfoldDisc): boolean {
  for (let offset = 1; offset < 4; offset += 1) {
    if (getFourfoldCell(board, row + rowStep * offset, column + columnStep * offset) !== disc) return false
  }
  return true
}

function findOpenRow(board: readonly FourfoldDisc[], column: number): number {
  for (let row = FOURFOLD_ROWS - 1; row >= 0; row -= 1) {
    if (getFourfoldCell(board, row, column) === 0) return row
  }
  return -1
}

function isFull(board: readonly FourfoldDisc[]): boolean {
  return board.length === FOURFOLD_CELL_COUNT && board.every((disc) => disc !== 0)
}

function isValidColumn(column: number): boolean {
  return Number.isInteger(column) && column >= 0 && column < FOURFOLD_COLUMNS
}

function cellIndex(row: number, column: number): number {
  return row * FOURFOLD_COLUMNS + column
}
