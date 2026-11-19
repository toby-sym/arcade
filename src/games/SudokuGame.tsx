import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  SUDOKU_SIDE,
  conflictingSudokuCells,
  createSudokuState,
  sudokuProgress,
  sudokuReducer,
  type SudokuAction,
  type SudokuProgress,
} from './sudoku'

interface SudokuGameProps {
  onBack: () => void
  bestHints: number | null
  progress: SudokuProgress | null
  onSaveProgress: (progress: SudokuProgress) => void
}

export function SudokuGame({ onBack, bestHints, progress, onSaveProgress }: SudokuGameProps) {
  const today = utcDateKey()
  const selectedCellRef = useRef<HTMLButtonElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    sudokuReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createSudokuState(date, saved),
  )
  const conflicts = conflictingSudokuCells(state.board)
  const selectedValue = state.board[state.selectedCell]
  const canHint = state.board.some((value, index) => !value && !state.givens[index] && !state.hintedCells.includes(index))

  useEffect(() => {
    selectedCellRef.current?.focus()
  }, [])

  const sendAction = (action: SudokuAction) => {
    const next = sudokuReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (action.type !== 'select') onSaveProgress(sudokuProgress(next))
    if (next.phase === 'complete' && state.phase !== 'complete') playSound('win')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key.startsWith('Arrow')) {
      const row = Math.floor(state.selectedCell / SUDOKU_SIDE)
      const column = state.selectedCell % SUDOKU_SIDE
      const nextRow = event.key === 'ArrowUp' ? Math.max(0, row - 1) : event.key === 'ArrowDown' ? Math.min(8, row + 1) : row
      const nextColumn = event.key === 'ArrowLeft' ? Math.max(0, column - 1) : event.key === 'ArrowRight' ? Math.min(8, column + 1) : column
      event.preventDefault()
      sendAction({ type: 'select', index: nextRow * SUDOKU_SIDE + nextColumn })
      return
    }
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault()
      sendAction({ type: 'input', value: event.key })
    } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault()
      sendAction({ type: 'erase' })
    }
  }

  return (
    <section className="snake-view sudoku-view" aria-labelledby="sudoku-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout sudoku-layout">
        <div className="snake-copy sudoku-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY NUMBER GRID · UTC</p>
          <h1 id="sudoku-title">Sudoku<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">A quiet grid. Nine numbers. No repeats.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Fill every empty square so each row, column, and 3×3 box contains the numbers 1 to 9 once. Select a square, then enter a number with the keyboard or pad.</p>
          </div>
          <div className="score-card sudoku-score" aria-label={`Hints used: ${state.hintsUsed}. ${bestHints === null ? 'No personal best yet.' : `Best: ${bestHints} hints.`}`}>
            <div className="sudoku-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{81 - state.givens.filter(Boolean).length - state.board.filter((value, index) => value && !state.givens[index]).length}<small> open</small></strong>
              <span className="score-unit">cells remaining</span>
            </div>
            <div className="sudoku-run-stat">
              <span className="score-caption">HINTS</span>
              <strong className="score-value">{state.hintsUsed}</strong>
              <span className="score-unit">used</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST · THIS BROWSER</span>
              <strong className="score-value">{bestHints === null ? '—' : bestHints}</strong>
              <span className="score-unit">{bestHints === 1 ? 'hint' : 'hints'}</span>
            </div>
          </div>
          <p className="sudoku-local-note">The same puzzle is shared for this UTC date. Progress and your fewest hints stay in this browser.</p>
        </div>

        <div className="play-column sudoku-play-column" onKeyDown={handleKeyDown}>
          <div className="sudoku-console">
            <div className="frame-topline">
              <span>FIELD 14</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? 'LIVE' : 'SOLVED'}</span>
            </div>

            <div className={`sudoku-grid${state.phase === 'complete' ? ' sudoku-grid-complete' : ''}`} role="group" aria-label="Sudoku board" aria-describedby="sudoku-status">
              {state.board.map((value, index) => {
                const row = Math.floor(index / SUDOKU_SIDE)
                const column = index % SUDOKU_SIDE
                const isSelected = state.selectedCell === index
                const isHinted = state.hintedCells.includes(index)
                const classes = [
                  'sudoku-cell',
                  state.givens[index] ? 'cell-given' : '',
                  isSelected ? 'cell-selected' : '',
                  value && value === selectedValue ? 'cell-same' : '',
                  conflicts.has(index) ? 'cell-conflict' : '',
                  isHinted ? 'cell-hinted' : '',
                  row % 3 === 2 ? 'box-bottom' : '',
                  column % 3 === 2 ? 'box-right' : '',
                ].filter(Boolean).join(' ')
                const valueLabel = value || 'empty'
                const givenLabel = state.givens[index] ? 'given' : isHinted ? 'revealed by hint' : 'editable'
                return (
                  <button
                    key={index}
                    ref={isSelected ? selectedCellRef : undefined}
                    className={classes}
                    type="button"
                    aria-label={`Row ${row + 1}, column ${column + 1}, ${valueLabel}, ${givenLabel}`}
                    aria-pressed={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => sendAction({ type: 'select', index })}
                  >
                    {value}
                  </button>
                )
              })}
            </div>

            {state.phase === 'playing' ? (
              <>
                <div className="sudoku-number-pad" role="group" aria-label="Enter a number">
                  {Array.from({ length: 9 }, (_, index) => String(index + 1)).map((digit) => (
                    <button key={digit} className="sudoku-number" type="button" onClick={() => sendAction({ type: 'input', value: digit })} aria-label={`Enter ${digit}`}>{digit}</button>
                  ))}
                </div>
                <div className="sudoku-actions">
                  <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'erase' })}>Erase</button>
                  <button className="button button-quiet" type="button" onClick={() => sendAction({ type: 'reset' })}>Clear entries</button>
                  <button className="button button-primary" type="button" onClick={() => sendAction({ type: 'hint' })} disabled={!canHint}>Hint</button>
                </div>
              </>
            ) : (
              <div className="sudoku-complete" role="status">
                <span>GRID COMPLETE</span>
                <strong>Every row, column, and box is filled.</strong>
                <small>A fresh puzzle arrives tomorrow.</small>
              </div>
            )}

            <p className="sudoku-status" id="sudoku-status" role="status" aria-live="polite">{state.message}</p>
            <div className="sudoku-console-footer"><span>ROW {Math.floor(state.selectedCell / SUDOKU_SIDE) + 1} · COLUMN {state.selectedCell % SUDOKU_SIDE + 1}</span><span>{state.hintsUsed} HINTS</span></div>
          </div>
          <p className="sudoku-keyboard-hint">Arrow keys move · 1–9 enter · Backspace erases · Hints reveal a cell</p>
        </div>
      </div>
    </section>
  )
}
