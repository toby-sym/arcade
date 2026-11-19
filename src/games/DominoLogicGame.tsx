import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createDominoLogicState,
  dominoLogicProgress,
  dominoLogicReducer,
  dominoTotals,
  type DominoLogicAction,
  type DominoLogicProgress,
} from './dominoLogic'

interface DominoLogicGameProps {
  onBack: () => void
  bestUndos: number | null
  progress: DominoLogicProgress | null
  onSaveProgress: (progress: DominoLogicProgress) => void
}

export function DominoLogicGame({ onBack, bestUndos, progress, onSaveProgress }: DominoLogicGameProps) {
  const today = utcDateKey()
  const consoleRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    dominoLogicReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createDominoLogicState(date, saved),
  )
  const totals = dominoTotals(state, state.placements)
  const placedIds = new Set(state.placements.map((placement) => placement.dominoId))
  const placedCells = new Map<number, { dominoId: number; half: number }>()

  for (const placement of state.placements) {
    const first = placement.firstCell
    const second = placement.orientation === 'horizontal' ? first + 1 : first + 4
    placedCells.set(first, { dominoId: placement.dominoId, half: placement.flipped ? 1 : 0 })
    placedCells.set(second, { dominoId: placement.dominoId, half: placement.flipped ? 0 : 1 })
  }

  useEffect(() => {
    consoleRef.current?.focus()
  }, [])

  const sendAction = (action: DominoLogicAction) => {
    const next = dominoLogicReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (next.placements !== state.placements || next.undos !== state.undos) onSaveProgress(dominoLogicProgress(next))
    if (next.phase === 'complete' && state.phase !== 'complete') playSound('win')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      sendAction({ type: 'rotate' })
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      sendAction({ type: 'flip' })
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      sendAction({ type: 'undo' })
    }
  }

  const progressLabel = `${state.placements.length} of ${state.dominoes.length} dominoes placed. ${state.undos} ${state.undos === 1 ? 'undo' : 'undos'}.`

  return (
    <section className="snake-view domino-view" aria-labelledby="domino-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout domino-layout">
        <div className="snake-copy domino-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY SUM GRID · UTC</p>
          <h1 id="domino-title">Domino Logic<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Six tiles. Three rows. Find the fit that makes every total click.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Place all six dominoes on the grid. Match every row and column target. Select a tile, then choose the cell for its left or top half. Rotate or flip it before placing.</p>
          </div>
          <div className="score-card domino-score" aria-label={`${progressLabel} ${bestUndos === null ? 'No personal best yet.' : `Best solve: ${bestUndos} ${bestUndos === 1 ? 'undo' : 'undos'}.`}`}>
            <div className="domino-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.placements.length}<small> / {state.dominoes.length}</small></strong>
              <span className="score-unit">dominoes placed</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST SOLVE · THIS BROWSER</span>
              <strong className="score-value">{bestUndos === null ? '—' : bestUndos}</strong>
              <span className="score-unit">{bestUndos === 1 ? 'undo' : 'undos'}</span>
            </div>
          </div>
          <p className="domino-local-note">Today’s puzzle and your best solve stay in this browser. They do not sync.</p>
        </div>

        <div className="play-column domino-play-column" onKeyDown={handleKeyDown}>
          <div className="domino-console" ref={consoleRef} tabIndex={-1} aria-label="Domino Logic daily puzzle">
            <div className="frame-topline">
              <span>FIELD 17</span>
              <span className={`frame-light ${state.phase === 'complete' ? 'phase-complete' : ''}`}><i />{state.phase === 'complete' ? 'SOLVED' : 'PLACE TILES'}</span>
            </div>

            <div className="domino-target-row domino-target-header" role="group" aria-label="Column target totals">
              <span />
              {state.columnTargets.map((target, column) => (
                <div className="domino-column-total" key={column} role="group" aria-label={`Column ${column + 1}, ${totals.columnSums[column]} of ${target}`}>
                  <span>COL {column + 1}</span>
                  <strong>{totals.columnSums[column]}<small> / {target}</small></strong>
                </div>
              ))}
            </div>
            <div className="domino-board-row">
              <div className="domino-row-totals" role="group" aria-label="Row target totals">
                {state.rowTargets.map((target, row) => (
                  <div className="domino-row-total" key={row} role="group" aria-label={`Row ${row + 1}, ${totals.rowSums[row]} of ${target}`}>
                    <span>ROW {row + 1}</span>
                    <strong>{totals.rowSums[row]}<small> / {target}</small></strong>
                  </div>
                ))}
              </div>
              <div className="domino-grid" role="group" aria-label="Three row by four column sum grid">
                {totals.cells.map((value, cell) => {
                  const row = Math.floor(cell / state.columnTargets.length)
                  const column = cell % state.columnTargets.length
                  const placement = state.placements.find((candidate) => candidate.firstCell === cell || (candidate.orientation === 'horizontal' ? candidate.firstCell + 1 : candidate.firstCell + 4) === cell)
                  const tilePart = placedCells.get(cell)
                  const tile = placement ? state.dominoes.find((candidate) => candidate.id === placement.dominoId) : null
                  const tileValue = tile && tilePart ? tile.values[tilePart.half] : value
                  const orientationClass = placement ? ` domino-cell-${placement.orientation}-${placement.firstCell === cell ? 'first' : 'second'}` : ''
                  return (
                    <button
                      className={`domino-cell${value === null ? '' : ` domino-filled${tilePart ? ` domino-color-${tilePart.dominoId % 6}` : ''}`}${orientationClass}`}
                      type="button"
                      key={cell}
                      aria-label={value === null ? `Row ${row + 1}, column ${column + 1}, empty` : `Row ${row + 1}, column ${column + 1}, ${tileValue}`}
                      onClick={() => sendAction({ type: 'place', cell })}
                      disabled={state.phase === 'complete'}
                    >
                      {tileValue ?? <span aria-hidden="true">·</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="domino-tray-label">DOMINO TRAY</div>
            <div className="domino-tray" role="group" aria-label="Available dominoes">
              {state.dominoes.map((tile) => {
                const used = placedIds.has(tile.id)
                const selected = state.selectedDominoId === tile.id
                return (
                  <button
                    className={`domino-tile${selected ? ' domino-tile-selected' : ''}${used ? ' domino-tile-used' : ''}`}
                    type="button"
                    key={tile.id}
                    aria-label={`Domino ${tile.id + 1}, ${tile.values[0]} and ${tile.values[1]}${used ? ', placed' : selected ? ', selected' : ''}`}
                    aria-pressed={selected}
                    disabled={used || state.phase === 'complete'}
                    onClick={() => sendAction({ type: 'select', dominoId: tile.id })}
                  >
                    <span>{tile.values[0]}</span><span>{tile.values[1]}</span>
                  </button>
                )
              })}
            </div>

            <div className="domino-actions">
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'rotate' })} disabled={state.selectedDominoId === null || state.phase === 'complete'}>Rotate (R)</button>
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'flip' })} disabled={state.selectedDominoId === null || state.phase === 'complete'}>Flip (F)</button>
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'undo' })} disabled={state.placements.length === 0 || state.phase === 'complete'}>Undo</button>
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'restart' })} disabled={state.placements.length === 0 || state.phase === 'complete'}>Restart</button>
            </div>

            <p className="domino-status" role="status" aria-live="polite">{state.message}</p>
            <div className="domino-console-footer"><span>CLICK · TOUCH · KEYBOARD</span><span>{state.undos} UNDOS</span></div>
          </div>
          <p className="domino-keyboard-hint">Select tiles and cells with Enter. Press R to rotate, F to flip, or Backspace to undo.</p>
        </div>
      </div>
    </section>
  )
}
