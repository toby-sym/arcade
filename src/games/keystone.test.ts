import { describe, expect, it } from 'vitest'
import {
  allSocketsCovered,
  createKeystoneState,
  KEYSTONE_BOARD_SIZE,
  KEYSTONE_PUZZLES,
  moveKeystone,
  pauseKeystone,
  restartKeystone,
  resumeKeystone,
  startKeystone,
  undoKeystone,
  type KeystoneDirection,
  type KeystonePuzzle,
} from './keystone'

const directions: Array<{ direction: KeystoneDirection; offset: number }> = [
  { direction: 'up', offset: -KEYSTONE_BOARD_SIZE },
  { direction: 'right', offset: 1 },
  { direction: 'down', offset: KEYSTONE_BOARD_SIZE },
  { direction: 'left', offset: -1 },
]

function findSolution(puzzle: KeystonePuzzle): KeystoneDirection[] | null {
  const queue: Array<{ player: number; crates: number[]; route: KeystoneDirection[] }> = [
    { player: puzzle.start, crates: [...puzzle.crates], route: [] },
  ]
  const visited = new Set<string>()
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!
    const key = `${current.player}|${[...current.crates].sort((a, b) => a - b).join(',')}`
    if (visited.has(key)) continue
    visited.add(key)
    if (current.player === puzzle.exit && allSocketsCovered(puzzle, current.crates)) return current.route
    const doorsOpen = allSocketsCovered(puzzle, current.crates)
    for (const { direction, offset } of directions) {
      const destination = current.player + offset
      if (!insideBoard(destination) || puzzle.walls.includes(destination) || (!doorsOpen && puzzle.doors.includes(destination))) continue
      if ((direction === 'left' || direction === 'right') && row(destination) !== row(current.player)) continue
      const crates = [...current.crates]
      const crate = crates.indexOf(destination)
      if (crate >= 0) {
        const beyond = destination + offset
        if (!insideBoard(beyond) || puzzle.walls.includes(beyond) || (!doorsOpen && puzzle.doors.includes(beyond)) || crates.includes(beyond)) continue
        if ((direction === 'left' || direction === 'right') && row(beyond) !== row(destination)) continue
        crates[crate] = beyond
      }
      queue.push({ player: destination, crates, route: [...current.route, direction] })
    }
  }
  return null
}

function insideBoard(index: number): boolean {
  return row(index) > 0 && row(index) < KEYSTONE_BOARD_SIZE - 1 && index % KEYSTONE_BOARD_SIZE > 0 && index % KEYSTONE_BOARD_SIZE < KEYSTONE_BOARD_SIZE - 1
}

function row(index: number): number {
  return Math.floor(index / KEYSTONE_BOARD_SIZE)
}

describe('Keystone switch-and-door chambers', () => {
  it('starts with a fresh room and moves each block onto its matching socket', () => {
    expect(KEYSTONE_PUZZLES).toHaveLength(4)
    const ready = createKeystoneState()
    expect(ready).toMatchObject({ phase: 'ready', stageIndex: 0, moves: 0, player: KEYSTONE_PUZZLES[0]!.start })
    const started = startKeystone(ready)
    const pushed = moveKeystone(started, 'right')
    expect(pushed).toMatchObject({ player: KEYSTONE_PUZZLES[0]!.start + 1, crates: [KEYSTONE_PUZZLES[0]!.switches[0]], moves: 1, pushes: 1 })
    expect(allSocketsCovered(KEYSTONE_PUZZLES[0]!, pushed.crates)).toBe(true)
    expect(undoKeystone(pushed)).toMatchObject({ player: ready.player, crates: ready.crates, moves: 0, pushes: 0 })
  })

  it('blocks walls, boundaries, and a closed door without counting those presses', () => {
    const state = startKeystone(createKeystoneState())
    const boundary = { ...state, player: KEYSTONE_BOARD_SIZE + 1 }
    expect(moveKeystone(boundary, 'left')).toBe(boundary)
    expect(moveKeystone(boundary, 'up')).toBe(boundary)
    const closedDoor = { ...state, player: KEYSTONE_PUZZLES[0]!.doors[0]! - 1 }
    expect(moveKeystone(closedDoor, 'right')).toBe(closedDoor)
    expect(boundary.moves).toBe(0)
  })

  it('keeps pause, resume, undo, and restart move counts coherent', () => {
    const started = startKeystone(createKeystoneState())
    const moved = moveKeystone(started, 'right')
    expect(moveKeystone(pauseKeystone(moved), 'up')).toEqual(pauseKeystone(moved))
    expect(resumeKeystone(pauseKeystone(moved)).phase).toBe('playing')
    expect(restartKeystone(moved)).toMatchObject({ phase: 'ready', moves: 0, stageIndex: 0, history: [] })
  })

  it('proves each hand-authored chamber solvable and clears the full four-room route', () => {
    let state = startKeystone(createKeystoneState())
    for (let index = 0; index < KEYSTONE_PUZZLES.length; index += 1) {
      const solution = findSolution(KEYSTONE_PUZZLES[index]!)
      expect(solution, `${KEYSTONE_PUZZLES[index]!.title} needs a solution`).not.toBeNull()
      for (const direction of solution!) state = moveKeystone(state, direction)
      expect(state.completedStageMoves).toHaveLength(index + 1)
      if (index < KEYSTONE_PUZZLES.length - 1) expect(state.stageIndex).toBe(index + 1)
    }
    expect(state.phase).toBe('complete')
    expect(state.completedStageMoves).toEqual(expect.arrayContaining([expect.any(Number)]))
    expect(state.moves).toBe(state.completedStageMoves.reduce((total, moves) => total + moves, 0))
    expect(state.message).toMatch(/all four doors open/i)
  })
})
