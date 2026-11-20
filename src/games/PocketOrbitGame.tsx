import { useEffect, useRef, useReducer, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createPocketOrbitState,
  pocketOrbitDistance,
  pocketOrbitPreview,
  pocketOrbitReducer,
  POCKET_ORBIT_BEACON_COUNT,
  type PocketOrbitAction,
} from './pocketOrbit'

export function PocketOrbitGame({ onBack, bestLaunches, onRecordLaunches, reduceMotion }: {
  onBack: () => void
  bestLaunches: number | null
  onRecordLaunches: (launches: number) => void
  reduceMotion: boolean
}) {
  const date = utcDateKey()
  const [state, dispatch] = useReducer(pocketOrbitReducer, date, createPocketOrbitState)
  const stateRef = useRef(state)
  const completedRef = useRef(false)
  const pauseButtonRef = useRef<HTMLButtonElement>(null)
  const playSound = useArcadeSound()
  const preview = pocketOrbitPreview(state)
  const beaconsCollected = state.beacons.filter(Boolean).length
  const angleDegrees = Math.round(state.aimAngle * 180 / Math.PI) % 360
  const phaseLabel = state.phase === 'ready' ? 'ORBIT READY'
    : state.phase === 'aiming' ? 'SET YOUR COURSE'
      : state.phase === 'flying' ? 'GRAVITY LIVE'
        : state.phase === 'paused' ? 'PAUSED' : 'DOCK SECURED'
  const shipAngle = state.phase === 'flying'
    ? Math.atan2(state.ship.vy, state.ship.vx) * 180 / Math.PI + 90
    : state.aimAngle * 180 / Math.PI + 90

  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    if (state.phase !== 'flying') return
    let frame = 0
    let previousTime = 0
    const tick = (time: number) => {
      if (previousTime > 0) dispatch({ type: 'tick', deltaMs: Math.min(50, time - previousTime) })
      previousTime = time
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [state.phase])

  useEffect(() => {
    const pauseWhenHidden = () => {
      const phase = stateRef.current.phase
      if (document.visibilityState === 'hidden' && (phase === 'aiming' || phase === 'flying')) dispatch({ type: 'pause' })
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  useEffect(() => {
    if (state.phase === 'ready') completedRef.current = false
    if (state.phase === 'complete' && !completedRef.current) {
      completedRef.current = true
      onRecordLaunches(state.launches)
      playSound('win')
    }
  }, [state.phase, state.launches, onRecordLaunches, playSound])

  useEffect(() => {
    if (state.phase === 'paused') window.requestAnimationFrame(() => pauseButtonRef.current?.focus())
  }, [state.phase])

  function send(action: PocketOrbitAction) {
    dispatch(action)
    if (action.type === 'launch') playSound('fire')
    if (action.type === 'adjust-angle' || action.type === 'adjust-power' || action.type === 'aim') playSound('signal')
  }

  function start() {
    send({ type: 'start' })
  }

  function pauseOrResume() {
    send({ type: state.phase === 'paused' ? 'resume' : 'pause' })
  }

  function restart() {
    completedRef.current = false
    send({ type: 'restart' })
  }

  function returnToFloor() {
    const phase = stateRef.current.phase
    if (phase === 'aiming' || phase === 'flying') send({ type: 'pause' })
    onBack()
  }

  function onSectionKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && (state.phase === 'aiming' || state.phase === 'flying' || state.phase === 'paused')) {
      event.preventDefault()
      pauseOrResume()
      return
    }
    if (event.key.toLowerCase() === 'r' && (state.phase === 'aiming' || state.phase === 'flying' || state.phase === 'paused' || state.phase === 'complete')) {
      event.preventDefault()
      restart()
      return
    }
    if (state.phase === 'ready' && (event.key === ' ' || event.key === 'Enter')) {
      if (event.target instanceof HTMLButtonElement) return
      event.preventDefault()
      start()
      return
    }
    if (state.phase !== 'aiming') return
    if ((event.key === ' ' || event.code === 'Space') && event.target instanceof HTMLButtonElement) return
    const action: PocketOrbitAction | null = event.key === 'ArrowLeft' ? { type: 'adjust-angle', degrees: -2 }
      : event.key === 'ArrowRight' ? { type: 'adjust-angle', degrees: 2 }
        : event.key === 'ArrowUp' ? { type: 'adjust-power', amount: 5 }
          : event.key === 'ArrowDown' ? { type: 'adjust-power', amount: -5 }
            : event.key === ' ' || event.code === 'Space' ? { type: 'launch' } : null
    if (action) {
      event.preventDefault()
      send(action)
    }
  }

  const orbitRadius = pocketOrbitDistance(state.course.start, state.course.well)
  const animationTrail = state.phase === 'aiming' ? preview : state.trail
  const trailPoints = animationTrail.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <section className={`snake-view pocketorbit-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="pocketorbit-title" onKeyDown={onSectionKeyDown}>
      <button className="back-link" type="button" onClick={returnToFloor}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout pocketorbit-layout">
        <div className="snake-copy pocketorbit-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY ORBIT FLIGHT · UTC</p>
          <h1 id="pocketorbit-title">Pocket Orbit<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Let gravity do the work. Find a clean arc through the beacons and bring your satellite home.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Adjust the launch direction and power, then release the satellite. Gravity bends its path around each well. Collect all three beacons and reach the dock to clear the course.</p>
            <p>Use <strong>Left / Right</strong> to turn the launch by two degrees and <strong>Up / Down</strong> to change power. Touch the on-screen controls on a phone. <strong>Space</strong> launches; <strong>Escape</strong> pauses; <strong>R</strong> restarts.</p>
          </div>
          <div className="score-card pocketorbit-score" aria-label={`Today ${state.course.date}. ${beaconsCollected} of ${POCKET_ORBIT_BEACON_COUNT} beacons collected. ${state.launches} launches. ${bestLaunches === null ? 'No personal best yet.' : `Fewest launches ${bestLaunches}.`}`}>
            <div><span className="score-caption">TODAY · {state.course.date}</span><strong className="score-value">{beaconsCollected}<small> / {POCKET_ORBIT_BEACON_COUNT}</small></strong><span className="score-unit">beacons aboard</span></div>
            <div className="pocketorbit-run-stat"><span className="score-caption">THIS RUN</span><strong className="score-value">{state.launches}</strong><span className="score-unit">launches</span></div>
            <div className="local-best-readout"><span className="score-caption">FEWEST · THIS BROWSER</span><strong className="score-value">{bestLaunches === null ? '—' : bestLaunches}</strong><span className="score-unit">launches to dock</span></div>
          </div>
          <p className="pocketorbit-local-note">Today’s course is generated in the app. Your fewest-launch clear stays in this browser and does not sync.</p>
        </div>

        <div className="play-column pocketorbit-play-column">
          <div className={`pocketorbit-console phase-${state.phase}`} aria-label="Pocket Orbit daily course">
            <div className="frame-topline"><span>FIELD 54</span><span className={`frame-light ${state.phase === 'complete' ? 'phase-complete' : ''}`}><i /> {phaseLabel}</span></div>
            <div className="pocketorbit-roundline"><div><span>DAILY FLIGHT</span><strong>{state.course.date} · {state.elapsedMs > 0 ? `${(state.elapsedMs / 1000).toFixed(1)} SEC` : 'THREE BEACONS'}</strong></div><b>{String(state.launches).padStart(2, '0')}<small> LAUNCHES</small></b></div>

            <div className="pocketorbit-flight-deck">
              <svg className="pocketorbit-field" viewBox="0 0 960 600" role="img" aria-label={`Space flight field. ${beaconsCollected} of three beacons collected. Satellite at ${Math.round(state.ship.x)}, ${Math.round(state.ship.y)}.`}>
                <defs>
                  <radialGradient id="pocketorbit-well-core"><stop offset="0" stopColor="#ffe8a7" /><stop offset=".22" stopColor="#ffbb6c" /><stop offset=".57" stopColor="#c671ff" stopOpacity=".75" /><stop offset="1" stopColor="#9d5cff" stopOpacity="0" /></radialGradient>
                  <radialGradient id="pocketorbit-moon-core"><stop offset="0" stopColor="#84efff" /><stop offset="1" stopColor="#5388ff" stopOpacity="0" /></radialGradient>
                  <filter id="pocketorbit-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  <pattern id="pocketorbit-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#8e78b5" strokeOpacity=".11" strokeWidth="1" /></pattern>
                </defs>
                <rect width="960" height="600" fill="#11101d" />
                <rect width="960" height="600" fill="url(#pocketorbit-grid)" />
                {Array.from({ length: 34 }, (_, index) => <circle key={index} cx={(index * 173 + 29) % 944 + 8} cy={(index * 97 + 41) % 584 + 8} r={index % 4 === 0 ? 1.7 : 1} fill="#d9d1ee" opacity={index % 3 === 0 ? .55 : .26} />)}
                <circle cx={state.course.well.x} cy={state.course.well.y} r={orbitRadius} className="pocketorbit-guide-orbit" />
                <circle cx={state.course.well.x} cy={state.course.well.y} r={state.course.well.radius * 3.5} fill="url(#pocketorbit-well-core)" opacity=".5" />
                <circle cx={state.course.well.x} cy={state.course.well.y} r={state.course.well.radius} className="pocketorbit-well" filter="url(#pocketorbit-glow)" />
                <circle cx={state.course.moon.x} cy={state.course.moon.y} r={state.course.moon.radius * 2.8} fill="url(#pocketorbit-moon-core)" opacity=".6" />
                <circle cx={state.course.moon.x} cy={state.course.moon.y} r={state.course.moon.radius} className="pocketorbit-moon" />
                <text x={state.course.well.x} y={state.course.well.y + state.course.well.radius + 19} className="pocketorbit-object-label" textAnchor="middle">ASTER WELL</text>
                <text x={state.course.moon.x} y={state.course.moon.y + state.course.moon.radius + 17} className="pocketorbit-object-label moon-label" textAnchor="middle">DRIFT MOON</text>

                {state.phase === 'aiming' && <polyline points={trailPoints} className="pocketorbit-preview-path" />}
                {state.phase === 'flying' && <polyline points={trailPoints} className="pocketorbit-live-trail" />}

                {state.course.beacons.map((beacon, index) => <g key={beacon.id} className={`pocketorbit-beacon${state.beacons[index] ? ' is-collected' : ''}`}>
                  <circle cx={beacon.x} cy={beacon.y} r={beacon.radius} className="pocketorbit-beacon-ring" />
                  <path d={`M${beacon.x} ${beacon.y - 9} l8 9 -8 9 -8 -9Z`} className="pocketorbit-beacon-gem" />
                  <text x={beacon.x} y={beacon.y + beacon.radius + 16} className="pocketorbit-object-label" textAnchor="middle">B{index + 1}</text>
                  {state.beacons[index] && <text x={beacon.x} y={beacon.y + 4} className="pocketorbit-check" textAnchor="middle">✓</text>}
                </g>)}

                <g className="pocketorbit-dock">
                  <circle cx={state.course.dock.x} cy={state.course.dock.y} r={state.course.dock.radius} className="pocketorbit-dock-ring" />
                  <circle cx={state.course.dock.x} cy={state.course.dock.y} r="8" className="pocketorbit-dock-core" />
                  <text x={state.course.dock.x} y={state.course.dock.y + state.course.dock.radius + 17} className="pocketorbit-object-label" textAnchor="middle">DOCK</text>
                </g>

                {state.phase === 'aiming' && <g className="pocketorbit-aim-vector">
                  <line x1={state.course.start.x} y1={state.course.start.y} x2={state.course.start.x + Math.cos(state.aimAngle) * 65} y2={state.course.start.y + Math.sin(state.aimAngle) * 65} />
                </g>}
                {state.phase !== 'complete' && <g transform={`translate(${state.ship.x} ${state.ship.y}) rotate(${shipAngle})`} className={`pocketorbit-ship${state.phase === 'flying' ? ' is-flying' : ''}`}>
                  <path d="M0 -15 L9 12 L0 7 L-9 12Z" />
                  {state.phase === 'flying' && !reduceMotion && <path d="M-4 12 L0 20 L4 12" className="pocketorbit-engine-flare" />}
                </g>}
                {state.phase === 'complete' && <g className="pocketorbit-complete-mark"><circle cx={state.course.dock.x} cy={state.course.dock.y} r="17" /><path d={`M${state.course.dock.x - 7} ${state.course.dock.y} l5 5 10 -11`} /></g>}
              </svg>

              {state.phase !== 'flying' && <div className="pocketorbit-overlay" aria-hidden="true"><div>
                <span>{state.phase === 'ready' ? 'A NEW ORBIT AWAITS' : state.phase === 'paused' ? 'FLIGHT ON HOLD' : state.phase === 'complete' ? 'DOCK SECURED' : 'TUNE THE LAUNCH'}</span>
                <strong>{state.phase === 'ready' ? 'Read the wells. Set your course.' : state.phase === 'paused' ? 'Pick up where you left off.' : state.phase === 'complete' ? `${state.launches} ${state.launches === 1 ? 'launch' : 'launches'} to bring it home.` : 'Follow the dotted arc through all three beacons.'}</strong>
                <p>{state.phase === 'ready' ? 'The dotted orbit shows the pull of the central well.' : state.phase === 'paused' ? 'The satellite is held in place while this game stays open.' : state.phase === 'complete' ? 'The course is complete. A fresh orbit arrives tomorrow.' : 'Small changes to angle and power can change the whole flight.'}</p>
              </div></div>}
            </div>

            <div className="pocketorbit-flight-status" role="status" aria-live="polite"><span>{state.message}</span>{state.phase === 'flying' && <b>{(state.elapsedMs / 1000).toFixed(1)}<small> SEC</small></b>}</div>
            <div className="pocketorbit-controls" role="group" aria-label="Launch controls">
              <div className="pocketorbit-dial-group" role="group" aria-label="Launch direction">
                <span>ANGLE <strong>{angleDegrees}°</strong></span>
                <button type="button" onClick={() => send({ type: 'adjust-angle', degrees: -2 })} disabled={state.phase !== 'aiming'} aria-label="Turn launch angle counterclockwise two degrees">−2° <kbd>←</kbd></button>
                <button type="button" onClick={() => send({ type: 'adjust-angle', degrees: 2 })} disabled={state.phase !== 'aiming'} aria-label="Turn launch angle clockwise two degrees">+2° <kbd>→</kbd></button>
              </div>
              <div className="pocketorbit-dial-group" role="group" aria-label="Launch power">
                <span>POWER <strong>{Math.round(state.power)}</strong></span>
                <button type="button" onClick={() => send({ type: 'adjust-power', amount: -5 })} disabled={state.phase !== 'aiming'} aria-label="Reduce launch power by five">−5 <kbd>↓</kbd></button>
                <button type="button" onClick={() => send({ type: 'adjust-power', amount: 5 })} disabled={state.phase !== 'aiming'} aria-label="Increase launch power by five">+5 <kbd>↑</kbd></button>
              </div>
            </div>

            <div className="pocketorbit-actions">
              {state.phase === 'ready' ? <button type="button" className="pocketorbit-action pocketorbit-action-primary" onClick={start}>Start today’s flight <kbd>ENTER</kbd></button>
                : state.phase === 'aiming' ? <button type="button" className="pocketorbit-action pocketorbit-action-primary" onClick={() => send({ type: 'launch' })}>Launch satellite <kbd>SPACE</kbd></button>
                  : state.phase === 'paused' ? <button ref={pauseButtonRef} type="button" className="pocketorbit-action pocketorbit-action-primary" onClick={pauseOrResume}>Resume flight <kbd>ESC</kbd></button>
                    : state.phase === 'complete' ? <button type="button" className="pocketorbit-action pocketorbit-action-primary" onClick={restart}>Fly today’s course again <kbd>R</kbd></button>
                      : <button ref={pauseButtonRef} type="button" className="pocketorbit-action pocketorbit-action-pause" onClick={pauseOrResume}>Pause flight <kbd>ESC</kbd></button>}
              {state.phase !== 'ready' && <button type="button" className="pocketorbit-action" onClick={restart}>Restart today <kbd>R</kbd></button>}
            </div>
            <p className="pocketorbit-footnote">A deterministic daily course runs entirely in your browser. Local records do not sync.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
