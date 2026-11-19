import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  adjacentMineCount,
  createMinesweeperState,
  MINESWEEPER_CELL_COUNT,
  MINESWEEPER_WIDTH,
  minesweeperReducer,
  toMinesweeperProgress,
  type MinesweeperProgress,
} from './minesweeper'

interface MinesweeperGameProps {
  onBack: () => void
  bestSeconds: number | null
  progress: MinesweeperProgress | null
  onSaveProgress: (progress: MinesweeperProgress) => void
}

const dateKey = () => new Date().toISOString().slice(0, 10)
const cellName = (cell: number) => `Row ${Math.floor(cell / MINESWEEPER_WIDTH) + 1}, column ${cell % MINESWEEPER_WIDTH + 1}`
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function MinesweeperGame({ onBack, bestSeconds, progress, onSaveProgress }: MinesweeperGameProps) {
  const [state, dispatch] = useReducer(minesweeperReducer, progress, (saved) => createMinesweeperState(dateKey(), saved))
  const [flagMode, setFlagMode] = useState(false)
  const [focusedCell, setFocusedCell] = useState(40)
  const boardRef = useRef<HTMLDivElement>(null)
  const saveProgressRef = useRef(onSaveProgress)
  saveProgressRef.current = onSaveProgress
  const statusLabel = state.phase === 'playing' ? 'LIVE' : state.phase.toUpperCase()

  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), 1000)
    return () => window.clearInterval(timer)
  }, [state.phase])

  useEffect(() => {
    saveProgressRef.current(toMinesweeperProgress(state))
  }, [state])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) dispatch({ type: 'pause' })
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  const focusCell = (cell: number) => {
    setFocusedCell(cell)
    boardRef.current?.querySelector<HTMLButtonElement>(`[data-minesweeper-cell="${cell}"]`)?.focus()
  }

  const start = (action: 'start' | 'resume') => {
    dispatch({ type: action })
    window.requestAnimationFrame(() => focusCell(focusedCell))
  }

  const handleCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const row = Math.floor(cell / MINESWEEPER_WIDTH)
    const column = cell % MINESWEEPER_WIDTH
    const nextCell = event.key === 'ArrowUp' ? (row > 0 ? cell - MINESWEEPER_WIDTH : cell)
      : event.key === 'ArrowDown' ? (row < MINESWEEPER_WIDTH - 1 ? cell + MINESWEEPER_WIDTH : cell)
        : event.key === 'ArrowLeft' ? (column > 0 ? cell - 1 : cell)
          : event.key === 'ArrowRight' ? (column < MINESWEEPER_WIDTH - 1 ? cell + 1 : cell)
            : null
    if (nextCell !== null) {
      event.preventDefault()
      focusCell(nextCell)
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      dispatch({ type: 'toggleFlag', cell })
    } else if (event.key.toLowerCase() === 'c') {
      event.preventDefault()
      dispatch({ type: 'chord', cell })
    }
  }

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>, cell: number) => {
    event.preventDefault()
    dispatch({ type: 'toggleFlag', cell })
  }

  const restart = () => {
    dispatch({ type: 'restart' })
    setFlagMode(false)
    window.requestAnimationFrame(() => focusCell(40))
  }

  const remainingMines = 10 - state.flagged.length

  return (
    <section className="snake-view minesweeper-view" aria-labelledby="minesweeper-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout minesweeper-layout">
        <div className="snake-copy minesweeper-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY FIELD · {state.date}</p>
          <h1 id="minesweeper-title">Minesweeper<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Read the numbers, mark the mines, and clear today's shared field.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Numbers show how many mines touch a square. Reveal every safe square to win. The center opening is safe on every player's copy of the daily board.</p>
            <p>Click or tap a covered square to reveal it. Tap a revealed number or press <strong>C</strong> after matching its neighboring flags to reveal its covered neighbors. Use <strong>Flag mode</strong> or press <strong>F</strong> to mark a mine. Arrow keys move between squares; Enter or Space reveals or chords.</p>
          </div>
          <div className="score-card minesweeper-score" aria-label={`${remainingMines} estimated mines remaining. Elapsed time ${formatTime(state.elapsedSeconds)}. ${bestSeconds === null ? 'No personal best yet.' : `Fastest local solve ${formatTime(bestSeconds)}.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">FIELD TIME</span>
              <strong className="score-value">{formatTime(state.elapsedSeconds)}</strong>
              <span className="score-unit">minutes : seconds</span>
            </div>
            <div className="breakout-stats"><span><strong>{remainingMines}</strong> mines to find</span><span><strong>{state.revealed.filter((cell) => !state.mines.includes(cell)).length}</strong> safe squares</span></div>
            <div className="local-best-readout">
              <span className="score-caption">FASTEST IN THIS BROWSER</span>
              <strong className="score-value">{bestSeconds === null ? '—' : formatTime(bestSeconds)}</strong>
              <span className="score-unit">local personal best</span>
            </div>
          </div>
          <div className="game-actions">
            {state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => dispatch({ type: 'pause' })}>Pause <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={() => start('resume')}>Resume <span aria-hidden="true">→</span></button>
            ) : state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={() => start('start')}>Start field <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Play again <span aria-hidden="true">→</span></button>
            )}
            <button className="button button-quiet" type="button" onClick={restart}>Restart daily field</button>
          </div>
          <p className="keyboard-hint">Arrows to move · Enter / Space to reveal or chord · C to chord · F to flag</p>
        </div>

        <div className="play-column minesweeper-play-column">
          <div className="minesweeper-console">
            <div className="frame-topline">
              <span>FIELD 23</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {statusLabel}</span>
            </div>
            <div className="minesweeper-field-shell">
              <div ref={boardRef} className={`minesweeper-grid phase-${state.phase}`} role="group" aria-label="Daily Minesweeper board, 9 rows by 9 columns">
                {Array.from({ length: MINESWEEPER_CELL_COUNT }, (_, cell) => {
                  const revealed = state.revealed.includes(cell)
                  const flagged = state.flagged.includes(cell)
                  const mine = state.mines.includes(cell)
                  const showMine = mine && (revealed || state.phase === 'won')
                  const wrongFlag = state.phase === 'lost' && flagged && !mine
                  const adjacent = !mine ? adjacentMineCount(state, cell) : 0
                  const label = showMine ? `${cellName(cell)}, mine`
                    : wrongFlag ? `${cellName(cell)}, wrongly flagged`
                      : flagged ? `${cellName(cell)}, flagged`
                      : revealed ? `${cellName(cell)}, ${adjacent ? `${adjacent} neighboring ${adjacent === 1 ? 'mine' : 'mines'}` : 'empty'}`
                        : `${cellName(cell)}, covered`
                  return (
                    <button
                      className={`minesweeper-cell${revealed ? ' is-revealed' : ''}${flagged ? ' is-flagged' : ''}${showMine ? ' is-mine' : ''}${wrongFlag ? ' is-wrong-flag' : ''}${revealed && adjacent ? ` mine-count-${adjacent}` : ''}`}
                      type="button"
                      key={cell}
                      data-minesweeper-cell={cell}
                      aria-label={label}
                      aria-keyshortcuts={revealed && adjacent > 0 ? 'C' : undefined}
                      tabIndex={cell === focusedCell ? 0 : -1}
                      disabled={state.phase !== 'playing'}
                      onFocus={() => setFocusedCell(cell)}
                      onKeyDown={(event) => handleCellKeyDown(event, cell)}
                      onClick={() => dispatch({ type: flagMode ? 'toggleFlag' : revealed ? 'chord' : 'reveal', cell })}
                      onContextMenu={(event) => handleContextMenu(event, cell)}
                    >
                      {showMine ? <span aria-hidden="true">✹</span>
                        : wrongFlag ? <span aria-hidden="true">×</span>
                        : flagged ? <span aria-hidden="true">⚑</span>
                          : revealed && adjacent > 0 ? <span aria-hidden="true">{adjacent}</span>
                            : null}
                    </button>
                  )
                })}
                {state.phase !== 'playing' && state.phase !== 'ready' && (
                  <div className="minesweeper-overlay" aria-live="polite">
                    <strong>{state.phase === 'paused' ? 'Field paused' : state.phase === 'won' ? 'Field cleared!' : 'Mine hit'}</strong>
                    <span>{state.phase === 'paused' ? 'Resume when you are ready.' : state.phase === 'won' ? `Solved in ${formatTime(state.elapsedSeconds)}. A new field arrives tomorrow.` : 'The daily board stays the same. Restart to try it again.'}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="minesweeper-console-footer"><span>9 × 9 · 10 MINES</span><span>{state.flagged.length} FLAGS · {state.date}</span></div>
          </div>
          <div className="minesweeper-touch-controls" role="group" aria-label="Minesweeper controls">
            <button className={`button ${flagMode ? 'button-primary' : 'button-secondary'}`} type="button" aria-pressed={flagMode} disabled={state.phase !== 'playing'} onClick={() => setFlagMode((enabled) => !enabled)}>{flagMode ? 'Flag mode on' : 'Flag mode off'}</button>
            <button className="button button-quiet" type="button" disabled={state.phase !== 'playing'} onClick={() => setFlagMode(false)}>Reveal mode</button>
          </div>
          <p className="minesweeper-status" role="status" aria-live="polite">{state.phase === 'ready' ? 'The middle opening is safe. Start when you are ready.' : state.phase === 'playing' ? `${remainingMines} estimated mines remain. Tap or click a covered square to reveal it.` : state.phase === 'paused' ? 'The clock is paused.' : state.phase === 'won' ? 'Daily field cleared. Your best time is saved in this browser.' : 'A mine was uncovered. Restart to play the same field again.'}</p>
        </div>
      </div>
    </section>
  )
}
