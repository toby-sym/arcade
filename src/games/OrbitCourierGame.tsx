import { useEffect, useReducer, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { orbitCourierHazardsAt, orbitCourierReducer, createOrbitCourierState, ORBIT_COURIER_DOCK_SPEED_LIMIT, ORBIT_COURIER_HEIGHT, ORBIT_COURIER_STATIONS, ORBIT_COURIER_START, ORBIT_COURIER_WIDTH, type OrbitCourierControl } from './orbitCourier'

interface OrbitCourierGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
}

const STARS = Array.from({ length: 44 }, (_, index) => ({
  x: (index * 157 + 41) % ORBIT_COURIER_WIDTH,
  y: (index * 97 + 23) % ORBIT_COURIER_HEIGHT,
  size: index % 7 === 0 ? 2 : 1,
}))

const KEY_CONTROLS: Record<string, OrbitCourierControl> = {
  ArrowLeft: 'left', a: 'left',
  ArrowRight: 'right', d: 'right',
  ArrowUp: 'thrust', w: 'thrust',
  ArrowDown: 'brake', s: 'brake',
}

export function OrbitCourierGame({ onBack, bestScore, onRecordScore }: OrbitCourierGameProps) {
  const [state, dispatch] = useReducer(orbitCourierReducer, undefined, createOrbitCourierState)
  const fieldRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const previousSoundState = useRef({ delivered: state.delivered, hull: state.hull, phase: state.phase })
  const input = useRef<Record<OrbitCourierControl, boolean>>({ left: false, right: false, thrust: false, brake: false })
  const keyboardTapTimers = useRef(new Map<OrbitCourierControl, number>())
  const speed = Math.hypot(state.ship.vx, state.ship.vy)
  const activeStation = ORBIT_COURIER_STATIONS[state.nextStation]
  const hazards = orbitCourierHazardsAt(state.elapsedMs)
  const elapsedSeconds = Math.floor(state.elapsedMs / 1000)
  const elapsedLabel = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`
  const phaseLabel = state.phase === 'playing' ? 'IN FLIGHT' : state.phase.toUpperCase()
  const missionDescription = state.phase === 'won'
    ? `Route complete. All ${state.delivered} packages delivered in ${elapsedLabel}. Final score ${state.score}.`
    : state.phase === 'over'
      ? `Courier lost after ${state.delivered} deliveries. Final score ${state.score}.`
      : activeStation
        ? `Delivery ${state.delivered + 1} of ${ORBIT_COURIER_STATIONS.length}: ${activeStation.cargo} to ${activeStation.name}. ${state.hull} hull points remain.`
        : 'All deliveries complete.'

  useEffect(() => {
    if (state.score > 0) onRecordScore(state.score)
  }, [onRecordScore, state.score])

  useEffect(() => {
    const previous = previousSoundState.current
    if (state.phase === 'won' && previous.phase !== 'won') playSound('win')
    else if (state.phase === 'over' && previous.phase !== 'over') playSound('lose')
    else if (state.hull < previous.hull) playSound('miss')
    else if (state.delivered > previous.delivered) playSound('score')
    previousSoundState.current = { delivered: state.delivered, hull: state.hull, phase: state.phase }
  }, [playSound, state.delivered, state.hull, state.phase])

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
    const releaseControl = (event: globalThis.KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      const control = KEY_CONTROLS[key]
      if (control) setControl(control, false)
    }
    const clearControls = () => {
      for (const control of Object.keys(input.current) as OrbitCourierControl[]) setControl(control, false)
    }
    const pauseWhenHidden = () => {
      if (document.hidden) {
        clearControls()
        dispatch({ type: 'pause' })
      }
    }
    window.addEventListener('keyup', releaseControl)
    window.addEventListener('blur', clearControls)
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => {
      window.removeEventListener('keyup', releaseControl)
      window.removeEventListener('blur', clearControls)
      document.removeEventListener('visibilitychange', pauseWhenHidden)
      for (const timer of keyboardTapTimers.current.values()) window.clearTimeout(timer)
      keyboardTapTimers.current.clear()
      clearControls()
    }
  }, [])

  function setControl(control: OrbitCourierControl, pressed: boolean) {
    input.current[control] = pressed
    dispatch({ type: 'control', control, pressed })
  }

  const focusField = () => window.requestAnimationFrame(() => fieldRef.current?.focus())
  const start = () => {
    dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusField()
  }
  const clearInputs = () => {
    for (const control of Object.keys(input.current) as OrbitCourierControl[]) setControl(control, false)
  }
  const pause = () => {
    clearInputs()
    dispatch({ type: 'pause' })
  }
  const restart = () => {
    input.current = { left: false, right: false, thrust: false, brake: false }
    dispatch({ type: 'restart' })
    focusField()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const control = KEY_CONTROLS[key]
    if (control) {
      event.preventDefault()
      if (state.phase === 'playing') setControl(control, true)
      return
    }
    if ((event.code === 'Space' || event.key === 'Enter') && event.target instanceof HTMLButtonElement) return
    if (event.code === 'Space') {
      event.preventDefault()
      if (state.phase === 'ready') start()
      else if (state.phase === 'playing' && !event.repeat) dispatch({ type: 'dock' })
      return
    }
    if (event.key === 'Escape' && state.phase === 'playing') {
      event.preventDefault()
      pause()
    } else if (event.key === 'Escape' && state.phase === 'paused') {
      event.preventDefault()
      start()
    } else if (key === 'r') {
      event.preventDefault()
      restart()
    }
  }

  const holdControl = (control: OrbitCourierControl) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (state.phase !== 'playing') return
    setControl(control, true)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Pointer capture is optional. */ }
  }
  const releaseControl = (control: OrbitCourierControl) => () => setControl(control, false)
  const keyboardTapControl = (control: OrbitCourierControl) => (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0 || state.phase !== 'playing') return
    const previousTimer = keyboardTapTimers.current.get(control)
    if (previousTimer !== undefined) window.clearTimeout(previousTimer)
    setControl(control, true)
    const timer = window.setTimeout(() => {
      keyboardTapTimers.current.delete(control)
      setControl(control, false)
    }, 150)
    keyboardTapTimers.current.set(control, timer)
  }

  return (
    <section className="snake-view orbit-courier-view" aria-labelledby="orbit-courier-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout orbit-courier-layout">
        <div className="snake-copy orbit-courier-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> ARCADE FLIGHT · ROUTE 27</p>
          <h1 id="orbit-courier-title">Orbit Courier<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Carry the cargo. Read the drift. Bring every package home.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Turn with <strong>Left / Right</strong> or <strong>A / D</strong>. Hold <strong>Up / W</strong> to thrust; hold <strong>Down / S</strong> to brake away your drift. The field wraps at its edges.</p>
            <p>Reach the gold station ring, slow below <strong>{ORBIT_COURIER_DOCK_SPEED_LIMIT}</strong>, then press <strong>Space</strong> or <strong>Dock cargo</strong>. Moving debris costs one of three hull points and sends you back to your last station.</p>
            <p>On a phone, hold the flight controls and tap <strong>Dock cargo</strong>. Escape pauses, and R restarts the route.</p>
          </div>
          <div className="score-card orbit-courier-score" aria-label={`Score ${state.score}. ${state.hull} hull points. ${state.delivered} of three deliveries complete. Flight time ${elapsedLabel}. ${bestScore === null ? 'No local best yet.' : `Local best ${bestScore} points.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">THIS FLIGHT</span>
              <strong className="score-value">{String(state.score).padStart(4, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
            <div className="breakout-stats">
              <span><strong>{state.hull}</strong> hull</span>
              <span><strong>{state.delivered}</strong> / 3 drops</span>
              <span><strong>{elapsedLabel}</strong> elapsed</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST FLIGHT · THIS BROWSER</span>
              <strong className="score-value">{bestScore === null ? '—' : String(bestScore).padStart(4, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
          </div>
          <div className="orbit-courier-route-card" aria-live="polite">
            <span className="score-caption">{activeStation ? `NEXT DROP · ${activeStation.name.toUpperCase()}` : 'ROUTE STATUS'}</span>
            <strong>{activeStation ? activeStation.cargo : state.phase === 'won' ? 'All cargo delivered' : 'Route complete'}</strong>
            <span>{activeStation ? `${state.delivered + 1} of 3 · brake below ${ORBIT_COURIER_DOCK_SPEED_LIMIT} to dock` : state.phase === 'over' ? 'Restart to launch again' : 'Safe flight, courier.'}</span>
          </div>
          <p className="orbit-courier-local-note">Your best flight stays saved in this browser and does not sync.</p>
          <div className="game-actions">
            {state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={pause}>Pause flight <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume flight <span aria-hidden="true">→</span></button>
            ) : state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Start flight <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Fly the route again <span aria-hidden="true">→</span></button>
            )}
            {state.phase !== 'ready' && <button className="button button-quiet" type="button" onClick={restart}>Restart route</button>}
          </div>
          <p className="keyboard-hint">Hold arrows / A-D · Up / W thrust · Down / S brake · Space docks</p>
        </div>

        <div className="play-column orbit-courier-play-column" onKeyDown={handleKeyDown}>
          <div className="orbit-courier-console">
            <div className="frame-topline"><span>FIELD 27 · COURIER ROUTE</span><span className={`frame-light phase-${state.phase}`}><i /> {phaseLabel}</span></div>
            <div ref={fieldRef} className={`orbit-courier-field phase-${state.phase}`} tabIndex={0} role="group" aria-label={`Orbit Courier playfield. ${missionDescription}`}>
              <svg className="orbit-courier-map" viewBox={`0 0 ${ORBIT_COURIER_WIDTH} ${ORBIT_COURIER_HEIGHT}`} role="img" aria-label={`Wraparound flight map with three delivery stations. ${missionDescription}`}>
                <defs>
                  <radialGradient id="orbit-space" cx="50%" cy="45%" r="75%"><stop offset="0" stopColor="#22213a" /><stop offset="1" stopColor="#10101c" /></radialGradient>
                  <filter id="orbit-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <rect width={ORBIT_COURIER_WIDTH} height={ORBIT_COURIER_HEIGHT} fill="url(#orbit-space)" />
                {STARS.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.size} className={index % 6 === 0 ? 'orbit-star is-bright' : 'orbit-star'} />)}
                {ORBIT_COURIER_STATIONS.map((station, index) => {
                  const visited = index < state.delivered
                  const current = index === state.nextStation && state.phase !== 'won' && state.phase !== 'over'
                  return (
                    <g key={station.name} className={`orbit-station${visited ? ' is-visited' : ''}${current ? ' is-target' : ''}`}>
                      <circle cx={station.x} cy={station.y} r="42" className="orbit-station-ring" />
                      <circle cx={station.x} cy={station.y} r="7" className="orbit-station-core" />
                    </g>
                  )
                })}
                <circle cx={ORBIT_COURIER_START.x} cy={ORBIT_COURIER_START.y} r="24" className="orbit-start-ring" />
                {hazards.map((hazard) => (
                  <g key={hazard.id} className="orbit-debris" transform={`translate(${hazard.x} ${hazard.y})`}>
                    <circle r={hazard.radius + 7} className="orbit-debris-glow" />
                    <path d={`M0 -${hazard.radius} L${hazard.radius * .72} -${hazard.radius * .55} L${hazard.radius} ${hazard.radius * .2} L${hazard.radius * .35} ${hazard.radius} L-${hazard.radius * .62} ${hazard.radius * .7} L-${hazard.radius} -${hazard.radius * .1} Z`} className="orbit-debris-rock" />
                    <circle cx="-4" cy="-2" r="2" className="orbit-debris-crater" />
                  </g>
                ))}
                <g className={`orbit-courier-ship${state.invulnerableMs > 0 && Math.floor(state.invulnerableMs / 100) % 2 === 0 ? ' is-blinking' : ''}`} transform={`translate(${state.ship.x} ${state.ship.y}) rotate(${state.ship.angle * 180 / Math.PI})`}>
                  {state.controls.thrust && <path d="M-6 11 L0 25 L6 11 Z" className="orbit-engine-flame" />}
                  <path d="M0 -17 L11 12 L0 7 L-11 12 Z" className="orbit-ship-hull" filter="url(#orbit-glow)" />
                  <path d="M0 -9 L4 5 L0 3 L-4 5 Z" className="orbit-ship-window" />
                  <rect x="-12" y="7" width="5" height="7" rx="1" className="orbit-cargo-pod" />
                  <rect x="7" y="7" width="5" height="7" rx="1" className="orbit-cargo-pod" />
                </g>
                <path d="M8 8h36M8 8v26M952 8h-36M952 8v26M8 592h36M8 592v-26M952 592h-36M952 592v-26" className="orbit-field-corners" />
              </svg>
              {ORBIT_COURIER_STATIONS.map((station, index) => (
                <span
                  key={station.name}
                  className={`orbit-map-station-tag orbit-map-station-tag-${index + 1}${index < state.delivered ? ' is-visited' : index === state.nextStation && state.phase !== 'won' && state.phase !== 'over' ? ' is-target' : ''}`}
                  style={{ left: `${station.x / ORBIT_COURIER_WIDTH * 100}%`, top: `${station.y / ORBIT_COURIER_HEIGHT * 100}%` }}
                  aria-hidden="true"
                >{station.name}</span>
              ))}
              <span className="orbit-map-start-tag" style={{ left: `${ORBIT_COURIER_START.x / ORBIT_COURIER_WIDTH * 100}%`, top: `${ORBIT_COURIER_START.y / ORBIT_COURIER_HEIGHT * 100}%` }} aria-hidden="true">Harbor Nine</span>
              {(state.phase === 'ready' || state.phase === 'paused' || state.phase === 'won' || state.phase === 'over') && (
                <div className="orbit-courier-overlay" aria-live="polite">
                  <strong>{state.phase === 'ready' ? 'Route ready' : state.phase === 'paused' ? 'Flight paused' : state.phase === 'won' ? 'Every package delivered' : 'Courier lost'}</strong>
                  <span>{state.phase === 'ready' ? 'Three stations. One careful route.' : state.phase === 'paused' ? 'Your cargo is secure.' : state.phase === 'won' ? `${state.score} points · ${state.hull} hull remaining` : `${state.delivered} of 3 drops · ${state.score} points`}</span>
                </div>
              )}
            </div>
            <div className="orbit-courier-console-footer"><span>DRIFT {Math.round(speed)} · DOCK UNDER {ORBIT_COURIER_DOCK_SPEED_LIMIT}</span><span>{state.hull} HULL · {elapsedLabel}</span></div>
          </div>

          <div className="orbit-courier-touch-controls" role="group" aria-label="Flight controls">
            <button className="orbit-control-button" type="button" aria-label="Turn left" disabled={state.phase !== 'playing'} onPointerDown={holdControl('left')} onPointerUp={releaseControl('left')} onPointerCancel={releaseControl('left')} onLostPointerCapture={releaseControl('left')} onClick={keyboardTapControl('left')}>↶<small>TURN</small></button>
            <button className="orbit-control-button orbit-thrust-button" type="button" aria-label="Thrust forward" disabled={state.phase !== 'playing'} onPointerDown={holdControl('thrust')} onPointerUp={releaseControl('thrust')} onPointerCancel={releaseControl('thrust')} onLostPointerCapture={releaseControl('thrust')} onClick={keyboardTapControl('thrust')}>▲<small>THRUST</small></button>
            <button className="orbit-control-button orbit-brake-button" type="button" aria-label="Brake drift" disabled={state.phase !== 'playing'} onPointerDown={holdControl('brake')} onPointerUp={releaseControl('brake')} onPointerCancel={releaseControl('brake')} onLostPointerCapture={releaseControl('brake')} onClick={keyboardTapControl('brake')}>■<small>BRAKE</small></button>
            <button className="orbit-control-button" type="button" aria-label="Turn right" disabled={state.phase !== 'playing'} onPointerDown={holdControl('right')} onPointerUp={releaseControl('right')} onPointerCancel={releaseControl('right')} onLostPointerCapture={releaseControl('right')} onClick={keyboardTapControl('right')}>↷<small>TURN</small></button>
            <button className="button button-primary orbit-dock-button" type="button" disabled={state.phase !== 'playing'} onClick={() => dispatch({ type: 'dock' })}>Dock cargo <span aria-hidden="true">↗</span></button>
          </div>
          <p className="orbit-courier-status" role="status" aria-live="polite">{state.message}</p>
        </div>
      </div>
    </section>
  )
}
