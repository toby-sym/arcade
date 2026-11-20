export const PEGLINE_BOARD_SIZE = 5
export const PEGLINE_STAGE_COUNT = 3

export type PeglineCell = 0 | 1 | 2
export type PeglinePhase = 'ready' | 'playing' | 'paused' | 'stage-clear' | 'stuck' | 'complete'

export interface PeglinePuzzle {
  title: string
  layout: readonly string[]
  startingPegs: readonly number[]
  target: number
}

export interface PeglineState {
  phase: PeglinePhase
  stageIndex: number
  board: PeglineCell[]
  selectedCell: number | null
  moves: number
  stageMoves: number
  message: string
}

export const PEGLINE_PUZZLES: readonly PeglinePuzzle[] = [
  {
    title: 'Quiet Diamond',
    layout: ['..#..', '.###.', '#####', '.###.', '..#..'],
    startingPegs: [cell(0, 2), cell(1, 2), cell(2, 0), cell(2, 1), cell(3, 2), cell(4, 2)],
    target: cell(2, 2),
  },
  {
    title: 'Open Cross',
    layout: ['..#..', '#####', '#####', '#####', '..#..'],
    startingPegs: [cell(1, 1), cell(1, 2), cell(1, 3), cell(2, 0), cell(2, 3), cell(3, 1), cell(3, 2), cell(3, 4), cell(4, 2)],
    target: cell(2, 2),
  },
  {
    title: 'Roundhouse',
    layout: ['.###.', '#####', '#####', '#####', '.###.'],
    startingPegs: [cell(1, 1), cell(1, 2), cell(1, 3), cell(2, 0), cell(2, 1), cell(3, 1), cell(3, 2), cell(3, 3), cell(4, 1), cell(4, 2), cell(4, 3)],
    target: cell(2, 2),
  },
]

export function peglineCell(row: number, column: number): number {
  return row * PEGLINE_BOARD_SIZE + column
}

export function peglineRow(index: number): number {
  return Math.floor(index / PEGLINE_BOARD_SIZE)
}

export function peglineColumn(index: number): number {
  return index % PEGLINE_BOARD_SIZE
}

export function createPeglineState(): PeglineState {
  return {
    phase: 'ready',
    stageIndex: 0,
    board: makeBoard(PEGLINE_PUZZLES[0]!),
    selectedCell: null,
    moves: 0,
    stageMoves: 0,
    message: 'Jump one peg over another. Leave one peg on the center target.',
  }
}

export function startPegline(state: PeglineState): PeglineState {
  return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Select a peg, then choose a highlighted socket to jump into.' } : state
}

export function selectPeglineCell(state: PeglineState, index: number): PeglineState {
  if (state.phase !== 'playing' || !isCellIndex(index) || state.board[index] === 0) return state
  if (state.board[index] === 2) {
    const selectedCell = state.selectedCell === index ? null : index
    return {
      ...state,
      selectedCell,
      message: selectedCell === null ? 'Peg deselected.' : 'Peg selected. Jump to a highlighted empty socket.',
    }
  }
  if (state.selectedCell === null) return { ...state, message: 'Select a peg before choosing an empty socket.' }
  return movePegline(state, state.selectedCell, index)
}

export function movePegline(state: PeglineState, from: number, to: number): PeglineState {
  if (state.phase !== 'playing' || !isValidPeglineMove(state.board, from, to)) return state
  const board = [...state.board]
  const middle = middleCell(from, to)
  board[from] = 1
  board[middle] = 1
  board[to] = 2
  const moves = state.moves + 1
  const stageMoves = state.stageMoves + 1
  const pegsLeft = countPegs(board)
  const puzzle = PEGLINE_PUZZLES[state.stageIndex]!

  if (pegsLeft === 1) {
    if (board[puzzle.target] !== 2) {
      return { ...state, board, selectedCell: null, moves, stageMoves, phase: 'stuck', message: 'One peg remains outside the target. Restart this board and try another route.' }
    }
    const isFinalBoard = state.stageIndex === PEGLINE_PUZZLES.length - 1
    return {
      ...state,
      board,
      selectedCell: null,
      moves,
      stageMoves,
      phase: isFinalBoard ? 'complete' : 'stage-clear',
      message: isFinalBoard
        ? `Three boards cleared in ${moves} moves.`
        : `${puzzle.title} cleared in ${stageMoves} moves. The target peg holds.`,
    }
  }

  if (!hasLegalMove(board)) {
    return { ...state, board, selectedCell: null, moves, stageMoves, phase: 'stuck', message: 'No jumps remain. Restart this board and try another route.' }
  }

  return { ...state, board, selectedCell: null, moves, stageMoves, message: `${pegsLeft} pegs remain. Select the next peg.` }
}

