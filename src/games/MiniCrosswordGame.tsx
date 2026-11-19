import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  MINI_CROSSWORD_SIDE,
  createMiniCrosswordState,
  isMiniCrosswordEntrySolved,
  miniCrosswordEntry,
  miniCrosswordProgress,
  miniCrosswordReducer,
  type CrosswordDirection,
  type MiniCrosswordAction,
  type MiniCrosswordProgress,
} from './miniCrossword'

interface MiniCrosswordGameProps {
  onBack: () => void
  bestHints: number | null
  progress: MiniCrosswordProgress | null
  onSaveProgress: (progress: MiniCrosswordProgress) => void
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function MiniCrosswordGame({ onBack, bestHints, progress, onSaveProgress }: MiniCrosswordGameProps) {
  const today = utcDateKey()
  const selectedCellRef = useRef<HTMLButtonElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    miniCrosswordReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createMiniCrosswordState(date, saved),
  )
  const activeClue = miniCrosswordEntry(state)
  const acrossSolved = (number: number) => {
    const entry = state.across.find((candidate) => candidate.number === number)
    return entry ? isMiniCrosswordEntrySolved(state, entry) : false
  }
  const downSolved = (number: number) => {
    const entry = state.down.find((candidate) => candidate.number === number)
    return entry ? isMiniCrosswordEntrySolved(state, entry) : false
  }

  useEffect(() => {
    selectedCellRef.current?.focus()
  }, [state.direction, state.message, state.selectedCell])

  const sendAction = (action: MiniCrosswordAction) => {
    const next = miniCrosswordReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (action.type !== 'select' && action.type !== 'toggleDirection') onSaveProgress(miniCrosswordProgress(next))
    if (next.phase === 'complete' && state.phase !== 'complete') playSound('win')
  }

