import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  createMoonshotState,
  MOONSHOT_BALL_RADIUS,
  MOONSHOT_HOLE_COUNT,
  MOONSHOT_HOLES,
  MOONSHOT_MAX_POWER,
  MOONSHOT_MIN_POWER,
  MOONSHOT_WIDTH,
  MOONSHOT_HEIGHT,
  moonshotHole,
  moonshotReducer,
} from './moonshot'

interface MoonshotGameProps {
  onBack: () => void
  bestStrokes: number | null
  onRecordStrokes: (strokes: number) => void
  reduceMotion: boolean
}

interface DragShot {
  angle: number
  power: number
  distance: number
}

const COURSE_PAR = MOONSHOT_HOLES.reduce((total, hole) => total + hole.par, 0)

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function degrees(radians: number): number {
  return Math.round((radians * 180) / Math.PI)
}

function dragShot(ball: { x: number; y: number }, pointer: { x: number; y: number }): DragShot {
  const dx = ball.x - pointer.x
  const dy = ball.y - pointer.y
  const distance = Math.hypot(dx, dy)
  return {
    angle: Math.atan2(dy, dx),
    power: clamp(MOONSHOT_MIN_POWER + distance * 2.15, MOONSHOT_MIN_POWER, MOONSHOT_MAX_POWER),
    distance,
  }
}

