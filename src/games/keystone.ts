export const KEYSTONE_BOARD_SIZE = 7
export const KEYSTONE_STAGE_COUNT = 4

export type KeystoneDirection = 'up' | 'right' | 'down' | 'left'
export type KeystonePhase = 'ready' | 'playing' | 'paused' | 'complete'

export interface KeystonePuzzle {
  title: string
  hint: string
  walls: number[]
  start: number
  crates: number[]
  switches: number[]
  doors: number[]
  exit: number
}

interface KeystoneSnapshot {
  player: number
  crates: number[]
  moves: number
  stageMoves: number
  pushes: number
}

export interface KeystoneState {
  phase: KeystonePhase
  stageIndex: number
  player: number
  crates: number[]
  moves: number
  stageMoves: number
  pushes: number
  completedStageMoves: number[]
  history: KeystoneSnapshot[]
  message: string
}

export const KEYSTONE_PUZZLES: readonly KeystonePuzzle[] = [
  {
    title: 'First Press',
    hint: 'Push the block onto the socket, then walk around it to the door.',
    walls: [cell(2, 5)],
    start: cell(3, 1),
    crates: [cell(3, 2)],
    switches: [cell(3, 3)],
    doors: [cell(3, 4)],
    exit: cell(3, 5),
  },
  {
    title: 'Corner Key',
    hint: 'The socket is below the block. Get above it before pushing down.',
    walls: [cell(1, 4), cell(2, 4), cell(3, 4), cell(4, 4)],
    start: cell(1, 1),
    crates: [cell(2, 2)],
    switches: [cell(4, 2)],
    doors: [cell(3, 5)],
    exit: cell(2, 5),
  },
  {
    title: 'Double Lock',
    hint: 'Both sockets must stay covered to hold the paired lock open.',
    walls: [cell(3, 3)],
    start: cell(5, 1),
    crates: [cell(3, 2), cell(3, 4)],
    switches: [cell(1, 2), cell(1, 4)],
    doors: [cell(2, 5)],
    exit: cell(1, 5),
  },
  {
    title: 'Crossed Hall',
    hint: 'Set one block left and the other right. The center wall divides the hall.',
    walls: [cell(1, 4), cell(3, 2), cell(3, 4)],
    start: cell(5, 3),
    crates: [cell(2, 3), cell(4, 3)],
    switches: [cell(2, 1), cell(4, 5)],
    doors: [cell(2, 5), cell(3, 5)],
    exit: cell(1, 5),
  },
]

export function keystoneCell(row: number, column: number): number {
  return row * KEYSTONE_BOARD_SIZE + column
}

export function keystoneRow(index: number): number {
  return Math.floor(index / KEYSTONE_BOARD_SIZE)
}

export function keystoneColumn(index: number): number {
  return index % KEYSTONE_BOARD_SIZE
}

export function createKeystoneState(): KeystoneState {
  const puzzle = KEYSTONE_PUZZLES[0]!
  return {
    phase: 'ready',
    stageIndex: 0,
    player: puzzle.start,
    crates: [...puzzle.crates],
    moves: 0,
    stageMoves: 0,
    pushes: 0,
    completedStageMoves: [],
    history: [],
    message: 'Push every block onto a floor socket to open the door, then reach the exit.',
  }
}

export function startKeystone(_state: KeystoneState): KeystoneState {
  return { ...createKeystoneState(), phase: 'playing', message: 'First Press is live. Cover the socket to open its door.' }
}

export function pauseKeystone(state: KeystoneState): KeystoneState {
  return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Chamber paused. Your blocks and move count are held.' } : state
}

export function resumeKeystone(state: KeystoneState): KeystoneState {
  return state.phase === 'paused' ? { ...state, phase: 'playing', message: `${KEYSTONE_PUZZLES[state.stageIndex]!.title} is live.` } : state
}

export function restartKeystone(_state: KeystoneState): KeystoneState {
  return createKeystoneState()
}