  const chooseClue = (direction: CrosswordDirection, number: number) => {
    const entry = (direction === 'across' ? state.across : state.down).find((candidate) => candidate.number === number)
    if (!entry) return
    const index = entry.cells[0]!
    if (state.direction !== direction) dispatch({ type: 'toggleDirection' })
    dispatch({ type: 'select', index })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLElement) || !event.target.closest('.mini-crossword-cell')) return
    if (event.key.startsWith('Arrow')) {
      const row = Math.floor(state.selectedCell / MINI_CROSSWORD_SIDE)
      const column = state.selectedCell % MINI_CROSSWORD_SIDE
      const rowStep = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
      const columnStep = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
      event.preventDefault()
      for (let distance = 1; distance < MINI_CROSSWORD_SIDE; distance += 1) {
        const nextRow = row + rowStep * distance
        const nextColumn = column + columnStep * distance
        if (nextRow < 0 || nextRow >= MINI_CROSSWORD_SIDE || nextColumn < 0 || nextColumn >= MINI_CROSSWORD_SIDE) break
        const index = nextRow * MINI_CROSSWORD_SIDE + nextColumn
        if (state.board[index] !== '#') {
          sendAction({ type: 'select', index })
          break
        }
      }
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      sendAction({ type: 'toggleDirection' })
      return
    }
    if (event.key.length === 1 && /^[a-z]$/i.test(event.key)) {
      event.preventDefault()
      sendAction({ type: 'letter', letter: event.key.toUpperCase() })
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      sendAction({ type: 'backspace' })
    }
  }

  return (
    <section className="snake-view mini-crossword-view" aria-labelledby="mini-crossword-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout mini-crossword-layout">
        <div className="snake-copy mini-crossword-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY CROSSWORD · UTC</p>
          <h1 id="mini-crossword-title">Mini Crossword<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Five short clues across and down. Every crossing counts.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Select a square, then type a letter or tap the letter pad. Arrow keys move through the grid. Select the same square twice to switch between Across and Down.</p>
          </div>
          <div className="score-card mini-crossword-score" aria-label={`${state.hintsUsed} hints used. ${bestHints === null ? 'No personal best yet.' : `Best: ${bestHints} hints.`}`}>
            <div className="crossword-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.board.filter((cell) => cell !== '' && cell !== '#').length}<small> / 21</small></strong>
              <span className="score-unit">squares filled</span>
            </div>
            <div className="crossword-run-stat">
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
          <p className="mini-crossword-local-note">The same puzzle is shared for this UTC date. Progress and your fewest hints stay in this browser.</p>
        </div>

        <div className="play-column mini-crossword-play-column" onKeyDown={handleKeyDown}>
          <div className="mini-crossword-console">
            <div className="frame-topline">
              <span>FIELD 15</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? 'LIVE' : 'SOLVED'}</span>
            </div>

            <div className="mini-crossword-active-clue" aria-live="polite">
              <span>{state.direction.toUpperCase()} {activeClue.number}</span>
              <strong>{activeClue.clue}</strong>
              <button className="mini-crossword-direction" type="button" onClick={() => sendAction({ type: 'toggleDirection' })} aria-label={`Switch to ${state.direction === 'across' ? 'Down' : 'Across'}`}>
                {state.direction === 'across' ? '↕ Down' : '↔ Across'}
              </button>
            </div>

            {state.phase === 'playing' ? (
              <div className="mini-crossword-grid" role="group" aria-label="Five by five crossword board with black squares" aria-describedby="mini-crossword-status">
                {state.board.map((letter, index) => {
                  const row = Math.floor(index / MINI_CROSSWORD_SIDE)
                  const column = index % MINI_CROSSWORD_SIDE
                  if (letter === '#') return <div key={index} className="mini-crossword-block" aria-hidden="true" />
                  const selected = index === state.selectedCell
                  const hinted = state.hintedCells.includes(index)
                  const completedAcross = state.across.some((entry) => entry.cells.includes(index) && acrossSolved(entry.number))
                  const completedDown = state.down.some((entry) => entry.cells.includes(index) && downSolved(entry.number))
                  const cellNumber = [...state.across, ...state.down].find((entry) => entry.cells[0] === index)?.number
                  const classes = [
                    'mini-crossword-cell',
                    selected ? 'cell-selected' : '',
                    completedAcross || completedDown ? 'cell-completed-word' : '',
                    hinted ? 'cell-hinted' : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <button
                      key={index}
                      ref={selected ? selectedCellRef : undefined}
                      className={classes}
                      type="button"
                      aria-label={`Row ${row + 1}, column ${column + 1}, ${letter || 'empty'}${hinted ? ', revealed by hint' : ''}`}
                      aria-pressed={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => sendAction(selected ? { type: 'toggleDirection' } : { type: 'select', index })}
                    >
                      {cellNumber && <span className="mini-crossword-cell-number" aria-hidden="true">{cellNumber}</span>}
                      {letter}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="mini-crossword-complete" role="status">
                <span>GRID COMPLETE</span>
                <strong>All ten words fit.</strong>
                <small>A fresh puzzle arrives tomorrow.</small>
              </div>
            )}

            <div className="mini-crossword-clues">
              <section aria-labelledby="across-clues-title">
                <h2 id="across-clues-title">Across</h2>
                <ol>
                  {state.across.map((entry) => (
                    <li key={entry.number} className={`${state.direction === 'across' && activeClue.number === entry.number ? 'clue-active' : ''}${acrossSolved(entry.number) ? ' clue-solved' : ''}`}>
                      <button type="button" onClick={() => chooseClue('across', entry.number)} aria-label={`Across ${entry.number}: ${entry.clue}${acrossSolved(entry.number) ? ', solved' : ''}`}>
                        <span>{entry.number}</span>{entry.clue}{acrossSolved(entry.number) && <b aria-hidden="true">✓</b>}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
              <section aria-labelledby="down-clues-title">
                <h2 id="down-clues-title">Down</h2>
                <ol>
                  {state.down.map((entry) => (
                    <li key={entry.number} className={`${state.direction === 'down' && activeClue.number === entry.number ? 'clue-active' : ''}${downSolved(entry.number) ? ' clue-solved' : ''}`}>
                      <button type="button" onClick={() => chooseClue('down', entry.number)} aria-label={`Down ${entry.number}: ${entry.clue}${downSolved(entry.number) ? ', solved' : ''}`}>
                        <span>{entry.number}</span>{entry.clue}{downSolved(entry.number) && <b aria-hidden="true">✓</b>}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            {state.phase === 'playing' && (
              <>
                <div className="mini-crossword-keyboard" role="group" aria-label="Letter keyboard">
                  {LETTERS.map((letter) => (
                    <button key={letter} type="button" onClick={() => sendAction({ type: 'letter', letter })} aria-label={`Enter ${letter}`}>{letter}</button>
                  ))}
                </div>
                <div className="mini-crossword-actions">
                  <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'backspace' })}>⌫ Erase</button>
                  <button className="button button-quiet" type="button" onClick={() => sendAction({ type: 'reset' })}>Clear entries</button>
                  <button className="button button-primary" type="button" onClick={() => sendAction({ type: 'hint' })}>Hint</button>
                </div>
              </>
            )}

            <p className="mini-crossword-status" id="mini-crossword-status" role="status" aria-live="polite">{state.message}</p>
            <div className="mini-crossword-console-footer"><span>{state.direction.toUpperCase()} {activeClue.number}</span><span>{state.hintsUsed} HINTS</span></div>
          </div>
          <p className="mini-crossword-keyboard-hint">Type A–Z · Arrows move · Backspace erases · Enter switches direction</p>
        </div>
      </div>
    </section>
  )
}