export function MoonshotGame({ onBack, bestStrokes, onRecordStrokes, reduceMotion }: MoonshotGameProps) {
  const [state, dispatch] = useReducer(moonshotReducer, undefined, createMoonshotState)
  const [drag, setDrag] = useState<DragShot | null>(null)
  const fieldRef = useRef<SVGSVGElement>(null)
  const dragStart = useRef<{ pointerId: number } | null>(null)
  const recordedFinish = useRef(false)
  const recordAtStart = useRef(bestStrokes)
  const previousSounds = useRef({ completed: state.completedHoles.length, phase: state.phase, strokes: state.strokes })
  const playSound = useArcadeSound()
  const hole = moonshotHole(state)
  const nextPower = drag?.power ?? state.power
  const aimLength = 42 + (nextPower / MOONSHOT_MAX_POWER) * 115
  const isNewRecord = state.phase === 'won' && (recordAtStart.current === null || state.strokes < recordAtStart.current)
  const cupDescription = state.phase === 'won'
    ? `Five holes complete in ${state.strokes} strokes. Par is ${COURSE_PAR}.`
    : `Hole ${state.holeIndex + 1} of ${MOONSHOT_HOLE_COUNT}, ${hole.name}, par ${hole.par}. ${state.holeStrokes} strokes on this hole. ${state.ballMoving ? 'Ball rolling.' : 'Ball is ready.'}`

  useEffect(() => {
    if (state.phase === 'won' && !recordedFinish.current) {
      recordedFinish.current = true
      onRecordStrokes(state.strokes)
    }
    if (state.phase === 'ready') recordedFinish.current = false
  }, [onRecordStrokes, state.phase, state.strokes])

  useEffect(() => {
    const previous = previousSounds.current
    if (state.phase === 'won' && previous.phase !== 'won') playSound('win')
    else if (state.completedHoles.length > previous.completed) playSound('score')
    else if (state.strokes > previous.strokes) playSound('fire')
    previousSounds.current = { completed: state.completedHoles.length, phase: state.phase, strokes: state.strokes }
  }, [playSound, state.completedHoles.length, state.phase, state.strokes])

  useEffect(() => {
    if (state.phase !== 'playing' || !state.ballMoving) return
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
  }, [state.ballMoving, state.phase])

  const focusField = () => window.requestAnimationFrame(() => fieldRef.current?.focus())
  const start = () => {
    if (state.phase === 'ready') recordAtStart.current = bestStrokes
    dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusField()
  }
  const restart = () => {
    recordAtStart.current = bestStrokes
    setDrag(null)
    dragStart.current = null
    dispatch({ type: 'restart' })
    focusField()
  }
  const pause = () => {
    setDrag(null)
    dragStart.current = null
    dispatch({ type: 'pause' })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    if (event.target instanceof HTMLInputElement && event.target.type === 'range' && key.startsWith('Arrow')) return
    if ((event.code === 'Space' || event.key === 'Enter') && event.target instanceof HTMLButtonElement) return
    if (key === 'ArrowLeft' || key === 'a') {
      event.preventDefault()
      dispatch({ type: 'aim', angleDelta: -0.09 })
    } else if (key === 'ArrowRight' || key === 'd') {
      event.preventDefault()
      dispatch({ type: 'aim', angleDelta: 0.09 })
    } else if (key === 'ArrowUp' || key === 'w') {
      event.preventDefault()
      dispatch({ type: 'aim', powerDelta: 14 })
    } else if (key === 'ArrowDown' || key === 's') {
      event.preventDefault()
      dispatch({ type: 'aim', powerDelta: -14 })
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (state.phase === 'playing') pause()
      else if (state.phase === 'paused') start()
    } else if ((event.code === 'Space' || event.key === 'Enter') && state.phase === 'ready') {
      event.preventDefault()
      start()
    } else if ((event.code === 'Space' || event.key === 'Enter') && state.phase === 'playing' && !state.ballMoving) {
      event.preventDefault()
      dispatch({ type: 'shot' })
    } else if (key === 'r') {
      event.preventDefault()
      restart()
    }
  }

  const pointerPosition = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * MOONSHOT_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * MOONSHOT_HEIGHT,
    }
  }
  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (state.phase !== 'playing' || state.ballMoving) return
    const point = pointerPosition(event)
    if (Math.hypot(point.x - state.ball.x, point.y - state.ball.y) > 76) return
    event.preventDefault()
    dragStart.current = { pointerId: event.pointerId }
    setDrag(dragShot(state.ball, point))
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Pointer capture is optional. */ }
  }
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (dragStart.current?.pointerId !== event.pointerId) return
    setDrag(dragShot(state.ball, pointerPosition(event)))
  }
  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (dragStart.current?.pointerId !== event.pointerId) return
    const shot = dragShot(state.ball, pointerPosition(event))
    dragStart.current = null
    setDrag(null)
    if (shot.distance >= 12) dispatch({ type: 'shot', angle: shot.angle, power: shot.power })
  }
  const cancelDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (dragStart.current?.pointerId === event.pointerId) {
      dragStart.current = null
      setDrag(null)
    }
  }

  return (
    <section className="snake-view moonshot-view" data-reduce-motion={reduceMotion} aria-labelledby="moonshot-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout moonshot-layout">
        <div className="snake-copy moonshot-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> ARCADE SPORT · LUNAR TOUR</p>
          <h1 id="moonshot-title">Moonshot<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Five little greens. A pocket of gravity. Find the soft line to the cup.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Finish all five original holes in as few strokes as you can. Each surface has a different route; walls rebound the ball and craters slow it down. Let the ball settle before lining up again.</p>
            <p>On the course, pull back from the ball and release to aim and choose power. You can also use <strong>Left / Right</strong> or <strong>A / D</strong> to aim, <strong>Up / Down</strong> or <strong>W / S</strong> to set power, then press <strong>Space</strong> or <strong>Enter</strong> to shoot.</p>
            <p>Touch players can drag from the ball or use the aim buttons and power slider. Escape pauses; R starts a fresh tour.</p>
          </div>
          <div className="score-card moonshot-score" aria-label={`Total strokes ${state.strokes}, par ${COURSE_PAR}. Hole ${state.holeIndex + 1} of ${MOONSHOT_HOLE_COUNT}, par ${hole.par}, ${state.holeStrokes} strokes. ${bestStrokes === null ? 'No local best yet.' : `Best local round ${bestStrokes} strokes.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">TOUR STROKES</span>
              <strong className="score-value moonshot-total">{String(state.strokes).padStart(2, '0')} <i>/ {COURSE_PAR}</i></strong>
              <span className="score-unit">five-hole par</span>
            </div>
            <div className="moonshot-stats">
              <span><small>CURRENT HOLE</small><strong>{String(state.holeIndex + 1).padStart(2, '0')} / {MOONSHOT_HOLE_COUNT}</strong></span>
              <span><small>HOLE PAR</small><strong>{hole.par}</strong></span>
              <span><small>HOLE STROKES</small><strong>{state.holeStrokes}</strong></span>
              <span><small>COURSE</small><strong>{hole.name}</strong></span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST TOUR · THIS BROWSER</span>
              <strong className="score-value moonshot-record">{bestStrokes === null ? '—' : String(bestStrokes).padStart(2, '0')}</strong>
              <span className="score-unit">{bestStrokes === null ? 'local record' : 'strokes'}</span>
            </div>
          </div>
          <div className="moonshot-hole-strip" aria-label={`${state.completedHoles.length} of ${MOONSHOT_HOLE_COUNT} holes complete`}>
            {MOONSHOT_HOLES.map((course, index) => (
              <div className={`moonshot-hole-chip ${index < state.completedHoles.length ? 'is-complete' : index === state.holeIndex ? 'is-current' : ''}`} key={course.name}>
                <span>HOLE {index + 1}</span><strong>{state.completedHoles[index] === undefined ? `PAR ${course.par}` : `${state.completedHoles[index]} STROKES`}</strong>
              </div>
            ))}
          </div>
          <p className="moonshot-local-note">Your fewest strokes stays saved in this browser and does not sync.</p>
          <div className="game-actions">
            {state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Start the tour <span aria-hidden="true">→</span></button>
            ) : state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={pause}>Pause round <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume round <span aria-hidden="true">→</span></button>
            ) : state.phase === 'holeComplete' ? (
              <button className="button button-primary" type="button" onClick={() => dispatch({ type: 'next-hole' })}>Next hole <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Play another tour <span aria-hidden="true">→</span></button>
            )}
            {state.phase !== 'ready' && state.phase !== 'won' && <button className="button button-quiet" type="button" onClick={restart}>Restart tour</button>}
          </div>
          <p className="keyboard-hint">Aim ← / → · Power ↑ / ↓ · Space shoots · Escape pauses</p>
        </div>

        <div className="play-column moonshot-play-column" onKeyDown={handleKeyDown}>
          <div className="moonshot-console">
            <div className="frame-topline"><span>GREEN {String(state.holeIndex + 1).padStart(2, '0')} · {hole.name.toUpperCase()}</span><span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? state.ballMoving ? 'ROLLING' : 'YOUR SHOT' : state.phase === 'holeComplete' ? 'BANKED' : state.phase.toUpperCase()}</span></div>
            <div className="moonshot-field-shell">
              <svg ref={fieldRef} className={`moonshot-field phase-${state.phase}`} viewBox={`0 0 ${MOONSHOT_WIDTH} ${MOONSHOT_HEIGHT}`} role="group" aria-label={`Moonshot playfield. ${cupDescription}`} tabIndex={0} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
                <defs>
                  <pattern id="moonshot-grain" width="31" height="31" patternUnits="userSpaceOnUse"><circle cx="6" cy="8" r="1" fill="#7b708c" opacity=".24" /><circle cx="24" cy="21" r="1.2" fill="#b1a1bc" opacity=".17" /></pattern>
                  <radialGradient id="moonshot-green" cx="50%" cy="45%" r="80%"><stop offset="0" stopColor="#28253a" /><stop offset="1" stopColor="#14131e" /></radialGradient>
                  <radialGradient id="moonshot-ball" cx="35%" cy="28%" r="75%"><stop offset="0" stopColor="#fffce7" /><stop offset=".45" stopColor="#e8d9bc" /><stop offset="1" stopColor="#9c8c9d" /></radialGradient>
                  <filter id="moonshot-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <rect width={MOONSHOT_WIDTH} height={MOONSHOT_HEIGHT} fill="url(#moonshot-green)" />
                <rect width={MOONSHOT_WIDTH} height={MOONSHOT_HEIGHT} fill="url(#moonshot-grain)" />
                <rect x="42" y="42" width="556" height="696" rx="20" fill="none" stroke="#a498b6" strokeWidth="3" />
                <path d="M 58 88 H 582 M 58 692 H 582" stroke="#524960" strokeWidth="2" strokeDasharray="5 10" />
                <ellipse cx={hole.cup.x} cy={hole.cup.y} rx="33" ry="25" fill="#211d30" stroke="#7f718d" strokeWidth="2" />
                {hole.craters.map((crater, index) => <g className="moonshot-crater" key={`crater-${index}`}>
                  <circle cx={crater.x} cy={crater.y} r={crater.radius} />
                  <circle cx={crater.x} cy={crater.y} r={crater.radius * .63} />
                  <circle cx={crater.x} cy={crater.y} r="3" />
                </g>)}
                {hole.walls.map((wall, index) => <g key={`wall-${index}`} className="moonshot-wall">
                  <rect x={wall.x} y={wall.y} width={wall.width} height={wall.height} rx="8" />
                  <path d={`M ${wall.x + 8} ${wall.y + 5} H ${wall.x + wall.width - 8}`} />
                </g>)}
                {hole.bumpers.map((bumper, index) => <g key={`bumper-${index}`} className="moonshot-bumper">
                  <circle cx={bumper.x} cy={bumper.y} r={bumper.radius + 5} />
                  <circle cx={bumper.x} cy={bumper.y} r={bumper.radius} />
                  <circle cx={bumper.x} cy={bumper.y} r="4" />
                </g>)}
                <g className="moonshot-cup" filter="url(#moonshot-glow)">
                  <circle cx={hole.cup.x} cy={hole.cup.y} r="18" />
                  <circle cx={hole.cup.x} cy={hole.cup.y} r="7" />
                </g>
                <g className="moonshot-flag" transform={`translate(${hole.cup.x + 25} ${hole.cup.y - 14})`}>
                  <path d="M 0 0 V 39" /><path d="M 1 1 H 25 L 18 9 L 25 17 H 1 Z" />
                </g>
                <g className="moonshot-tee" transform={`translate(${hole.tee.x} ${hole.tee.y})`}>
                  <circle r="21" /><circle r="9" /><path d="M -27 0 H 27 M 0 -27 V 27" />
                </g>
                {!state.ballMoving && state.phase === 'playing' && <g className="moonshot-aim" transform={`translate(${state.ball.x} ${state.ball.y}) rotate(${degrees(drag?.angle ?? state.aimAngle)})`}>
                  <line x1="14" y1="0" x2={aimLength} y2="0" />
                  <path d={`M ${aimLength - 9} -6 L ${aimLength} 0 L ${aimLength - 9} 6`} />
                  <text x={aimLength / 2} y="-9" textAnchor="middle">{Math.round((drag?.power ?? state.power) / MOONSHOT_MAX_POWER * 100)}%</text>
                </g>}
                {drag && <circle className="moonshot-drag-origin" cx={state.ball.x} cy={state.ball.y} r={MOONSHOT_BALL_RADIUS + 5} />}
                <g className="moonshot-ball" transform={`translate(${state.ball.x} ${state.ball.y})`}>
                  <circle r={MOONSHOT_BALL_RADIUS + 6} className={state.ballMoving ? 'moonshot-ball-halo is-moving' : 'moonshot-ball-halo'} />
                  <circle r={MOONSHOT_BALL_RADIUS} fill="url(#moonshot-ball)" />
                  <path d="M -4 -2 Q 0 -8 5 -4" />
                </g>
              </svg>
              {state.phase !== 'playing' && <div className={`moonshot-overlay phase-${state.phase}`}>
                <span className="moonshot-overlay-kicker">{state.phase === 'won' ? 'TOUR COMPLETE' : state.phase === 'holeComplete' ? `HOLE ${state.holeIndex + 1} BANKED` : state.phase === 'paused' ? 'PIT STOP' : 'LUNAR TOUR · FIVE HOLES'}</span>
                <strong>{state.phase === 'won' ? `${state.strokes} STROKES · PAR ${COURSE_PAR}` : state.phase === 'holeComplete' ? `${state.holeStrokes} ${state.holeStrokes === 1 ? 'STROKE' : 'STROKES'}` : state.phase === 'paused' ? 'Round paused' : 'Read the green.'}</strong>
                <span>{state.phase === 'won' ? isNewRecord ? 'A new browser record.' : 'Take another tour and trim a stroke.' : state.phase === 'holeComplete' ? hole.name : state.phase === 'paused' ? 'Resume when you are ready.' : 'Bank, rebound, and leave the craters behind.'}</span>
              </div>}
            </div>
            <div className="moonshot-console-footer"><span>DRAG TO AIM · BANK THE WALLS</span><span>PAR {hole.par} · {state.holeStrokes} STROKES</span></div>
          </div>
          <p className="moonshot-status" role="status" aria-live="polite">{state.message}</p>
          <div className="moonshot-controls" role="group" aria-label="Moonshot shot controls">
            <div className="moonshot-aim-pad">
              <button type="button" aria-label="Aim left" disabled={state.phase !== 'playing' || state.ballMoving} onClick={() => dispatch({ type: 'aim', angleDelta: -0.12 })}>←<small>AIM</small></button>
              <button type="button" aria-label="Aim right" disabled={state.phase !== 'playing' || state.ballMoving} onClick={() => dispatch({ type: 'aim', angleDelta: 0.12 })}>→<small>AIM</small></button>
            </div>
            <label className="moonshot-power-control">
              <span><strong>SHOT POWER</strong><b>{Math.round(state.power / MOONSHOT_MAX_POWER * 100)}%</b></span>
              <input aria-label="Shot power" type="range" min={MOONSHOT_MIN_POWER} max={MOONSHOT_MAX_POWER} step="10" value={state.power} disabled={state.phase !== 'playing' || state.ballMoving} onChange={(event) => dispatch({ type: 'set-aim', angle: state.aimAngle, power: event.currentTarget.valueAsNumber })} />
            </label>
            <button type="button" className="moonshot-shoot" disabled={state.phase !== 'playing' || state.ballMoving} onClick={() => dispatch({ type: 'shot' })}>Take shot <span aria-hidden="true">↗</span></button>
              <button type="button" className="moonshot-reset" disabled={state.phase !== 'playing' || state.holeStrokes === 0} onClick={() => dispatch({ type: 'reset-hole' })}>Return to tee <small>+1 stroke</small></button>
          </div>
          <p className="moonshot-control-note">Drag back from the ball for a direct shot, or set angle and power then take your shot.</p>
        </div>
      </div>
    </section>
  )
}
