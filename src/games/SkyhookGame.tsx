import { useEffect, useReducer, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  createSkyhookState,
  formatFlightTime,
  SKYHOOK_DOCK_RADIUS,
  SKYHOOK_GRAPPLE_RANGE,
  skyhookReducer,
  type SkyhookControl,
} from './skyhook'

interface SkyhookGameProps {
  onBack: () => void
  bestScore: number | null
  reduceMotion: boolean
  onRecordScore: (score: number) => void
}

const STARS = Array.from({ length: 48 }, (_, index) => ({ x: (index * 167 + 47) % 960, y: (index * 113 + 29) % 600, size: index % 7 === 0 ? 2 : 1 }))
const KEY_CONTROLS: Record<string, SkyhookControl> = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
  ArrowUp: 'reel', w: 'reel', ArrowDown: 'brake', s: 'brake',
}
const HELD_CONTROLS: Array<{ control: SkyhookControl; label: string; symbol: string; short: string }> = [
  { control: 'left', label: 'Swing left', symbol: '←', short: 'LEFT' },
  { control: 'reel', label: 'Reel in or thrust', symbol: '▲', short: 'REEL / THRUST' },
  { control: 'brake', label: 'Pay out or brake', symbol: '▼', short: 'PAY OUT / BRAKE' },
  { control: 'right', label: 'Swing right', symbol: '→', short: 'RIGHT' },
]

