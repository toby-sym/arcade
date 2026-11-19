import { useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createTideglassState,
  tideglassProgress,
  tideglassReducer,
  TIDEGLASS_BOARD_SIZE,
  TIDEGLASS_BUOY_NAMES,
  type TideglassBuoy,
  type TideglassDirection,
  type TideglassProgress,
} from './tideglass'

interface TideglassGameProps {
  onBack: () => void
  bestMoves: number | null
  progress: TideglassProgress | null
  onSaveProgress: (progress: TideglassProgress | null) => void
  reduceMotion: boolean
}

const DIRECTIONS: Array<{ direction: TideglassDirection; label: string; symbol: string }> = [
  { direction: 'up', label: 'North', symbol: '↑' },
  { direction: 'right', label: 'East', symbol: '→' },
  { direction: 'down', label: 'South', symbol: '↓' },
  { direction: 'left', label: 'West', symbol: '←' },
]
const BUOY_SHAPES = ['●', '◆', '■']

export function TideglassGame({ onBack, bestMoves, progress, onSaveProgress, reduceMotion }: TideglassGameProps) {
  const today = utcDateKey()
  const boardRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    tideglassReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createTideglassState(date, saved),
  )
  const wallSet = new Set(state.puzzle.walls)
  const phaseLabel = state.phase === 'complete' ? 'BERTHED' : state.phase.toUpperCase()

  function sendAction(action: Parameters<typeof tideglassReducer>[1]) {
    const next = tideglassReducer(state, action)
    if (next === state) return
    dispatch(action)
    onSaveProgress(tideglassProgress(next))
    if (next.phase === 'complete' && state.phase !== 'complete') playSound('win')
    else if (next.actionCount > state.actionCount) playSound(action.type === 'move' ? 'hit' : 'score')
  }

  const focusBoard = () => window.requestAnimationFrame(() => boardRef.current?.focus())
  const start = () => {
    sendAction({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusBoard()
  }
  const restart = () => {
    sendAction({ type: 'restart' })
    focusBoard()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return
    if (event.key === 'Escape') {
      event.preventDefault()
      if (state.phase === 'playing' || state.phase === 'paused') sendAction({ type: state.phase === 'paused' ? 'resume' : 'pause' })
      return
    }
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      restart()
      return
    }
    if ((event.key === ' ' || event.code === 'Space') && (state.phase === 'ready' || state.phase === 'paused')) {
      event.preventDefault()
      start()
      return
    }
    const selection = Number(event.key) - 1
    if (selection >= 0 && selection < TIDEGLASS_BUOY_NAMES.length && state.phase === 'playing') {
      event.preventDefault()
      sendAction({ type: 'select', buoy: selection as TideglassBuoy })
      return
    }
    const keys: Record<string, TideglassDirection> = {
      ArrowUp: 'up', w: 'up',
      ArrowRight: 'right', d: 'right',
      ArrowDown: 'down', s: 'down',
      ArrowLeft: 'left', a: 'left',
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const direction = keys[key]
    if (direction) {
      event.preventDefault()
      sendAction({ type: 'move', direction })
    }
  }

  const occupiedSluice = state.puzzle.sluices.some((cell) => state.positions.includes(cell))
  const solved = state.positions.filter((position, index) => position === state.puzzle.docks[index]).length
  const buoyStatus = (buoy: TideglassBuoy) => state.positions[buoy] === state.puzzle.docks[buoy] ? 'moored' : 'adrift'

  return (
    <section className="snake-view tideglass-view" aria-labelledby="tideglass-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout tideglass-layout">
        <div className="snake-copy tideglass-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY HARBOR · UTC</p>
          <h1 id="tideglass-title">Tideglass<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Set the current. Open a channel. Bring every buoy home.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Guide three colored buoys into berths with matching colors. Select a buoy, then send it one water cell with each current. Breakwaters and other buoys block the way.</p>
            <p>Tap a sluice on the board to open or close it. A buoy cannot pass through a closed gate, and you cannot close a gate while a buoy occupies it. Each buoy moors when it reaches its own berth.</p>
            <p>Use <strong>Arrow keys</strong> or <strong>W A S D</strong> to move, <strong>1–3</strong> to select a buoy, or tap the on-screen controls. <strong>Space</strong> starts or resumes, <strong>Escape</strong> pauses, and <strong>R</strong> restarts.</p>
          </div>

          <div className="score-card tideglass-score" aria-label={`Moves ${state.actionCount}; ${solved} of 3 buoys moored; par ${state.puzzle.par}; ${bestMoves === null ? 'no local best yet' : `local best ${bestMoves} moves`}.`}>
            <div className="breakout-score-main">
              <span className="score-caption">HARBOR MOVES</span>
              <strong className="score-value">{String(state.actionCount).padStart(2, '0')}</strong>
              <span className="score-unit">steps + sluice changes</span>
            </div>
            <div className="breakout-stats">
              <span><strong>{solved}</strong> / 3 buoys moored</span>
              <span><strong>{state.puzzle.par}</strong> move par</span>
              <span><strong>{TIDEGLASS_BUOY_NAMES[state.selectedBuoy]}</strong> selected</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">FEWEST MOVES · THIS BROWSER</span>
              <strong className="score-value">{bestMoves === null ? '—' : String(bestMoves).padStart(2, '0')}</strong>
              <span className="score-unit">moves</span>
            </div>
          </div>
          <p className="tideglass-local-note">Your best route is saved in this browser and does not sync.</p>

          <div className="game-actions">
            {state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Start the tide <span aria-hidden="true">→</span></button>
            ) : state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'pause' })}>Pause harbor <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume harbor <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Play today's harbor again <span aria-hidden="true">→</span></button>
            )}
            {state.phase !== 'ready' && <button className="button button-quiet" type="button" onClick={restart}>Restart harbor</button>}
          </div>
        </div>

        <div className="play-column tideglass-play-column">
          <div className={`tideglass-console${reduceMotion ? ' is-reduced-motion' : ''}`} onKeyDown={handleKeyDown}>
            <div className="frame-topline">
              <span>HARBOR 01 · {state.date.replaceAll('-', '.')}</span>
              <span className={`frame-light${state.phase === 'complete' ? ' phase-complete' : ''}`}><i />{phaseLabel}</span>
            </div>
            <div className="tideglass-target">
              <span className="score-caption">TODAY'S MOORINGS</span>
              <strong>Match each buoy to its berth</strong>
              <span>PAR {state.puzzle.par} · {state.puzzle.sluices.length} SLUICES</span>
            </div>

            <div className="tideglass-field">
              <div ref={boardRef} className="tideglass-board" role="grid" aria-label={`Tideglass harbor board, ${TIDEGLASS_BOARD_SIZE} by ${TIDEGLASS_BOARD_SIZE}`} aria-describedby="tideglass-keyboard-hint" tabIndex={0}>
                {Array.from({ length: TIDEGLASS_BOARD_SIZE }, (_, row) => (
                  <div className="tideglass-row" role="row" key={row}>
                    {Array.from({ length: TIDEGLASS_BOARD_SIZE }, (_, column) => {
                      const index = row * TIDEGLASS_BOARD_SIZE + column
                      const buoy = state.positions.findIndex((position) => position === index)
                      const dock = state.puzzle.docks.findIndex((position) => position === index)
                      const sluice = state.puzzle.sluices.indexOf(index)
                      const wall = wallSet.has(index)
                      const open = sluice >= 0 && state.openSluices[sluice]
                      const classes = [
                        'tideglass-cell',
                        wall ? 'is-breakwater' : '',
                        sluice >= 0 ? `is-sluice ${open ? 'is-open' : 'is-closed'}` : '',
                        dock >= 0 ? `has-berth berth-${dock}` : '',
                        buoy >= 0 ? `has-buoy buoy-${buoy}` : '',
                        buoy === state.selectedBuoy ? 'is-selected' : '',
                        buoy >= 0 && buoy === dock ? 'is-moored' : '',
                      ].filter(Boolean).join(' ')
                      const label = wall ? 'Breakwater' : sluice >= 0
                        ? `Sluice ${sluice + 1}, ${open ? 'open' : 'closed'}. ${open ? 'Close' : 'Open'} sluice.`
                        : buoy >= 0
                          ? `${TIDEGLASS_BUOY_NAMES[buoy]} buoy, ${buoyStatus(buoy as TideglassBuoy)}${buoy === state.selectedBuoy ? ', selected' : ''}${dock >= 0 ? ', matching berth' : ''}`
                          : dock >= 0 ? `${TIDEGLASS_BUOY_NAMES[dock]} buoy berth` : `Water, row ${row + 1}, column ${column + 1}`
                      return (
                        <button
                          className={classes}
                          type="button"
                          role="gridcell"
                          key={index}
                          aria-label={label}
                          aria-pressed={buoy >= 0 ? buoy === state.selectedBuoy : sluice >= 0 ? Boolean(open) : undefined}
                          disabled={state.phase !== 'playing' || wall || (buoy < 0 && sluice < 0) || (buoy >= 0 && state.positions[buoy] === state.puzzle.docks[buoy])}
                          tabIndex={buoy >= 0 || sluice >= 0 ? 0 : -1}
                          onClick={() => {
                            if (buoy >= 0) sendAction({ type: 'select', buoy: buoy as TideglassBuoy })
                            else if (sluice >= 0) sendAction({ type: 'toggle-sluice', index: sluice })
                          }}
                        >
                          {wall && <span className="tideglass-rock-glyph" aria-hidden="true">▰</span>}
                          {sluice >= 0 && <span className="tideglass-gate-glyph" aria-hidden="true">{open ? '↔' : '×'}</span>}
                          {dock >= 0 && <span className="tideglass-berth-glyph" aria-hidden="true">{BUOY_SHAPES[dock]}</span>}
                          {buoy >= 0 && <span className="tideglass-buoy-glyph" aria-hidden="true">{BUOY_SHAPES[buoy]}</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              {(state.phase === 'ready' || state.phase === 'paused' || state.phase === 'complete') && (
                <div className="tideglass-overlay">
                  <strong>{state.phase === 'ready' ? 'HARBOR AT LOW TIDE' : state.phase === 'paused' ? 'HARBOR PAUSED' : 'ALL BUOYS MOORED'}</strong>
                  <span>{state.phase === 'ready' ? 'Open a channel and chart a route for each buoy.' : state.phase === 'paused' ? 'Your buoys are held in place.' : `${state.actionCount} moves · par ${state.puzzle.par} · today's harbor is calm.`}</span>
                  {state.phase === 'ready' && <button className="button button-primary" type="button" onClick={start}>Start the tide</button>}
                  {state.phase === 'paused' && <button className="button button-primary" type="button" onClick={start}>Resume harbor</button>}
                  {state.phase === 'complete' && <button className="button button-primary" type="button" onClick={restart}>Play today's harbor again</button>}
                </div>
              )}
            </div>

            <div className="tideglass-buoys" role="group" aria-label="Select a buoy">
              {TIDEGLASS_BUOY_NAMES.map((name, buoy) => {
                const moored = state.positions[buoy] === state.puzzle.docks[buoy]
                return (
                  <button
                    type="button"
                    className={`tideglass-buoy-select buoy-${buoy}${state.selectedBuoy === buoy ? ' is-active' : ''}${moored ? ' is-moored' : ''}`}
                    key={name}
                    aria-pressed={state.selectedBuoy === buoy}
                    disabled={state.phase !== 'playing' || moored}
                    onClick={() => sendAction({ type: 'select', buoy: buoy as TideglassBuoy })}
                  >
                    <span aria-hidden="true">{BUOY_SHAPES[buoy]}</span><strong>{name}</strong><small>{moored ? 'MOORED' : `BUOY ${buoy + 1}`}</small>
                  </button>
                )
              })}
            </div>

            <div className="tideglass-controls" role="group" aria-label="Send a current to the selected buoy">
              {DIRECTIONS.map(({ direction, label, symbol }) => (
                <button className={`tideglass-current-button tideglass-current-${direction}`} type="button" key={direction} aria-label={`Move selected buoy ${label.toLowerCase()}`} disabled={state.phase !== 'playing' || state.positions[state.selectedBuoy] === state.puzzle.docks[state.selectedBuoy]} onClick={() => sendAction({ type: 'move', direction })}>
                  <span aria-hidden="true">{symbol}</span><strong>{label}</strong>
                </button>
              ))}
            </div>
            <p className="tideglass-status" role="status" aria-live="polite">{state.message}</p>
            <div className="tideglass-console-footer"><span>ARROWS · W A S D · TOUCH</span><span>{solved} / 3 MOORED {occupiedSluice ? '· GATE OCCUPIED' : ''}</span></div>
          </div>
          <p id="tideglass-keyboard-hint" className="tideglass-keyboard-hint">Focus the harbor to move. Select buoys with 1–3; tap a gate tile to switch it. Each current step or gate change counts toward your route.</p>
        </div>
      </div>
    </section>
  )
}
