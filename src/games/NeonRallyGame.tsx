import { useEffect, useReducer, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  createNeonRallyState,
  formatNeonRallyTime,
  NEON_RALLY_CHECKPOINTS,
  NEON_RALLY_HEIGHT,
  NEON_RALLY_LAPS,
  NEON_RALLY_TRACK_WIDTH,
  NEON_RALLY_WIDTH,
  neonRallyReducer,
  type NeonRallyControl,
} from './neonRally'

interface NeonRallyGameProps {
  onBack: () => void
  bestTimeMs: number | null
  onRecordTime: (timeMs: number) => void
  reduceMotion: boolean
}

const KEY_CONTROLS: Record<string, NeonRallyControl> = {
  ArrowLeft: 'left', a: 'left',
  ArrowRight: 'right', d: 'right',
  ArrowUp: 'accelerate', w: 'accelerate',
  ArrowDown: 'brake', s: 'brake',
}
const CONTROLS: Array<{ control: NeonRallyControl; label: string; short: string; glyph: string }> = [
  { control: 'left', label: 'Hold left', short: 'TURN LEFT', glyph: '←' },
  { control: 'right', label: 'Hold right', short: 'TURN RIGHT', glyph: '→' },
  { control: 'brake', label: 'Hold brake', short: 'BRAKE', glyph: '−' },
  { control: 'accelerate', label: 'Hold accelerator', short: 'ACCELERATE', glyph: '▲' },
]
const EMPTY_CONTROLS: Record<NeonRallyControl, boolean> = { left: false, right: false, accelerate: false, brake: false }
const ANGLES = Array.from({ length: 12 }, (_, index) => -Math.PI / 2 + (Math.PI * 2 * index) / 12)

function clock(timeMs: number): string {
  return formatNeonRallyTime(timeMs)
}

function gateEnds(index: number) {
  const point = NEON_RALLY_CHECKPOINTS[index]!
  const centerX = NEON_RALLY_WIDTH / 2
  const centerY = NEON_RALLY_HEIGHT / 2
  const directionX = point.x - centerX
  const directionY = point.y - centerY
  const length = Math.hypot(directionX, directionY)
  const halfWidth = NEON_RALLY_TRACK_WIDTH / 2
  const dx = (directionX / length) * halfWidth
  const dy = (directionY / length) * halfWidth
  return { x1: point.x - dx, y1: point.y - dy, x2: point.x + dx, y2: point.y + dy }
}

