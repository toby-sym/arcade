import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createPipsState,
  pipsCellValues,
  pipsProgress,
  pipsReducer,
  pipsRegionStatuses,
  type PipsAction,
  type PipsProgress,
  type PipsRegion,
} from './pips'

interface PipsGameProps {
  onBack: () => void
  bestUndos: number | null
  progress: PipsProgress | null
  onSaveProgress: (progress: PipsProgress) => void
}

const PIP_POSITIONS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function regionRuleLabel(region: PipsRegion): string {
  switch (region.rule) {
    case 'sum': return `Total ${region.target}`
    case 'equal': return `All ${region.target}`
    case 'different': return 'All different'
    case 'less': return `Under ${region.target}`
    case 'greater': return `Over ${region.target}`
  }
}

function DominoFace({ value }: { value: number }) {
  const filled = new Set(PIP_POSITIONS[value] ?? [])
  return (
    <span className="pips-domino-half" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => <i className={filled.has(index) ? 'pips-dot' : ''} key={index} />)}
    </span>
  )
}

export function PipsGame({ onBack, bestUndos, progress, onSaveProgress }: PipsGameProps) {
  const today = utcDateKey()
  const trayRefs = useRef<(HTMLButtonElement | null)[]>([])
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    pipsReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createPipsState(date, saved),
  )
  const values = pipsCellValues(state, state.placements)
  const regionStatuses = pipsRegionStatuses(state, state.placements)
  const placedIds = new Set(state.placements.map((placement) => placement.dominoId))

  useEffect(() => {
    const firstAvailable = state.dominoes.findIndex((domino) => !state.placements.some((placement) => placement.dominoId === domino.id))
    if (firstAvailable >= 0) trayRefs.current[firstAvailable]?.focus()
  }, [])

  const sendAction = (action: PipsAction) => {
    const next = pipsReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (next.placements !== state.placements || next.undos !== state.undos) onSaveProgress(pipsProgress(next))
    if (next.phase === 'complete') playSound('win')
    else if (next.placements.length > state.placements.length) playSound('score')
    else if (next.undos > state.undos) playSound('miss')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
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

  const restartDisabled = state.phase === 'complete' || state.placements.length === 0

  return (
    <section className="snake-view pips-view" aria-labelledby="pips-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout pips-layout">
        <div className="snake-copy pips-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY DOMINO PUZZLE · UTC</p>
          <h1 id="pips-title">Pips<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Place the dominoes. Read each region. Make every pip count.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Fit all six dominoes into the grid. Each colored region has a rule: match its total, keep every pip equal or different, or stay above or below its target. Turn or flip a domino before placing it.</p>
          </div>
          <div className="score-card pips-score" aria-label={`${state.placements.length} of 6 dominoes placed. ${state.undos} undos. ${bestUndos === null ? 'No personal best yet.' : `Best solve: ${bestUndos} undos.`}`}>
            <div className="pips-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.placements.length}<small> / 6</small></strong>
              <span className="score-unit">dominoes placed</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST SOLVE · THIS BROWSER</span>
              <strong className="score-value">{bestUndos === null ? '—' : bestUndos}</strong>
              <span className="score-unit">{bestUndos === 1 ? 'undo' : 'undos'}</span>
            </div>
          </div>
          <p className="pips-local-note">Your daily progress and best solve stay in this browser. They do not sync.</p>
          <div className="pips-rules" aria-label="Daily region rules">
            {state.regions.map((region, index) => {
              const status = regionStatuses[index]!
              return (
                <div className={`pips-rule pips-region-${region.id}${status.satisfied ? ' pips-rule-satisfied' : ''}${!status.valid ? ' pips-rule-invalid' : ''}`} key={region.id}>
                  <span className="pips-rule-name">REGION {String.fromCharCode(65 + region.id)}</span>
                  <strong>{regionRuleLabel(region)}</strong>
                  <small>{status.filled}/{region.cells.length} filled · {status.total} pips</small>
                </div>
              )
            })}
          </div>
        </div>

        <div className="play-column pips-play-column">
          <div className="pips-console" aria-label="Pips domino board">
            <div className="frame-topline">
              <span>FIELD 21</span>
              <span className={`frame-light ${state.phase === 'complete' ? 'phase-complete' : ''}`}><i />{state.phase === 'complete' ? 'SOLVED' : `${state.placements.length} / 6 DOWN`}</span>
            </div>
            <div className="pips-board" role="group" aria-label="Three row by four column Pips board">
              {values.map((value, cell) => {
                const region = state.regionByCell[cell]!
                const row = Math.floor(cell / 4) + 1
                const column = (cell % 4) + 1
                return (
                  <button
                    className={`pips-cell pips-region-${region}${value !== null ? ' pips-cell-filled' : ''}`}
                    data-region={region}
                    type="button"
                    key={cell}
                    aria-label={`Row ${row}, column ${column}, region ${String.fromCharCode(65 + region)}${value === null ? ', empty' : `, ${value} pips`}`}
                    disabled={state.phase === 'complete'}
                    onClick={() => sendAction({ type: 'place', cell })}
                  >
                    {value !== null && <span aria-hidden="true">{value}</span>}
                  </button>
                )
              })}
            </div>

            <div className="pips-tray" role="group" aria-label="Domino tray">
              {state.dominoes.map((domino, index) => {
                const placed = placedIds.has(domino.id)
                const selected = state.selectedDominoId === domino.id
                return (
                  <button
                    className={`pips-domino${selected ? ' pips-domino-selected' : ''}${placed ? ' pips-domino-used' : ''}`}
                    type="button"
                    key={domino.id}
                    ref={(element) => { trayRefs.current[index] = element }}
                    aria-label={`Domino ${domino.id + 1}, ${domino.values[0]} and ${domino.values[1]} pips${placed ? ', placed' : selected ? ', selected' : ''}`}
                    aria-pressed={selected}
                    disabled={placed || state.phase === 'complete'}
                    onClick={() => sendAction({ type: 'select', dominoId: domino.id })}
                  >
                    <DominoFace value={domino.values[0]} />
                    <span className="pips-domino-divider" aria-hidden="true" />
                    <DominoFace value={domino.values[1]} />
                  </button>
                )
              })}
            </div>

            <div className="pips-actions">
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'rotate' })} disabled={state.selectedDominoId === null || state.phase === 'complete'}>Rotate (R)</button>
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'flip' })} disabled={state.selectedDominoId === null || state.phase === 'complete'}>Flip (F)</button>
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'undo' })} disabled={state.placements.length === 0 || state.phase === 'complete'}>Undo</button>
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'restart' })} disabled={restartDisabled}>Restart</button>
            </div>
            <p className="pips-status" role="status" aria-live="polite">{state.message}</p>
            <div className="pips-console-footer"><span>TOUCH · CLICK · ENTER</span><span>{state.undos} {state.undos === 1 ? 'UNDO' : 'UNDOS'}</span></div>
          </div>
          <p className="pips-keyboard-hint">Select a domino and a board cell. Press R to rotate, F to flip, or Backspace to undo.</p>
        </div>
      </div>
    </section>
  )
}