export function moveKeystone(state: KeystoneState, direction: KeystoneDirection): KeystoneState {
  if (state.phase !== 'playing') return state
  const offset = direction === 'up' ? -KEYSTONE_BOARD_SIZE
    : direction === 'right' ? 1
      : direction === 'down' ? KEYSTONE_BOARD_SIZE : -1
  const destination = state.player + offset
  if (!isInsideBoard(destination)
    || ((direction === 'left' || direction === 'right') && keystoneRow(destination) !== keystoneRow(state.player))) return state

  const puzzle = KEYSTONE_PUZZLES[state.stageIndex]!
  const crates = [...state.crates]
  let pushes = state.pushes
  const crateIndex = crates.indexOf(destination)
  const doorsOpen = allSocketsCovered(puzzle, crates)
  if (crateIndex >= 0) {
    const crateDestination = destination + offset
    if (!canOccupy(puzzle, crateDestination, doorsOpen)
      || ((direction === 'left' || direction === 'right') && keystoneRow(crateDestination) !== keystoneRow(destination))
      || crates.includes(crateDestination)) return state
    crates[crateIndex] = crateDestination
    pushes += 1
  } else if (!canOccupy(puzzle, destination, doorsOpen)) {
    return state
  }

  const moves = state.moves + 1
  const stageMoves = state.stageMoves + 1
  const completedStageMoves = [...state.completedStageMoves]
  const nextHistory = [...state.history, snapshot(state)]
  if (destination === puzzle.exit && allSocketsCovered(puzzle, crates)) {
    completedStageMoves.push(stageMoves)
    if (state.stageIndex === KEYSTONE_PUZZLES.length - 1) {
      return {
        ...state,
        phase: 'complete',
        player: destination,
        crates,
        moves,
        stageMoves,
        pushes,
        completedStageMoves,
        history: [],
        message: `All four doors open. Chamber clear in ${moves} moves. Your local best is saved in this browser.`,
      }
    }
    const nextIndex = state.stageIndex + 1
    const nextPuzzle = KEYSTONE_PUZZLES[nextIndex]!
    return {
      ...state,
      stageIndex: nextIndex,
      player: nextPuzzle.start,
      crates: [...nextPuzzle.crates],
      moves,
      stageMoves: 0,
      pushes,
      completedStageMoves,
      history: [],
      message: `${puzzle.title} opened. ${nextPuzzle.title} is ready.`,
    }
  }

  return {
    ...state,
    player: destination,
    crates,
    moves,
    stageMoves,
    pushes,
    history: nextHistory,
    message: crateIndex >= 0 ? 'Block pushed. Line up the next socket.' : 'Step placed.',
  }
}

export function undoKeystone(state: KeystoneState): KeystoneState {
  if (state.phase !== 'playing' || state.history.length === 0) return state
  const history = [...state.history]
  const previous = history.pop()!
  return {
    ...state,
    player: previous.player,
    crates: [...previous.crates],
    moves: previous.moves,
    stageMoves: previous.stageMoves,
    pushes: previous.pushes,
    history,
    message: 'Last step undone.',
  }
}

export function allSocketsCovered(puzzle: KeystonePuzzle, crates: readonly number[]): boolean {
  return puzzle.switches.every((socket) => crates.includes(socket))
}

function canOccupy(puzzle: KeystonePuzzle, index: number, doorsOpen: boolean): boolean {
  if (!isInsideBoard(index) || puzzle.walls.includes(index)) return false
  return doorsOpen || !puzzle.doors.includes(index)
}

function isInsideBoard(index: number): boolean {
  return Number.isInteger(index)
    && index >= 0
    && index < KEYSTONE_BOARD_SIZE * KEYSTONE_BOARD_SIZE
    && keystoneRow(index) > 0
    && keystoneRow(index) < KEYSTONE_BOARD_SIZE - 1
    && keystoneColumn(index) > 0
    && keystoneColumn(index) < KEYSTONE_BOARD_SIZE - 1
}

function snapshot(state: KeystoneState): KeystoneSnapshot {
  return { player: state.player, crates: [...state.crates], moves: state.moves, stageMoves: state.stageMoves, pushes: state.pushes }
}

function cell(row: number, column: number): number {
  return keystoneCell(row, column)
}