export function peglineTargets(state: PeglineState, from = state.selectedCell): number[] {
  if (state.phase !== 'playing' || from === null || !isCellIndex(from) || state.board[from] !== 2) return []
  return [
    peglineCell(peglineRow(from) - 2, peglineColumn(from)),
    peglineCell(peglineRow(from) + 2, peglineColumn(from)),
    peglineCell(peglineRow(from), peglineColumn(from) - 2),
    peglineCell(peglineRow(from), peglineColumn(from) + 2),
  ].filter((target) => isValidPeglineMove(state.board, from, target))
}

export function isValidPeglineMove(board: readonly PeglineCell[], from: number, to: number): boolean {
  if (!isCellIndex(from) || !isCellIndex(to) || board[from] !== 2 || board[to] !== 1) return false
  const rowDistance = peglineRow(to) - peglineRow(from)
  const columnDistance = peglineColumn(to) - peglineColumn(from)
  if (!((Math.abs(rowDistance) === 2 && columnDistance === 0) || (Math.abs(columnDistance) === 2 && rowDistance === 0))) return false
  return board[middleCell(from, to)] === 2
}

export function pausePegline(state: PeglineState): PeglineState {
  return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Board paused. Your pegs and move count are held.' } : state
}

export function resumePegline(state: PeglineState): PeglineState {
  return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Select a peg, then choose a highlighted socket to jump into.' } : state
}

export function nextPeglineBoard(state: PeglineState): PeglineState {
  if (state.phase !== 'stage-clear' || state.stageIndex >= PEGLINE_PUZZLES.length - 1) return state
  const stageIndex = state.stageIndex + 1
  const puzzle = PEGLINE_PUZZLES[stageIndex]!
  return {
    ...state,
    phase: 'playing',
    stageIndex,
    board: makeBoard(puzzle),
    selectedCell: null,
    stageMoves: 0,
    message: `${puzzle.title} is ready. Leave one peg on the target.`,
  }
}

export function retryPeglineBoard(state: PeglineState): PeglineState {
  if (state.phase !== 'stuck') return state
  return {
    ...state,
    phase: 'playing',
    board: makeBoard(PEGLINE_PUZZLES[state.stageIndex]!),
    selectedCell: null,
    stageMoves: 0,
    message: `${PEGLINE_PUZZLES[state.stageIndex]!.title} reset. The route's total still includes your earlier moves.`,
  }
}

export function restartPegline(_state: PeglineState): PeglineState {
  return createPeglineState()
}

function makeBoard(puzzle: PeglinePuzzle): PeglineCell[] {
  const startingPegs = new Set(puzzle.startingPegs)
  return Array.from({ length: PEGLINE_BOARD_SIZE ** 2 }, (_, index) => {
    const row = peglineRow(index)
    const column = peglineColumn(index)
    if (puzzle.layout[row]?.[column] !== '#') return 0
    return startingPegs.has(index) ? 2 : 1
  })
}

function middleCell(from: number, to: number): number {
  return peglineCell((peglineRow(from) + peglineRow(to)) / 2, (peglineColumn(from) + peglineColumn(to)) / 2)
}

function countPegs(board: readonly PeglineCell[]): number {
  return board.filter((cell) => cell === 2).length
}

function hasLegalMove(board: readonly PeglineCell[]): boolean {
  return board.some((cell, from) => cell === 2 && [
    peglineCell(peglineRow(from) - 2, peglineColumn(from)),
    peglineCell(peglineRow(from) + 2, peglineColumn(from)),
    peglineCell(peglineRow(from), peglineColumn(from) - 2),
    peglineCell(peglineRow(from), peglineColumn(from) + 2),
  ].some((to) => isValidPeglineMove(board, from, to)))
}

function isCellIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < PEGLINE_BOARD_SIZE ** 2
}

function cell(row: number, column: number): number {
  return peglineCell(row, column)
}
