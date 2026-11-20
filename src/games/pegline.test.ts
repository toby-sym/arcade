import { describe, expect, it } from 'vitest'
import {
  createPeglineState,
  isValidPeglineMove,
  movePegline,
  nextPeglineBoard,
  pausePegline,
  peglineCell,
  PEGLINE_PUZZLES,
  resumePegline,
  retryPeglineBoard,
  selectPeglineCell,
  startPegline,
} from './pegline'

const routes = [
  [
    [[0, 2], [2, 2]], [[3, 2], [1, 2]], [[2, 0], [2, 2]], [[1, 2], [3, 2]], [[4, 2], [2, 2]],
  ],
  [
    [[3, 1], [3, 3]], [[3, 4], [3, 2]], [[1, 3], [3, 3]], [[3, 3], [3, 1]],
    [[1, 2], [1, 0]], [[1, 0], [3, 0]], [[3, 0], [3, 2]], [[4, 2], [2, 2]],
  ],
  [
    [[2, 0], [2, 2]], [[4, 1], [2, 1]], [[2, 2], [2, 0]], [[4, 3], [2, 3]],
    [[1, 3], [3, 3]], [[3, 3], [3, 1]], [[1, 2], [1, 0]], [[1, 0], [3, 0]],
    [[3, 0], [3, 2]], [[4, 2], [2, 2]],
  ],
]

describe('Pegline', () => {
  it('builds three different pegboards with valid target sockets', () => {
    const state = createPeglineState()
    expect(PEGLINE_PUZZLES).toHaveLength(3)
    expect(state.board.filter((cell) => cell === 2)).toHaveLength(6)
    expect(state.board[PEGLINE_PUZZLES[0]!.target]).toBe(1)
    expect(new Set(PEGLINE_PUZZLES.map((puzzle) => puzzle.layout.join(''))).size).toBe(3)
  })

  it('accepts only orthogonal jumps over one peg into an empty socket', () => {
    const playing = startPegline(createPeglineState())
    expect(isValidPeglineMove(playing.board, peglineCell(0, 2), peglineCell(2, 2))).toBe(true)
    expect(isValidPeglineMove(playing.board, peglineCell(0, 2), peglineCell(2, 1))).toBe(false)
    expect(isValidPeglineMove(playing.board, peglineCell(0, 2), peglineCell(0, 4))).toBe(false)
    const noMiddlePeg = [...playing.board]
    noMiddlePeg[peglineCell(2, 1)] = 1
    expect(isValidPeglineMove(noMiddlePeg, peglineCell(2, 0), peglineCell(2, 2))).toBe(false)
    const selected = selectPeglineCell(playing, peglineCell(0, 2))
    expect(selected.selectedCell).toBe(peglineCell(0, 2))
    const moved = selectPeglineCell(selected, peglineCell(2, 2))
    expect(moved.moves).toBe(1)
    expect(moved.board[peglineCell(0, 2)]).toBe(1)
    expect(moved.board[peglineCell(1, 2)]).toBe(1)
    expect(moved.board[peglineCell(2, 2)]).toBe(2)
  })

  it('clears each fixed board with a single peg on its target', () => {
    let state = startPegline(createPeglineState())
    routes.forEach((route, stageIndex) => {
      route.forEach(([from, to]) => {
        state = movePegline(state, peglineCell(from![0]!, from![1]!), peglineCell(to![0]!, to![1]!))
      })
      if (stageIndex < routes.length - 1) {
        expect(state.phase).toBe('stage-clear')
        state = nextPeglineBoard(state)
      }
    })
    expect(state.phase).toBe('complete')
    expect(state.moves).toBe(23)
    expect(state.board.filter((cell) => cell === 2)).toHaveLength(1)
    expect(state.board[PEGLINE_PUZZLES[2]!.target]).toBe(2)
  })

  it('holds the board on pause and retries a wrong-target finish without hiding spent moves', () => {
    const playing = startPegline(createPeglineState())
    expect(resumePegline(pausePegline(playing)).phase).toBe('playing')
    const puzzle = PEGLINE_PUZZLES[0]!
    const board = playing.board.map((_cell, index): 0 | 1 | 2 => puzzle.layout[Math.floor(index / 5)]?.[index % 5] === '#' ? 1 : 0)
    board[peglineCell(1, 2)] = 2
    board[peglineCell(2, 2)] = 2
    const stuck = movePegline({ ...playing, board }, peglineCell(1, 2), peglineCell(3, 2))
    expect(stuck).toMatchObject({ phase: 'stuck', moves: 1, stageMoves: 1 })
    const retried = retryPeglineBoard(stuck)
    expect(retried).toMatchObject({ phase: 'playing', moves: 1, stageMoves: 0 })
    expect(retried.board).toEqual(createPeglineState().board)
  })
})
