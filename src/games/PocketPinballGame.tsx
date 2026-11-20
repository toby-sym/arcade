import { useEffect, useReducer, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  createPocketPinballState,
  PINBALL_BALL_RADIUS,
  PINBALL_BUMPERS,
  PINBALL_FLIPPER_LENGTH,
  PINBALL_HEIGHT,
  PINBALL_ROLLOVER,
  PINBALL_SLINGS,
  PINBALL_TARGETS,
  PINBALL_WIDTH,
  pocketPinballReducer,
  pocketPinballTime,
  type PinballControl,
} from './pocketPinball'

interface PocketPinballGameProps {
  onBack: () => void
  bestScore: number | null
  reduceMotion: boolean
  onRecordScore: (score: number) => void
}

const KEYS: Record<string, PinballControl> = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
}

export function PocketPinballGame({ onBack, bestScore, reduceMotion, onRecordScore }: PocketPinballGameProps) {
  const [state, dispatch] = useReducer(pocketPinballReducer, undefined, createPocketPinballState)
  const fieldRef = useRef<HTMLDivElement>(null)
  const timers = useRef(new Map<PinballControl, number>())
  const controlsRef = useRef(state.controls)
  const previous = useRef({ score: state.score, balls: state.ballsRemaining, phase: state.phase })
  const playSound = useArcadeSound()
  const litTargets = Number(Boolean(state.targetMask & 1)) + Number(Boolean(state.targetMask & 2)) + Number(Boolean(state.targetMask & 4))
  const status = state.phase === 'over'
    ? `Game over. ${state.score} points, ${state.ballsRemaining} balls left, ${pocketPinballTime(state.elapsedMs)} played.`
    : state.ballInShooter
      ? `Ball ready in the shooter lane. ${state.ballsRemaining} ${state.ballsRemaining === 1 ? 'ball' : 'balls'} remain. ${litTargets} of three targets lit.`
      : `Ball in play. ${state.ballsRemaining} ${state.ballsRemaining === 1 ? 'ball' : 'balls'} remain. ${litTargets} of three targets lit.`
  const leftTip = { x: 170 + Math.cos(state.leftFlipper.angle) * PINBALL_FLIPPER_LENGTH, y: 655 + Math.sin(state.leftFlipper.angle) * PINBALL_FLIPPER_LENGTH }
  const rightTip = { x: 350 + Math.cos(state.rightFlipper.angle) * PINBALL_FLIPPER_LENGTH, y: 655 + Math.sin(state.rightFlipper.angle) * PINBALL_FLIPPER_LENGTH }

  useEffect(() => { controlsRef.current = state.controls }, [state.controls])
  useEffect(() => {
    if (state.phase === 'over' && state.score > 0) onRecordScore(state.score)
  }, [onRecordScore, state.phase, state.score])
  useEffect(() => {
    const before = previous.current
    if (state.phase === 'over' && before.phase !== 'over') playSound('lose')
    else if (state.ballsRemaining < before.balls) playSound('miss')
    else if (state.score > before.score) playSound('score')
    previous.current = { score: state.score, balls: state.ballsRemaining, phase: state.phase }
  }, [playSound, state.ballsRemaining, state.phase, state.score])
  useEffect(() => {
    if (state.phase !== 'playing') return
    let frame = 0
    let previousTime = window.performance.now()
    const update = (time: number) => {
      dispatch({ type: 'tick', deltaMs: Math.min(Math.max(time - previousTime, 0), 50) })
      previousTime = time
      frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [state.phase])
  useEffect(() => {
    const clearControls = () => (Object.keys(controlsRef.current) as PinballControl[]).forEach((control) => setControl(control, false))
    const keyUp = (event: globalThis.KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      const control = KEYS[key]
      if (control) setControl(control, false)
    }
    const hidden = () => { if (document.hidden) { clearControls(); dispatch({ type: 'pause' }) } }
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', clearControls)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', clearControls)
      document.removeEventListener('visibilitychange', hidden)
      timers.current.forEach((timer) => window.clearTimeout(timer))
      timers.current.clear()
    }
  }, [])

  function setControl(control: PinballControl, pressed: boolean) {
    controlsRef.current = { ...controlsRef.current, [control]: pressed }
    dispatch({ type: 'control', control, pressed })
  }

  const focusField = () => window.requestAnimationFrame(() => fieldRef.current?.focus())
  const start = () => { dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' }); focusField() }
  const pause = () => { (Object.keys(controlsRef.current) as PinballControl[]).forEach((control) => setControl(control, false)); dispatch({ type: 'pause' }) }
  const restart = () => { controlsRef.current = { left: false, right: false }; dispatch({ type: 'restart' }); focusField() }
  const launch = () => {
    if (state.phase === 'ready') dispatch({ type: 'start' })
    else dispatch({ type: 'launch' })
    focusField()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const control = KEYS[key]
    if (control) { event.preventDefault(); if (state.phase === 'playing') setControl(control, true); return }
    if ((event.code === 'Space' || event.key === 'Enter') && event.target instanceof HTMLButtonElement) return
    if (event.code === 'Space' || event.key === 'Enter') {
      event.preventDefault()
      if (state.phase === 'ready') start()
      else if (state.phase === 'playing' && state.ballInShooter) dispatch({ type: 'launch' })
    } else if ((event.key === 'Shift' || key === 'n') && state.phase === 'playing' && !event.repeat) {
      event.preventDefault(); dispatch({ type: 'nudge' })
    } else if (event.key === 'Escape' && state.phase === 'playing') { event.preventDefault(); pause() }
    else if (event.key === 'Escape' && state.phase === 'paused') { event.preventDefault(); start() }
    else if (key === 'r') { event.preventDefault(); restart() }
  }

  const holdFlipper = (control: PinballControl) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (state.phase !== 'playing') return
    setControl(control, true)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Pointer capture is optional. */ }
  }
  const releaseFlipper = (control: PinballControl) => () => setControl(control, false)
  const keyboardTap = (control: PinballControl) => (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0 || state.phase !== 'playing') return
    const old = timers.current.get(control)
    if (old !== undefined) window.clearTimeout(old)
    setControl(control, true)
    const timer = window.setTimeout(() => { timers.current.delete(control); setControl(control, false) }, 180)
    timers.current.set(control, timer)
  }

  return (
    <section className="snake-view pinball-view" aria-labelledby="pinball-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout pinball-layout">
        <div className="snake-copy pinball-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> POCKET TABLE · ARCADE MODE</p>
          <h1 id="pinball-title">Pocket Pinball<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Keep the silver ball in play. Make every bumper count.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Press <strong>Start game</strong>, then press <strong>Space</strong> or <strong>Launch ball</strong> to fire. Hold <strong>Left / A</strong> and <strong>Right / D</strong> to work the matching flippers. The paddle response follows the full time you hold it.</p>
            <p>Pop bumpers score 75–150 points. Light the three upper targets for a 750 point sweep; lower slingshots send the ball back up the table.</p>
            <p>Press <strong>Shift / N</strong> or <strong>Nudge table</strong> to kick the ball away from danger. A nudge costs 100 points and has a short cooldown. Three balls per game; the drain costs one.</p>
          </div>
          <div className="score-card pinball-score" aria-label={`Score ${state.score}. ${state.ballsRemaining} balls remaining. ${litTargets} of three targets lit. ${state.phase === 'over' ? 'Game over.' : `${pocketPinballTime(state.elapsedMs)} played.`}`}>
            <div className="breakout-score-main"><span className="score-caption">TABLE SCORE</span><strong className="score-value">{String(state.score).padStart(5, '0')}</strong><span className="score-unit">points</span></div>
            <div className="pinball-stats"><span><strong>{state.ballsRemaining}</strong> balls left</span><span><strong>{litTargets}</strong> / 3 targets</span><span><strong>{pocketPinballTime(state.elapsedMs)}</strong> played</span></div>
            <div className="local-best-readout"><span className="score-caption">BEST TABLE · THIS BROWSER</span><strong className="score-value">{bestScore === null ? '—' : String(bestScore).padStart(5, '0')}</strong><span className="score-unit">points</span></div>
          </div>
          <p className="pinball-local-note">Your best table score stays in this browser and does not sync.</p>
          <div className="game-actions">
            {state.phase === 'playing' ? <button className="button button-secondary" type="button" onClick={pause}>Pause table <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
              : state.phase === 'paused' ? <button className="button button-primary" type="button" onClick={start}>Resume table <span aria-hidden="true">→</span></button>
                : state.phase === 'ready' ? <button className="button button-primary" type="button" onClick={start}>Start game <span aria-hidden="true">→</span></button>
                  : <button className="button button-primary" type="button" onClick={restart}>New game <span aria-hidden="true">→</span></button>}
            {state.phase !== 'ready' && <button className="button button-quiet" type="button" onClick={restart}>Restart table</button>}
          </div>
          <p className="pinball-keyboard-hint">Hold ← / A and → / D · Space launch · Shift / N nudge · Escape pause · R restart</p>
        </div>

        <div className="play-column pinball-play-column" onKeyDown={handleKeyDown}>
          <div className={`pinball-console${reduceMotion ? ' is-reduced-motion' : ''}`}>
            <div className="frame-topline"><span>FIELD 34 · POCKET TABLE</span><span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? state.ballInShooter ? 'BALL READY' : 'BALL LIVE' : state.phase.toUpperCase()}</span></div>
            <div ref={fieldRef} className={`pinball-field phase-${state.phase}`} tabIndex={0} role="group" aria-label={`Pocket Pinball playfield. ${status} ${state.message}`}>
              <svg className="pinball-map" viewBox={`0 0 ${PINBALL_WIDTH} ${PINBALL_HEIGHT}`} role="img" aria-label={`Pocket table with five pop bumpers, three light targets, two slingshots, and two flippers. ${state.message}`}>
                <defs>
                  <radialGradient id="pinball-felt" cx="50%" cy="32%" r="78%"><stop offset="0" stopColor="#30384a" /><stop offset="1" stopColor="#101722" /></radialGradient>
                  <linearGradient id="pinball-rail" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#e4c477" /><stop offset=".46" stopColor="#8b704a" /><stop offset="1" stopColor="#3b3041" /></linearGradient>
                  <filter id="pinball-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <rect width={PINBALL_WIDTH} height={PINBALL_HEIGHT} rx="20" className="pinball-board" />
                <path d="M39 39H481V707H365L350 674H170L155 707H39Z" fill="url(#pinball-felt)" stroke="url(#pinball-rail)" strokeWidth="9" className="pinball-table-shape" />
                <path d="M61 48H459V411M416 560V693" fill="none" stroke="#c3a462" strokeWidth="3" className="pinball-lanes" />
                {PINBALL_SLINGS.map((sling, index) => <line key={`sling-rail-${index}`} x1={sling.start.x} y1={sling.start.y} x2={sling.end.x} y2={sling.end.y} className="pinball-sling-rails" />)}
                <path d="M67 500L141 574L128 527Z" className="pinball-sling pinball-sling-left" />
                <path d="M453 500L379 574L392 527Z" className="pinball-sling pinball-sling-right" />
                <path d="M60 424H460" className="pinball-upper-rail" />
                <text x="438" y="470" className="pinball-lane-label" textAnchor="middle">SHOOTER</text>
                <text x="260" y="80" className="pinball-board-label" textAnchor="middle">NORTHSTAR ARCADE</text>
                {PINBALL_TARGETS.map((target, index) => {
                  const lit = (state.targetMask & (1 << index)) !== 0
                  return <g key={`target-${index}`} className={`pinball-target${lit ? ' is-lit' : ''}`}>
                    <circle cx={target.x} cy={target.y} r="17" className="pinball-target-ring" />
                    <path d={`M${target.x} ${target.y - 8}L${target.x + 8} ${target.y}L${target.x} ${target.y + 8}L${target.x - 8} ${target.y}Z`} className="pinball-target-glyph" />
                    <text x={target.x} y={target.y + 32} className="pinball-target-label" textAnchor="middle">{String(index + 1).padStart(2, '0')}</text>
                  </g>
                })}
                {PINBALL_BUMPERS.map((bumper, index) => (
                  <g key={bumper.id} className={`pinball-bumper pinball-bumper-${index}`} transform={`translate(${bumper.x} ${bumper.y})`}>
                    <circle r={bumper.radius + 7} className="pinball-bumper-halo" />
                    <circle r={bumper.radius} className="pinball-bumper-shell" />
                    <circle r={bumper.radius - 8} className="pinball-bumper-core" />
                    <path d={`M-${bumper.radius / 2} 0h${bumper.radius}`} className="pinball-bumper-mark" />
                    <text y="5" className="pinball-bumper-points" textAnchor="middle">{bumper.points}</text>
                  </g>
                ))}
                <circle cx={PINBALL_ROLLOVER.x} cy={PINBALL_ROLLOVER.y} r="8" className={`pinball-rollover${state.rolloverLit ? ' is-lit' : ''}`} />
                <text x="260" y="465" className="pinball-board-note" textAnchor="middle">ROLL-OVER · 250</text>
                <line x1="170" y1="655" x2={leftTip.x} y2={leftTip.y} className={`pinball-flipper pinball-flipper-left${state.controls.left ? ' is-held' : ''}`} />
                <line x1="350" y1="655" x2={rightTip.x} y2={rightTip.y} className={`pinball-flipper pinball-flipper-right${state.controls.right ? ' is-held' : ''}`} />
                <circle cx="170" cy="655" r="9" className="pinball-flipper-pivot" />
                <circle cx="350" cy="655" r="9" className="pinball-flipper-pivot" />
                <path d="M180 718H340" className="pinball-drain-mark" />
                <g className="pinball-ball" transform={`translate(${state.ball.x} ${state.ball.y})`}>
                  <circle r={PINBALL_BALL_RADIUS + 6} className="pinball-ball-glow" />
                  <circle r={PINBALL_BALL_RADIUS} className="pinball-ball-shell" />
                  <circle cx="-3" cy="-3" r="2.8" className="pinball-ball-shine" />
                </g>
              </svg>
              {(state.phase === 'ready' || state.phase === 'paused' || state.phase === 'over') && <div className="pinball-overlay" aria-live="polite">
                <strong>{state.phase === 'ready' ? 'TABLE READY' : state.phase === 'paused' ? 'TABLE PAUSED' : 'GAME OVER'}</strong>
                <span>{state.phase === 'ready' ? 'Launch your first ball and work both flippers.' : state.phase === 'paused' ? 'Your current ball is held in place.' : `${state.score} points · ${pocketPinballTime(state.elapsedMs)} played`}</span>
                {state.phase === 'ready' && <button className="button button-primary" type="button" onClick={start}>Start game</button>}
                {state.phase === 'paused' && <button className="button button-primary" type="button" onClick={start}>Resume table</button>}
                {state.phase === 'over' && <button className="button button-primary" type="button" onClick={restart}>New game</button>}
              </div>}
            </div>
            <div className="pinball-console-footer"><span>{state.ballInShooter && state.phase === 'playing' ? 'SHOOTER · SPACE TO LAUNCH' : 'LEFT / A · RIGHT / D FLIPPERS'}</span><span>{state.score} POINTS · {state.ballsRemaining} BALLS · {pocketPinballTime(state.elapsedMs)}</span></div>
          </div>
          <div className="pinball-touch-controls" role="group" aria-label="Pocket Pinball table controls">
            <button className={`pinball-flipper-button left${state.controls.left ? ' is-held' : ''}`} type="button" aria-label="Hold left flipper" disabled={state.phase !== 'playing'} onPointerDown={holdFlipper('left')} onPointerUp={releaseFlipper('left')} onPointerCancel={releaseFlipper('left')} onLostPointerCapture={releaseFlipper('left')} onClick={keyboardTap('left')}><span aria-hidden="true">◀</span><small>LEFT FLIPPER</small></button>
            <button className={`pinball-flipper-button right${state.controls.right ? ' is-held' : ''}`} type="button" aria-label="Hold right flipper" disabled={state.phase !== 'playing'} onPointerDown={holdFlipper('right')} onPointerUp={releaseFlipper('right')} onPointerCancel={releaseFlipper('right')} onLostPointerCapture={releaseFlipper('right')} onClick={keyboardTap('right')}><span aria-hidden="true">▶</span><small>RIGHT FLIPPER</small></button>
            <button className="pinball-action-button launch" type="button" disabled={state.phase !== 'playing' || !state.ballInShooter} onClick={launch}><span aria-hidden="true">↟</span><small>LAUNCH BALL</small></button>
            <button className="pinball-action-button nudge" type="button" disabled={state.phase !== 'playing' || state.ballInShooter || state.nudgeCooldownMs > 0} onClick={() => dispatch({ type: 'nudge' })}><span aria-hidden="true">⌁</span><small>{state.nudgeCooldownMs > 0 ? `NUDGE · ${Math.ceil(state.nudgeCooldownMs / 100) / 10}s` : 'NUDGE · −100'}</small></button>
          </div>
          <p className="pinball-keyboard-hint">Hold both flippers independently. The controls stay live for as long as each key or button is held.</p>
          <p className="pinball-status" role="status" aria-live="polite">{state.message}</p>
        </div>
      </div>
    </section>
  )
}