export function NeonRallyGame({ onBack, bestTimeMs, onRecordTime, reduceMotion }: NeonRallyGameProps) {
  const [state, dispatch] = useReducer(neonRallyReducer, undefined, createNeonRallyState)
  const fieldRef = useRef<HTMLDivElement>(null)
  const input = useRef<Record<NeonRallyControl, boolean>>({ ...EMPTY_CONTROLS })
  const keyboardTapTimers = useRef(new Map<NeonRallyControl, number>())
  const recordedFinish = useRef(false)
  const previousSounds = useRef({ lapTimes: state.lapTimes.length, phase: state.phase, nextCheckpoint: state.nextCheckpoint })
  const playSound = useArcadeSound()
  const speedKph = Math.round(state.vehicle.speed * 0.78)
  const lapTime = clock(state.lapElapsedMs)
  const raceTime = clock(state.elapsedMs)
  const currentGate = state.nextCheckpoint === 0 ? 'FINISH' : `${String(state.nextCheckpoint).padStart(2, '0')} / 11`
  const mission = state.phase === 'won'
    ? `Race complete in ${raceTime}. Best time ${bestTimeMs === null ? raceTime : clock(Math.min(bestTimeMs, state.elapsedMs))}.`
    : `Lap ${state.lap} of ${NEON_RALLY_LAPS}. Next gate ${currentGate}. Speed ${speedKph} kilometres per hour.${state.vehicle.offRoad ? ' Off the racing surface.' : ''}`

  useEffect(() => {
    if (state.phase === 'won' && !recordedFinish.current) {
      recordedFinish.current = true
      onRecordTime(Math.round(state.elapsedMs))
    }
    if (state.phase === 'ready') recordedFinish.current = false
  }, [onRecordTime, state.elapsedMs, state.phase])

  useEffect(() => {
    const previous = previousSounds.current
    if (state.phase === 'won' && previous.phase !== 'won') playSound('win')
    else if (state.lapTimes.length > previous.lapTimes) playSound(state.phase === 'won' ? 'win' : 'score')
    else if (state.nextCheckpoint !== previous.nextCheckpoint) playSound('score')
    previousSounds.current = { lapTimes: state.lapTimes.length, phase: state.phase, nextCheckpoint: state.nextCheckpoint }
  }, [playSound, state.lapTimes.length, state.nextCheckpoint, state.phase])

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
    const keyUp = (event: globalThis.KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      const control = KEY_CONTROLS[key]
      if (control) setControl(control, false)
    }
    const clearControls = () => {
      for (const control of Object.keys(input.current) as NeonRallyControl[]) setControl(control, false)
    }
    const pauseWhenHidden = () => {
      if (document.hidden) {
        clearControls()
        dispatch({ type: 'pause' })
      }
    }
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', clearControls)
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => {
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', clearControls)
      document.removeEventListener('visibilitychange', pauseWhenHidden)
      for (const timer of keyboardTapTimers.current.values()) window.clearTimeout(timer)
      keyboardTapTimers.current.clear()
      clearControls()
    }
  }, [])

  function setControl(control: NeonRallyControl, pressed: boolean) {
    input.current[control] = pressed
    dispatch({ type: 'control', control, pressed })
  }

  const focusField = () => window.requestAnimationFrame(() => fieldRef.current?.focus())
  const clearControls = () => {
    for (const control of Object.keys(input.current) as NeonRallyControl[]) setControl(control, false)
  }
  const start = () => {
    dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusField()
  }
  const pause = () => {
    clearControls()
    dispatch({ type: 'pause' })
  }
  const restart = () => {
    input.current = { ...EMPTY_CONTROLS }
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
    if (event.key === 'Escape') {
      event.preventDefault()
      if (state.phase === 'playing') pause()
      else if (state.phase === 'paused') start()
    } else if (key === 'r') {
      event.preventDefault()
      restart()
    } else if (event.code === 'Space' && state.phase === 'ready') {
      event.preventDefault()
      start()
    }
  }

  const holdControl = (control: NeonRallyControl) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (state.phase !== 'playing') return
    setControl(control, true)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Pointer capture is optional. */ }
  }
  const releaseControl = (control: NeonRallyControl) => () => setControl(control, false)
  const keyboardTapControl = (control: NeonRallyControl) => (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0 || state.phase !== 'playing') return
    const previousTimer = keyboardTapTimers.current.get(control)
    if (previousTimer !== undefined) window.clearTimeout(previousTimer)
    setControl(control, true)
    const timer = window.setTimeout(() => {
      keyboardTapTimers.current.delete(control)
      setControl(control, false)
    }, 160)
    keyboardTapTimers.current.set(control, timer)
  }

  return (
    <section className="snake-view neon-rally-view" data-reduce-motion={reduceMotion} aria-labelledby="neon-rally-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout neon-rally-layout">
        <div className="snake-copy neon-rally-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> ARCADE RACE · NORTH LOOP</p>
          <h1 id="neon-rally-title">Neon Rally<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Find the line. Carry speed through the bends. Bring home a cleaner lap.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Race three laps around the North Loop. Pass each illuminated gate in order; skipping a gate leaves the next one lit. Finish with the fastest time you can.</p>
            <p>Hold <strong>Up / W</strong> to accelerate, <strong>Down / S</strong> to brake, and <strong>Left / Right</strong> or <strong>A / D</strong> to steer. Grass slows the car, so ease off before each bend.</p>
            <p>On touch screens, hold the four driving controls. Escape pauses, and R restarts.</p>
          </div>
          <div className="score-card neon-rally-score" aria-label={`Race time ${raceTime}. Lap ${state.lap} of ${NEON_RALLY_LAPS}. Current lap ${lapTime}. Speed ${speedKph} kilometres per hour. ${bestTimeMs === null ? 'No local best yet.' : `Local best ${clock(bestTimeMs)}.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">RACE TIME</span>
              <strong className="score-value neon-rally-time">{raceTime}</strong>
              <span className="score-unit">{state.phase === 'won' ? 'finish time' : 'three-lap time trial'}</span>
            </div>
            <div className="neon-rally-stats">
              <span><small>CURRENT LAP</small><strong>{lapTime}</strong></span>
              <span><small>LAP</small><strong>{state.lap} / {NEON_RALLY_LAPS}</strong></span>
              <span><small>SPEED</small><strong>{speedKph}<i> km/h</i></strong></span>
              <span><small>NEXT GATE</small><strong>{currentGate}</strong></span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST RACE · THIS BROWSER</span>
              <strong className="score-value neon-rally-time">{bestTimeMs === null ? '—' : clock(bestTimeMs)}</strong>
              <span className="score-unit">{state.phase === 'won' && bestTimeMs === state.elapsedMs ? 'new local best' : 'local record'}</span>
            </div>
          </div>
          <div className="neon-rally-lap-strip" aria-label={`${state.lapTimes.length} completed laps`}>
            {Array.from({ length: NEON_RALLY_LAPS }, (_, index) => (
              <div className={`neon-rally-lap ${index < state.lapTimes.length ? 'is-complete' : index + 1 === state.lap ? 'is-current' : ''}`} key={index}>
                <span>LAP {index + 1}</span><strong>{state.lapTimes[index] === undefined ? index + 1 === state.lap ? lapTime : '—:—.--' : clock(state.lapTimes[index]!)}</strong>
              </div>
            ))}
          </div>
          <p className="neon-rally-local-note">Your best race time stays saved in this browser and does not sync.</p>
          <div className="game-actions">
            {state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Start race <span aria-hidden="true">→</span></button>
            ) : state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={pause}>Pause race <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume race <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Race again <span aria-hidden="true">→</span></button>
            )}
            {state.phase !== 'ready' && <button className="button button-quiet" type="button" onClick={restart}>Restart race</button>}
          </div>
          <p className="keyboard-hint">Hold arrows / WASD · Up accelerates · Down brakes · Escape pauses</p>
        </div>

        <div className="play-column neon-rally-play-column" onKeyDown={handleKeyDown}>
          <div className="neon-rally-console">
            <div className="frame-topline"><span>FIELD 35 · NORTH LOOP</span><span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? 'RACING' : state.phase.toUpperCase()}</span></div>
            <div ref={fieldRef} className={`neon-rally-field phase-${state.phase}`} tabIndex={0} role="group" aria-label={`Neon Rally playfield. ${mission}`}>
              <svg className="neon-rally-map" viewBox={`0 0 ${NEON_RALLY_WIDTH} ${NEON_RALLY_HEIGHT}`} role="img" aria-label={`North Loop oval course with twelve checkpoints. ${mission}`}>
                <defs>
                  <pattern id="rally-grass-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#17352f" strokeWidth="1" /></pattern>
                  <radialGradient id="rally-grass" cx="50%" cy="50%" r="80%"><stop offset="0" stopColor="#19352f" /><stop offset="1" stopColor="#101d23" /></radialGradient>
                  <linearGradient id="rally-road" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#2b2c38" /><stop offset="1" stopColor="#191c27" /></linearGradient>
                  <filter id="rally-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <rect width={NEON_RALLY_WIDTH} height={NEON_RALLY_HEIGHT} fill="url(#rally-grass)" />
                <rect width={NEON_RALLY_WIDTH} height={NEON_RALLY_HEIGHT} fill="url(#rally-grass-grid)" opacity=".76" />
                <ellipse cx="320" cy="390" rx="255" ry="345" fill="none" stroke="#31534a" strokeWidth="2" />
                <ellipse cx="320" cy="390" rx="204" ry="294" fill="none" stroke="#11131d" strokeWidth={NEON_RALLY_TRACK_WIDTH + 12} />
                <ellipse cx="320" cy="390" rx="204" ry="294" fill="none" stroke="url(#rally-road)" strokeWidth={NEON_RALLY_TRACK_WIDTH} />
                <ellipse cx="320" cy="390" rx="204" ry="294" fill="none" stroke="#d6c98f" strokeWidth="2" strokeDasharray="4 16" opacity=".67" />
                <ellipse cx="320" cy="390" rx="152" ry="242" fill="#142520" stroke="#f45d85" strokeWidth="3" opacity=".94" />
                <ellipse cx="320" cy="390" rx="256" ry="346" fill="none" stroke="#3ed9df" strokeWidth="2" opacity=".64" />
                <path d="M 248 350 L 392 350 M 270 390 L 370 390 M 248 430 L 392 430" stroke="#3a554a" strokeWidth="2" opacity=".5" />
                <text x="320" y="378" className="neon-rally-infield-title" textAnchor="middle">NORTH LOOP</text>
                <text x="320" y="406" className="neon-rally-infield-subtitle" textAnchor="middle">3 LAPS · 12 GATES</text>
                {ANGLES.map((_, index) => {
                  const gate = gateEnds(index)
                  const passed = index === 0 ? state.nextCheckpoint !== 0 : state.nextCheckpoint === 0 || index < state.nextCheckpoint
                  const active = index === state.nextCheckpoint
                  return <g key={index} className={active ? 'neon-rally-gate is-active' : passed ? 'neon-rally-gate is-passed' : 'neon-rally-gate'}>
                    <line x1={gate.x1} y1={gate.y1} x2={gate.x2} y2={gate.y2} />
                    {active && <circle cx={NEON_RALLY_CHECKPOINTS[index]!.x} cy={NEON_RALLY_CHECKPOINTS[index]!.y} r="5" />}
                    <text x={NEON_RALLY_CHECKPOINTS[index]!.x} y={NEON_RALLY_CHECKPOINTS[index]!.y - 12} textAnchor="middle">{String(index + 1).padStart(2, '0')}</text>
                  </g>
                })}
                <g className={`neon-rally-car ${state.vehicle.offRoad ? 'is-offroad' : ''}`} transform={`translate(${state.vehicle.x} ${state.vehicle.y}) rotate(${(state.vehicle.heading * 180) / Math.PI})`}>
                  <path d="M -15 -10 L -7 -13 L 12 -10 L 18 -6 L 18 6 L 12 10 L -7 13 L -15 10 Z" className="neon-rally-car-body" />
                  <path d="M -4 -8 L 8 -7 L 12 0 L 8 7 L -4 8 Z" className="neon-rally-car-window" />
                  <path d="M 13 -6 L 19 -4 L 19 4 L 13 6 Z" className="neon-rally-car-nose" />
                  <path d="M -10 -12 L -4 -12 M -10 12 L -4 12" stroke="#11131d" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="-17" cy="-7" r="2" className="neon-rally-taillight" /><circle cx="-17" cy="7" r="2" className="neon-rally-taillight" />
                </g>
              </svg>
              {state.phase !== 'playing' && <div className={`neon-rally-overlay phase-${state.phase}`}>
                <span className="neon-rally-overlay-kicker">{state.phase === 'won' ? 'CHECKERED FLAG' : state.phase === 'paused' ? 'PIT LANE' : 'TAKE YOUR MARK'}</span>
                <strong>{state.phase === 'won' ? `FINISH · ${raceTime}` : state.phase === 'paused' ? 'Race paused' : 'Three laps. One clean line.'}</strong>
                <span>{state.phase === 'won' ? bestTimeMs === state.elapsedMs ? 'New browser record.' : 'Run it back and find more speed.' : state.phase === 'paused' ? 'Resume when you are ready.' : 'Press Start race, then hold the throttle.'}</span>
              </div>}
            </div>
            <div className="neon-rally-console-footer"><span>FOLLOW THE LIT GATES</span><span>TRACK TIME · LOCAL BEST</span></div>
          </div>
          <p className="neon-rally-status" role="status" aria-live="polite">{state.message}</p>
          <div className="neon-rally-touch-controls" role="group" aria-label="Neon Rally driving controls">
            {CONTROLS.map(({ control, label, short, glyph }) => (
              <button key={control} type="button" className={`neon-rally-control ${control} ${state.controls[control] ? 'is-held' : ''}`} aria-label={label} aria-pressed={state.controls[control]} disabled={state.phase !== 'playing'} onPointerDown={holdControl(control)} onPointerUp={releaseControl(control)} onPointerCancel={releaseControl(control)} onLostPointerCapture={releaseControl(control)} onPointerLeave={releaseControl(control)} onClick={keyboardTapControl(control)}>
                <span aria-hidden="true">{glyph}</span><small>{short}</small>
              </button>
            ))}
          </div>
          <p className="neon-rally-control-note">Touch controls are held for continuous steering, braking, and acceleration.</p>
        </div>
      </div>
    </section>
  )
}