export function SkyhookGame({ onBack, bestScore, reduceMotion, onRecordScore }: SkyhookGameProps) {
  const [state, dispatch] = useReducer(skyhookReducer, undefined, () => createSkyhookState())
  const fieldRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const keyboardTimers = useRef(new Map<SkyhookControl, number>())
  const controlsRef = useRef(state.controls)
  const previous = useRef({ score: state.score, hull: state.hull, phase: state.phase })
  const speed = Math.hypot(state.capsule.vx, state.capsule.vy)
  const elapsed = formatFlightTime(state.elapsedMs)
  const anchor = state.attachedAnchor === null ? null : state.course.anchors[state.attachedAnchor]
  const beacon = state.course.beacons[state.nextBeacon]
  const mission = state.phase === 'won'
    ? `Course complete. All ${state.nextBeacon} beacons reached in ${elapsed}. Final score ${state.score}.`
    : state.phase === 'over'
      ? `Capsule lost after ${state.nextBeacon} beacons. Final score ${state.score}.`
      : `${state.nextBeacon} of ${state.course.beacons.length} beacons collected. ${anchor ? `Tethered at ${anchor.name}` : 'Capsule in flight'}. ${state.hull} hull remaining.`

  useEffect(() => { controlsRef.current = state.controls }, [state.controls])
  useEffect(() => { if (state.score > 0) onRecordScore(state.score) }, [onRecordScore, state.score])
  useEffect(() => {
    const before = previous.current
    if ((state.phase === 'won' || state.phase === 'over') && before.phase !== state.phase) playSound(state.phase === 'won' ? 'win' : 'lose')
    else if (state.hull < before.hull) playSound('miss')
    else if (state.score > before.score) playSound('score')
    previous.current = { score: state.score, hull: state.hull, phase: state.phase }
  }, [playSound, state.hull, state.phase, state.score])
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
    const clear = () => (Object.keys(controlsRef.current) as SkyhookControl[]).forEach((control) => setControl(control, false))
    const hidden = () => { if (document.hidden) { clear(); dispatch({ type: 'pause' }) } }
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', hidden)
      keyboardTimers.current.forEach((timer) => window.clearTimeout(timer))
      keyboardTimers.current.clear()
    }
  }, [])

  function setControl(control: SkyhookControl, pressed: boolean) {
    controlsRef.current = { ...controlsRef.current, [control]: pressed }
    dispatch({ type: 'control', control, pressed })
  }

  const focusField = () => window.requestAnimationFrame(() => fieldRef.current?.focus())
  const start = () => { dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' }); focusField() }
  const pause = () => { (Object.keys(controlsRef.current) as SkyhookControl[]).forEach((control) => setControl(control, false)); dispatch({ type: 'pause' }) }
  const restart = () => { controlsRef.current = { left: false, right: false, reel: false, brake: false }; dispatch({ type: 'restart' }); focusField() }
  const toggleTether = () => dispatch({ type: 'tether' })

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const control = KEY_CONTROLS[key]
    if (control) { event.preventDefault(); if (state.phase === 'playing') setControl(control, true); return }
    if ((event.code === 'Space' || event.key === 'Enter') && event.target instanceof HTMLButtonElement) return
    if (event.code === 'Space') {
      event.preventDefault()
      if (state.phase === 'ready' || state.phase === 'paused') start()
      else if (state.phase === 'playing' && !event.repeat) toggleTether()
    } else if (event.key === 'Escape' && state.phase === 'playing') { event.preventDefault(); pause() }
    else if (event.key === 'Escape' && state.phase === 'paused') { event.preventDefault(); start() }
    else if (key === 'r') { event.preventDefault(); restart() }
  }

  const holdControl = (control: SkyhookControl) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (state.phase !== 'playing') return
    setControl(control, true)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Pointer capture is optional. */ }
  }
  const releaseControl = (control: SkyhookControl) => () => setControl(control, false)
  const keyboardTap = (control: SkyhookControl) => (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0 || state.phase !== 'playing') return
    const old = keyboardTimers.current.get(control)
    if (old !== undefined) window.clearTimeout(old)
    setControl(control, true)
    const timer = window.setTimeout(() => { keyboardTimers.current.delete(control); setControl(control, false) }, 150)
    keyboardTimers.current.set(control, timer)
  }

  return (
    <section className="snake-view skyhook-view" aria-labelledby="skyhook-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout skyhook-layout">
        <div className="snake-copy skyhook-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> ARCADE FLIGHT · UTC COURSE</p>
          <h1 id="skyhook-title">Skyhook<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Catch the tether. Carry your swing. Fly the open sky.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Hold <strong>Left / Right</strong> or <strong>A / D</strong> to pump the swing. <strong>Up / W</strong> reels the cable in while tethered and thrusts in flight; <strong>Down / S</strong> pays it out or brakes your drift.</p>
            <p>Press <strong>Space</strong> to release. Press again inside another anchor's catch ring to latch; when a fresh anchor is already in range, Space transfers the tether and keeps your momentum.</p>
            <p>Collect the three beacons in order, then pass through the gold dock ring. Shards and the field edge damage the capsule. On a phone, hold the flight buttons and tap <strong>Grapple / release</strong>.</p>
          </div>
          <div className="score-card skyhook-score" aria-label={`Score ${state.score}. ${state.hull} hull. ${state.nextBeacon} of three beacons. Flight time ${elapsed}. ${bestScore === null ? 'No local best yet.' : `Local best ${bestScore} points.`}`}>
            <div className="breakout-score-main"><span className="score-caption">THIS FLIGHT</span><strong className="score-value">{String(state.score).padStart(4, '0')}</strong><span className="score-unit">points</span></div>
            <div className="breakout-stats"><span><strong>{state.hull}</strong> hull</span><span><strong>{state.nextBeacon}</strong> / 3 beacons</span><span><strong>{elapsed}</strong> elapsed</span></div>
            <div className="local-best-readout"><span className="score-caption">BEST FLIGHT · THIS BROWSER</span><strong className="score-value">{bestScore === null ? '—' : String(bestScore).padStart(4, '0')}</strong><span className="score-unit">points</span></div>
          </div>
          <div className="skyhook-route-card" aria-live="polite"><span className="score-caption">{beacon ? `NEXT BEACON · ${beacon.name.toUpperCase()}` : 'ROUTE STATUS'}</span><strong>{beacon ? `${state.nextBeacon + 1} of ${state.course.beacons.length}` : state.phase === 'won' ? 'Dock secured' : 'All beacons aboard'}</strong><span>{anchor ? `Tethered at ${anchor.name}` : `Last anchor · ${state.course.anchors[state.lastAnchor]!.name}`}</span></div>
          <p className="skyhook-local-note">Your best flight is saved in this browser and does not sync.</p>
          <div className="game-actions">
            {state.phase === 'playing' ? <button className="button button-secondary" type="button" onClick={pause}>Pause flight <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
              : state.phase === 'paused' ? <button className="button button-primary" type="button" onClick={start}>Resume flight <span aria-hidden="true">→</span></button>
                : state.phase === 'ready' ? <button className="button button-primary" type="button" onClick={start}>Start flight <span aria-hidden="true">→</span></button>
                  : <button className="button button-primary" type="button" onClick={restart}>Fly today's course again <span aria-hidden="true">→</span></button>}
            {state.phase !== 'ready' && <button className="button button-quiet" type="button" onClick={restart}>Restart course</button>}
          </div>
          <p className="skyhook-keyboard-hint">Hold arrows / A-D · Up / W reel or thrust · Down / S pay out or brake · Space grapple</p>
        </div>
        <div className="play-column skyhook-play-column" onKeyDown={handleKeyDown}>
          <div className={`skyhook-console${reduceMotion ? ' is-reduced-motion' : ''}`}>
            <div className="frame-topline"><span>FIELD 33 · SKYHOOK COURSE</span><span className={`frame-light phase-${state.phase}`}><i /> {anchor ? 'TETHERED' : state.phase === 'playing' ? 'IN FLIGHT' : state.phase.toUpperCase()}</span></div>
            <div ref={fieldRef} className={`skyhook-field phase-${state.phase}`} tabIndex={0} role="group" aria-label={`Skyhook playfield. ${mission}`}>
              <svg className="skyhook-map" viewBox="0 0 960 600" role="img" aria-label={`Daily swing course with ${state.course.anchors.length} anchors, three beacons, a dock, and space shards. ${mission}`}>
                <defs>
                  <radialGradient id="skyhook-space" cx="50%" cy="46%" r="78%"><stop offset="0" stopColor="#202338" /><stop offset="1" stopColor="#0b101a" /></radialGradient>
                  <filter id="skyhook-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <rect width="960" height="600" fill="url(#skyhook-space)" />
                {STARS.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.size} className={index % 6 === 0 ? 'skyhook-star is-bright' : 'skyhook-star'} />)}
                {state.course.hazards.map((hazard) => (
                  <g key={hazard.id} className="skyhook-hazard" transform={`translate(${hazard.x} ${hazard.y})`}>
                    <circle r={hazard.radius + 10} className="skyhook-hazard-glow" />
                    <path d={`M0 -${hazard.radius} L${hazard.radius * .72} -${hazard.radius * .55} L${hazard.radius} ${hazard.radius * .2} L${hazard.radius * .35} ${hazard.radius} L-${hazard.radius * .62} ${hazard.radius * .7} L-${hazard.radius} -${hazard.radius * .1} Z`} className="skyhook-hazard-rock" />
                    <circle cx="-5" cy="-3" r="2.5" className="skyhook-hazard-crater" />
                  </g>
                ))}
                {state.course.anchors.map((point, index) => (
                  <g key={point.name} className={`skyhook-anchor${index === state.attachedAnchor ? ' is-attached' : ''}`}>
                    <circle cx={point.x} cy={point.y} r={SKYHOOK_GRAPPLE_RANGE} className="skyhook-catch-range" />
                    <circle cx={point.x} cy={point.y} r="23" className="skyhook-anchor-ring" />
                    <circle cx={point.x} cy={point.y} r="6" className="skyhook-anchor-core" />
                    <path d={`M${point.x - 12} ${point.y}h24M${point.x} ${point.y - 12}v24`} className="skyhook-anchor-cross" />
                    <text x={point.x} y={point.y - 32} className="skyhook-anchor-label" textAnchor="middle">{point.name.toUpperCase()}</text>
                  </g>
                ))}
                {state.course.beacons.map((point, index) => (
                  <g key={point.name} className={`skyhook-beacon${index < state.nextBeacon ? ' is-collected' : ''}${index === state.nextBeacon ? ' is-next' : ''}`}>
                    <circle cx={point.x} cy={point.y} r="18" className="skyhook-beacon-orbit" />
                    <path d={`M${point.x} ${point.y - 9} L${point.x + 9} ${point.y} L${point.x} ${point.y + 9} L${point.x - 9} ${point.y} Z`} className="skyhook-beacon-glyph" />
                  </g>
                ))}
                <g className={`skyhook-dock${state.nextBeacon === state.course.beacons.length ? ' is-live' : ''}`} transform={`translate(${state.course.dock.x} ${state.course.dock.y})`}>
                  <circle r={SKYHOOK_DOCK_RADIUS} className="skyhook-dock-outer" /><circle r="21" className="skyhook-dock-core" /><path d="M-8 0h16M0-8v16" className="skyhook-dock-mark" />
                </g>
                {anchor && <path d={`M${anchor.x} ${anchor.y} L${state.capsule.x} ${state.capsule.y}`} className="skyhook-tether-line" />}
                <g className={`skyhook-capsule${state.invulnerableMs > 0 && Math.floor(state.invulnerableMs / 100) % 2 === 0 ? ' is-blinking' : ''}`} transform={`translate(${state.capsule.x} ${state.capsule.y}) rotate(${state.capsule.angle * 180 / Math.PI + 90})`}>
                  {state.attachedAnchor === null && state.controls.reel && <path d="M-5 12L0 25L5 12Z" className="skyhook-engine-flame" />}
                  <path d="M0 -17 L11 11 L0 6 L-11 11 Z" className="skyhook-capsule-hull" filter="url(#skyhook-glow)" />
                  <path d="M0 -9 L4 4 L0 2 L-4 4 Z" className="skyhook-capsule-window" /><circle cy="12" r="3" className="skyhook-capsule-hook" />
                </g>
                <path d="M8 8h36M8 8v26M952 8h-36M952 8v26M8 592h36M8 592v-26M952 592h-36M952 592v-26" className="skyhook-field-corners" />
              </svg>
              {(state.phase === 'ready' || state.phase === 'paused' || state.phase === 'won' || state.phase === 'over') && (
                <div className="skyhook-overlay" aria-live="polite">
                  <strong>{state.phase === 'ready' ? 'TETHER READY' : state.phase === 'paused' ? 'FLIGHT PAUSED' : state.phase === 'won' ? 'DOCK SECURED' : 'CAPSULE LOST'}</strong>
                  <span>{state.phase === 'ready' ? 'Swing wide, gather three beacons, then find the gold dock.' : state.phase === 'paused' ? 'The capsule is held in place.' : state.phase === 'won' ? `${state.score} points · ${state.hull} hull · ${elapsed}` : `${state.nextBeacon} of 3 beacons · ${state.score} points`}</span>
                  {state.phase === 'ready' && <button className="button button-primary" type="button" onClick={start}>Start flight</button>}
                  {state.phase === 'paused' && <button className="button button-primary" type="button" onClick={start}>Resume flight</button>}
                  {(state.phase === 'won' || state.phase === 'over') && <button className="button button-primary" type="button" onClick={restart}>Fly today's course again</button>}
                </div>
              )}
            </div>
            <div className="skyhook-console-footer"><span>{anchor ? `TETHER · ${anchor.name.toUpperCase()}` : `CATCH RING · ${SKYHOOK_GRAPPLE_RANGE}`}</span><span>{Math.round(speed)} SPEED · {state.hull} HULL · {elapsed}</span></div>
          </div>
          <div className="skyhook-touch-controls" role="group" aria-label="Skyhook flight controls">
            {HELD_CONTROLS.map(({ control, label, symbol, short }) => (
              <button key={control} className={`skyhook-control-button skyhook-control-${control}`} type="button" aria-label={label} disabled={state.phase !== 'playing'} onPointerDown={holdControl(control)} onPointerUp={releaseControl(control)} onPointerCancel={releaseControl(control)} onLostPointerCapture={releaseControl(control)} onClick={keyboardTap(control)}>
                <span aria-hidden="true">{symbol}</span><small>{short}</small>
              </button>
            ))}
          </div>
          <button className="skyhook-tether-button" type="button" aria-label={anchor ? 'Transfer tether or release' : 'Catch a nearby anchor'} disabled={state.phase !== 'playing'} onClick={toggleTether}>
            <span aria-hidden="true">{anchor ? '↗' : '⌁'}</span>{anchor ? 'TRANSFER / RELEASE TETHER' : 'GRAPPLE NEARBY ANCHOR'}<kbd>SPACE</kbd>
          </button>
          <p className="skyhook-keyboard-hint">Focus the flight field for keys. Holding an input stays smooth; releasing the key or button stops it.</p>
        </div>
      </div>
    </section>
  )
}
