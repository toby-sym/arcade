import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createSwitchyardState,
  formatSwitchyardTime,
  SWITCHYARD_DESTINATIONS,
  switchyardApproachDuration,
  switchyardReducer,
  SWITCHYARD_DELIVERIES_TO_WIN,
  SWITCHYARD_PASS_DURATION_MS,
  type SwitchyardDestination,
} from './switchyard'

interface SwitchyardGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
  reduceMotion: boolean
}

const STATION_Y = [72, 180, 288] as const

export function SwitchyardGame({ onBack, bestScore, onRecordScore, reduceMotion }: SwitchyardGameProps) {
  const today = utcDateKey()
  const [state, dispatch] = useReducer(switchyardReducer, today, createSwitchyardState)
  const fieldRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const previousResult = useRef({ deliveries: state.deliveries, misses: state.misses, phase: state.phase })
  const shipment = state.schedule[state.shipmentIndex]
  const approachDuration = switchyardApproachDuration(state.deliveries)
  const approachProgress = state.journeyPhase === 'approach' ? Math.min(1, state.journeyElapsedMs / approachDuration) : 1
  const passProgress = state.journeyPhase === 'pass' ? Math.min(1, state.journeyElapsedMs / SWITCHYARD_PASS_DURATION_MS) : 0
  const markerRoute = state.journeyPhase === 'pass' ? state.switchRoute : null
  const markerPoint = trainPoint(approachProgress, passProgress, markerRoute, reduceMotion)
  const remaining = state.journeyPhase === 'approach' ? Math.max(0, approachDuration - state.journeyElapsedMs) : 0
  const shiftTime = formatSwitchyardTime(state.elapsedMs)

  useEffect(() => {
    if (state.score > 0) onRecordScore(state.score)
  }, [onRecordScore, state.score])

  useEffect(() => {
    const previous = previousResult.current
    if (state.phase === 'won' && previous.phase !== 'won') playSound('win')
    else if (state.phase === 'over' && previous.phase !== 'over') playSound('lose')
    else if (state.deliveries > previous.deliveries) playSound('score')
    else if (state.misses > previous.misses) playSound('miss')
    previousResult.current = { deliveries: state.deliveries, misses: state.misses, phase: state.phase }
  }, [playSound, state.deliveries, state.misses, state.phase])

  useEffect(() => {
    if (state.phase !== 'playing') return
    let frame = 0
    let previousTime = window.performance.now()
    const update = (time: number) => {
      const deltaMs = Math.min(Math.max(time - previousTime, 0), 50)
      previousTime = time
      dispatch({ type: 'tick', deltaMs })
      frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [state.phase])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) dispatch({ type: 'pause' })
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  const focusField = () => window.requestAnimationFrame(() => fieldRef.current?.focus())
  const start = () => {
    dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusField()
  }
  const restart = () => {
    dispatch({ type: 'restart' })
    focusField()
  }
  const choose = (destination: SwitchyardDestination) => dispatch({ type: 'switch', destination })

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLButtonElement && (event.code === 'Space' || event.key === 'Enter')) return
    if (event.key === 'Escape') {
      event.preventDefault()
      if (state.phase === 'playing') dispatch({ type: 'pause' })
      else if (state.phase === 'paused') dispatch({ type: 'resume' })
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
    if (event.key >= '1' && event.key <= '3') {
      event.preventDefault()
      choose(Number(event.key) - 1 as SwitchyardDestination)
      return
    }
    if (event.key.startsWith('Arrow') && state.phase === 'playing' && state.journeyPhase === 'approach') {
      event.preventDefault()
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
      choose(((state.switchRoute + direction + SWITCHYARD_DESTINATIONS.length) % SWITCHYARD_DESTINATIONS.length) as SwitchyardDestination)
    }
  }

  return (
    <section className="snake-view switchyard-view" aria-labelledby="switchyard-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout switchyard-layout">
        <div className="snake-copy switchyard-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> ARCADE DISPATCH · {today}</p>
          <h1 id="switchyard-title">Switchyard<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Read the signal. Throw the switch. Keep the freight moving.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Every freight car shows the depot it needs. Choose that depot before the car reaches the junction. Press <strong>1–3</strong>, use the arrow keys, or tap a switch button.</p>
            <p>A correct line earns points and builds your streak. Three missed depots end the shift; route fifteen cars safely to finish it. The daily timetable is the same for everyone on the UTC date.</p>
            <p><strong>Escape</strong> pauses, <strong>Space</strong> starts or resumes, and <strong>R</strong> restarts the shift. The lever stays put between cars, so check each new signal.</p>
          </div>

          <div className="score-card switchyard-score" aria-label={`Score ${state.score}. ${state.deliveries} of ${SWITCHYARD_DELIVERIES_TO_WIN} deliveries. ${state.lives} lives remain. ${state.streak} in a row. Shift time ${shiftTime}. ${bestScore === null ? 'No local best yet.' : `Local best ${bestScore} points.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">SHIFT SCORE</span>
              <strong className="score-value">{String(state.score).padStart(4, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
            <div className="breakout-stats">
              <span><strong>{state.deliveries}</strong> / {SWITCHYARD_DELIVERIES_TO_WIN} drops</span>
              <span><strong>{state.lives}</strong> lives</span>
              <span><strong>{state.streak}</strong> streak</span>
              <span><strong>{shiftTime}</strong> elapsed</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST SHIFT · THIS BROWSER</span>
              <strong className="score-value">{bestScore === null ? '—' : String(bestScore).padStart(4, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
          </div>
          <p className="switchyard-local-note">Your highest shift score is saved in this browser and does not sync.</p>
          <div className="game-actions">
            {state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Start the shift <span aria-hidden="true">→</span></button>
            ) : state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => dispatch({ type: 'pause' })}>Pause shift <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume shift <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Run the timetable again <span aria-hidden="true">→</span></button>
            )}
            {state.phase !== 'ready' && <button className="button button-quiet" type="button" onClick={restart}>Restart shift</button>}
          </div>
        </div>

        <div className="play-column switchyard-play-column">
          <div className="switchyard-console" onKeyDown={handleKeyDown}>
            <div className="frame-topline">
              <span>YARD 29</span>
              <span className={`frame-light${state.phase === 'won' ? ' phase-complete' : ''}`}><i />{state.phase === 'playing' ? `CAR ${state.shipmentIndex + 1} / ${state.schedule.length}` : state.phase.toUpperCase()}</span>
            </div>
            <div className="switchyard-target">
              <span className="score-caption">{state.journeyPhase === 'approach' ? 'NEXT ARRIVAL' : 'LAST ROUTE'}</span>
              <strong>{shipment ? `${capitalize(shipment.cargo)} · ${SWITCHYARD_DESTINATIONS[shipment.destination].name}` : 'Timetable complete'}</strong>
              <span>{state.journeyPhase === 'approach' ? `Junction in ${(remaining / 1000).toFixed(1)} seconds` : state.outcome === 'delivered' ? 'Cargo delivered safely' : 'Car left by the wrong line'}</span>
            </div>
            <div
              ref={fieldRef}
              className={`switchyard-field${state.phase === 'paused' ? ' is-paused' : ''}`}
              role="group"
              aria-label="Switchyard track and depot controls"
              tabIndex={0}
            >
              <svg className="switchyard-map" viewBox="0 0 600 360" aria-hidden="true">
                <defs>
                  <filter id="switchyard-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <path className="switchyard-rail-bed" d="M22 180 H300" />
                {STATION_Y.map((y, index) => <path key={`bed-${index}`} className={`switchyard-rail-bed switchyard-rail-bed-${index}`} d={branchPath(y)} />)}
                <path className="switchyard-rail-line" d="M22 180 H300" />
                {STATION_Y.map((y, index) => <path key={`rail-${index}`} className={`switchyard-rail-line switchyard-rail-${index}`} d={branchPath(y)} />)}
                <path className="switchyard-rail-ties" d="M52 165v30 M86 165v30 M120 165v30 M154 165v30 M188 165v30 M222 165v30 M256 165v30" />
                <circle className="switchyard-switch-core" cx="300" cy="180" r="22" />
                <line className={`switchyard-lever switchyard-lever-${state.switchRoute}`} x1="300" y1="180" x2={state.switchRoute === 0 ? 325 : state.switchRoute === 1 ? 337 : 325} y2={STATION_Y[state.switchRoute]} />
                <circle className={`switchyard-switch-light switchyard-light-${state.switchRoute}`} cx="300" cy="180" r="8" />
                {STATION_Y.map((y, index) => {
                  const station = SWITCHYARD_DESTINATIONS[index]!
                  return (
                    <g key={station.name} className={`switchyard-station switchyard-station-${station.color}${state.switchRoute === index ? ' is-selected' : ''}${shipment?.destination === index ? ' is-target' : ''}`} transform={`translate(520 ${y})`}>
                      <rect x="0" y="-28" width="72" height="56" rx="5" />
                      <text x="36" y="-2" textAnchor="middle">{station.glyph}</text>
                      <text className="switchyard-station-name" x="36" y="14" textAnchor="middle">{station.name.toUpperCase()}</text>
                    </g>
                  )
                })}
                {shipment && state.phase !== 'ready' && (
                  <g className={`switchyard-train switchyard-train-${SWITCHYARD_DESTINATIONS[shipment.destination].color}${state.outcome === 'misrouted' ? ' is-misrouted' : ''}`} transform={`translate(${markerPoint.x} ${markerPoint.y})`} filter="url(#switchyard-glow)">
                    <rect x="-25" y="-14" width="50" height="28" rx="5" />
                    <path d="M-17 14v5 M17 14v5" />
                    <text x="0" y="5" textAnchor="middle">{SWITCHYARD_DESTINATIONS[shipment.destination].glyph}</text>
                  </g>
                )}
              </svg>
              <div className="switchyard-track-meter" role="progressbar" aria-label="Time until the junction" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(approachProgress * 100)}>
                <span style={{ width: `${approachProgress * 100}%` }} />
              </div>
              {(state.phase === 'ready' || state.phase === 'paused' || state.phase === 'won' || state.phase === 'over') && (
                <div className="switchyard-overlay">
                  <strong>{state.phase === 'ready' ? 'CLEAR THE LINE' : state.phase === 'paused' ? 'SHIFT PAUSED' : state.phase === 'won' ? 'SHIFT COMPLETE' : 'END OF THE LINE'}</strong>
                  <span>{state.phase === 'ready' ? 'Start the shift, then throw the first switch.' : state.phase === 'paused' ? 'The timetable is stopped. Your shift is safe.' : `${state.deliveries} deliveries · ${state.score} points · ${shiftTime}`}</span>
                  {state.phase === 'ready' && <button className="button button-primary" type="button" onClick={start}>Start the shift</button>}
                  {state.phase === 'paused' && <button className="button button-primary" type="button" onClick={start}>Resume shift</button>}
                  {(state.phase === 'won' || state.phase === 'over') && <button className="button button-primary" type="button" onClick={restart}>Run it again</button>}
                </div>
              )}
            </div>
            <div className="switchyard-controls" aria-label="Depot switches">
              {SWITCHYARD_DESTINATIONS.map((destination, index) => (
                <button
                  key={destination.name}
                  className={`switchyard-route-button switchyard-route-${destination.color}${state.switchRoute === index ? ' is-selected' : ''}${shipment?.destination === index ? ' is-target' : ''}`}
                  type="button"
                  aria-pressed={state.switchRoute === index}
                  disabled={state.phase !== 'playing' || state.journeyPhase !== 'approach'}
                  onClick={() => choose(index as SwitchyardDestination)}
                >
                  <span aria-hidden="true">{destination.glyph}</span>
                  <strong>{destination.name}</strong>
                  <small>{index + 1} · THROW LEVER</small>
                </button>
              ))}
            </div>
            <p className="switchyard-status" role="status" aria-live="polite">{state.message}</p>
            <div className="switchyard-console-footer"><span>1–3 DEPOT · ARROWS SWITCH · ESC PAUSES</span><span>{state.lives} / 3 LIVES</span></div>
          </div>
          <p className="switchyard-keyboard-hint">Focus the track to use 1–3 or the arrow keys. Set the route before the countdown ends.</p>
        </div>
      </div>
    </section>
  )
}

function branchPath(y: number): string {
  if (y === 180) return 'M300 180 H520'
  return `M300 180 C370 180 402 ${y} 520 ${y}`
}

function trainPoint(approach: number, pass: number, route: SwitchyardDestination | null, reduceMotion: boolean): { x: number; y: number } {
  if (route === null) return { x: reduceMotion ? 185 : 34 + approach * 266, y: 180 }
  const destinationY = STATION_Y[route]
  if (reduceMotion) return { x: 405, y: destinationY }
  const t = pass
  const p0 = { x: 300, y: 180 }
  const p1 = { x: 370, y: 180 }
  const p2 = { x: 402, y: destinationY }
  const p3 = { x: 520, y: destinationY }
  const inverse = 1 - t
  return {
    x: inverse ** 3 * p0.x + 3 * inverse ** 2 * t * p1.x + 3 * inverse * t ** 2 * p2.x + t ** 3 * p3.x,
    y: inverse ** 3 * p0.y + 3 * inverse ** 2 * t * p1.y + 3 * inverse * t ** 2 * p2.y + t ** 3 * p3.y,
  }
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1)
}

