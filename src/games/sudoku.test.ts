import { describe, expect, it } from 'vitest'
import {
  SUDOKU_CELL_COUNT,
  SUDOKU_SIDE,
  conflictingSudokuCells,
  createSudokuPuzzle,
  createSudokuState,
  sudokuProgress,
  sudokuReducer,
  validSudokuProgress,
} from './sudoku'

const DATE = '2026-11-19'
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

describe('daily Sudoku puzzle', () => {
  it('builds a deterministic valid grid and a playable set of givens', () => {
    const puzzle = createSudokuPuzzle(DATE)
    expect(createSudokuPuzzle(DATE)).toEqual(puzzle)
    expect(puzzle.solution).toHaveLength(SUDOKU_CELL_COUNT)
    expect(puzzle.initialBoard).toHaveLength(SUDOKU_CELL_COUNT)
    expect(puzzle.givens.filter(Boolean)).toHaveLength(41)
    expect(puzzle.solution.every((value) => DIGITS.includes(value))).toBe(true)

    for (let row = 0; row < SUDOKU_SIDE; row += 1) {
      expect(puzzle.solution.slice(row * SUDOKU_SIDE, (row + 1) * SUDOKU_SIDE).sort()).toEqual(DIGITS)
    }
    for (let column = 0; column < SUDOKU_SIDE; column += 1) {
      expect(Array.from({ length: 9 }, (_, row) => puzzle.solution[row * 9 + column]!).sort()).toEqual(DIGITS)
    }
    for (let boxRow = 0; boxRow < 3; boxRow += 1) {
      for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
        const box = Array.from({ length: 9 }, (_, offset) => puzzle.solution[(boxRow * 3 + Math.floor(offset / 3)) * 9 + boxColumn * 3 + offset % 3]!)
        expect(box.sort()).toEqual(DIGITS)
      }
    }
    puzzle.initialBoard.forEach((value, index) => {
      expect(value).toBe(puzzle.givens[index] ? puzzle.solution[index] : '')
    })
    expect(createSudokuPuzzle('2026-11-20').initialBoard).not.toEqual(puzzle.initialBoard)
  })

  it('highlights duplicate entries in their row, column, and box', () => {
    const board = Array(SUDOKU_CELL_COUNT).fill('') as string[]
    board[0] = '4'
    board[1] = '4'
    board[9] = '4'
    expect(conflictingSudokuCells(board)).toEqual(new Set([0, 1, 9]))
  })

  it('accepts entries only in editable cells and can clear a puzzle', () => {
    let state = createSudokuState(DATE)
    const cell = state.selectedCell
    state = sudokuReducer(state, { type: 'input', value: state.solution[cell]! })
    expect(state.board[cell]).toBe(state.solution[cell])

    const given = state.givens.findIndex(Boolean)
    const unchanged = sudokuReducer({ ...state, selectedCell: given }, { type: 'input', value: '9' })
    expect(unchanged.board[given]).toBe(state.initialBoard[given])
    state = sudokuReducer(state, { type: 'reset' })
    expect(state.board).toEqual(state.initialBoard)
    expect(state.hintsUsed).toBe(0)
  })

  it('reveals and restores a hint, then locks that cell from editing', () => {
    let state = createSudokuState(DATE)
    const cell = state.selectedCell
    state = sudokuReducer(state, { type: 'hint' })
    expect(state.board[cell]).toBe(state.solution[cell])
    expect(state.hintsUsed).toBe(1)
    expect(state.hintedCells).toEqual([cell])
    expect(sudokuReducer(state, { type: 'erase' })).toBe(state)

    const progress = sudokuProgress(state)
    expect(validSudokuProgress(progress)).toBe(true)
    expect(createSudokuState(DATE, progress)).toMatchObject({ board: state.board, hintsUsed: 1, hintedCells: [cell] })
    expect(validSudokuProgress({ ...progress, board: ['x'] })).toBe(false)
  })

  it('completes the board from the solved grid and keeps the result local', () => {
    const puzzle = createSudokuPuzzle(DATE)
    let state = createSudokuState(DATE)
    for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
      if (state.givens[index]) continue
      state = sudokuReducer(state, { type: 'select', index })
      state = sudokuReducer(state, { type: 'input', value: puzzle.solution[index]! })
    }
    expect(state.phase).toBe('complete')
    expect(state.board).toEqual(puzzle.solution)
    expect(sudokuProgress(state)).toMatchObject({ date: DATE, hintsUsed: 0, board: puzzle.solution })
    expect(sudokuReducer(state, { type: 'erase' })).toBe(state)
  })

  it('rejects impossible calendar dates', () => {
    expect(() => createSudokuPuzzle('2026-02-30')).toThrow(RangeError)
  })
})
