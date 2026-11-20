import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  advanceMagnetron,
  createMagnetronState,
  formatMagnetronTime,
  MAGNETRON_COURSES,
  MAGNETRON_HEIGHT,
  MAGNETRON_EXIT_RADIUS,
  MAGNETRON_POST_RADIUS,
  MAGNETRON_PUCK_RADIUS,
  MAGNETRON_WIDTH,
  pauseMagnetron,
  resetMagnetronCourse,
  resumeMagnetron,
  restartMagnetron,
  startMagnetron,
  toggleMagnetronPost,
  type MagnetronState,
} from './magnetron'

export function MagnetronGame({
  onBack,
  bestTimeMs,
  onRecordTime,
  reduceMotion,
}: {
  onBack: () => void
  bestTimeMs: number | null
  onRecordTime: (timeMs: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createMagnetronState)
  const stateRef = useRef(state)
  const fieldRef = useRef<HTMLDivElement>(null)
  const lastRecordedTime = useRef<number | null>(null)
  const lastRailSound = useRef(0)
  const playSound = useArcadeSound()
  const course = MAGNETRON_COURSES[state.courseIndex]!

  const commit = (next: MagnetronState) => {
    stateRef.current = next
    setState(next)
  }

  useEffect(() => {
    if (state.phase !== 'playing') return
    let frame = 0
    let previous = performance.now()
    let accumulated = 0
    const tick = (now: number) => {
      accumulated += Math.max(0, now - previous)
      previous = now
      if (accumulated >= (reduceMotion ? 50 : 32)) {
        const delta = accumulated
        accumulated = 0
        const before = stateRef.current
        const next = advanceMagnetron(before, delta)
        if (next !== before) {
          stateRef.current = next
          setState(next)
          if (next.collisions > before.collisions && Date.now() - lastRailSound.current > 240) {
            lastRailSound.current = Date.now()
            playSound('hit')
          }
          if (next.phase === 'won' && before.phase !== 'won') playSound('win')
        }
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [playSound, reduceMotion, state.phase])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState === 'hidden' && stateRef.current.phase === 'playing') commit(pauseMagnetron(stateRef.current))
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  useEffect(() => {
    if (state.phase === 'won' && lastRecordedTime.current !== state.elapsedMs) {
      lastRecordedTime.current = state.elapsedMs
      onRecordTime(state.elapsedMs)
    }
  }, [onRecordTime, state.elapsedMs, state.phase])

  function focusField() {
    window.requestAnimationFrame(() => fieldRef.current?.focus())
  }

  function start() {
    lastRecordedTime.current = null
    commit(startMagnetron(stateRef.current))
    focusField()
  }

  function restart() {
    lastRecordedTime.current = null
    commit(restartMagnetron(stateRef.current))
    focusField()
  }

  function togglePause() {
    const current = stateRef.current
    commit(current.phase === 'paused' ? resumeMagnetron(current) : pauseMagnetron(current))
  }

  function reversePost(index: number) {
    const current = stateRef.current
    const next = toggleMagnetronPost(current, index)
    if (next !== current) {
      commit(next)
      playSound('score')
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && (stateRef.current.phase === 'playing' || stateRef.current.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    if (event.repeat) return
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      restart()
      return
    }
    const index = Number(event.key) - 1
    if (Number.isInteger(index) && index >= 0 && index < stateRef.current.posts.length) {
      event.preventDefault()
      reversePost(index)
    }
  }

  const phaseLabel = state.phase === 'ready' ? 'STANDBY'
    : state.phase === 'playing' ? 'FIELD LIVE'
      : state.phase === 'paused' ? 'PAUSED' : 'COURSE CLEAR'
  const description = state.phase === 'ready'
    ? 'Switch each magnetic post between pull and push to guide the puck through three original courses.'
    : state.phase === 'won'
      ? `All three courses cleared in ${formatMagnetronTime(state.elapsedMs)}.`
      : `${course.title}, course ${state.courseIndex + 1} of ${MAGNETRON_COURSES.length}. ${state.phase === 'paused' ? 'Paused.' : 'Field active.'}`

  return (
    <section className={`snake-view magnetron-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="magnetron-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout magnetron-layout">
        <div className="snake-copy magnetron-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="magnetron-title">Magnetron<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">A puck, a field of poles, and one clean line to the exit.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Each post pulls or pushes the puck. Reversing a post sends a quick field pulse toward or away from it, so a well-timed switch can clear a rail. Guide the puck into every exit ring.</p>
            <p>Tap a polarity control or use <strong>1–4</strong> for posts in order. <strong>Escape</strong> pauses; <strong>R</strong> restarts the run. Resetting the puck adds three seconds.</p>
          </div>
          <div className="score-card magnetron-score" aria-label={`Run time ${formatMagnetronTime(state.elapsedMs)}. Course ${state.courseIndex + 1} of ${MAGNETRON_COURSES.length}. ${bestTimeMs === null ? 'No local best yet.' : `Local best ${formatMagnetronTime(bestTimeMs)}.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">RUN TIME</span>
              <strong className="score-value">{formatMagnetronTime(state.elapsedMs)}</strong>
              <span className="score-unit">{state.resets} puck resets</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong>{bestTimeMs === null ? '—' : formatMagnetronTime(bestTimeMs)}</strong>
            </div>
          </div>
          <p className="magnetron-local-note">Your fastest clear stays in this browser and does not sync.</p>
        </div>

        <div className="play-column magnetron-play-column">
          <div className={`magnetron-console phase-${state.phase}`}>
            <div className="frame-topline"><span>FIELD 39</span><span className="frame-light"><i /> {phaseLabel}</span></div>
            <div className="magnetron-roundline">
              <div><span>COURSE {String(state.courseIndex + 1).padStart(2, '0')} / 03</span><strong>{course.title}</strong></div>
              <b>{formatMagnetronTime(state.elapsedMs)}</b>
            </div>

            <div
              className="magnetron-board-wrap"
              ref={fieldRef}
              role="group"
              tabIndex={0}
              aria-label="Magnetron field. Use 1 to 4 to reverse each post. Escape pauses and R restarts."
            >
              <svg
                className="magnetron-board"
                viewBox={`0 0 ${MAGNETRON_WIDTH} ${MAGNETRON_HEIGHT}`}
                role="img"
                aria-label={`${course.title} magnetic course. Puck at ${Math.round(state.puck.x)}, ${Math.round(state.puck.y)}. Exit at the glowing ring.`}
              >
                <defs>
                  <pattern id="magnetron-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#3d4052" strokeWidth="1" /></pattern>
                  <radialGradient id="magnetron-puck"><stop stopColor="#fff7dc" /><stop offset=".65" stopColor="#74e8ef" /><stop offset="1" stopColor="#278eaa" /></radialGradient>
                </defs>
                <rect width={MAGNETRON_WIDTH} height={MAGNETRON_HEIGHT} fill="#171b28" />
                <rect width={MAGNETRON_WIDTH} height={MAGNETRON_HEIGHT} fill="url(#magnetron-grid)" />
                <path d={`M12 12H${MAGNETRON_WIDTH - 12}V${MAGNETRON_HEIGHT - 12}H12Z`} fill="none" stroke="#756388" strokeWidth="4" />
                {course.walls.map((wall, index) => <rect key={index} className="magnetron-wall" x={wall.x} y={wall.y} width={wall.width} height={wall.height} rx="5" />)}
                <circle className="magnetron-exit-halo" cx={course.exit.x} cy={course.exit.y} r={MAGNETRON_EXIT_RADIUS + 13} />
                <circle className="magnetron-exit" cx={course.exit.x} cy={course.exit.y} r={MAGNETRON_EXIT_RADIUS} />
                <path className="magnetron-exit-cross" d={`M${course.exit.x - 8} ${course.exit.y}h16M${course.exit.x} ${course.exit.y - 8}v16`} />
                {state.posts.map((post, index) => (
                  <g key={`${post.name}-${index}`} className={`magnetron-pole ${post.polarity === 1 ? 'is-pull' : 'is-push'}`}>
                    <circle className="magnetron-field-ring" cx={post.x} cy={post.y} r={MAGNETRON_POST_RADIUS + 11} />
                    <circle className="magnetron-pole-core" cx={post.x} cy={post.y} r={MAGNETRON_POST_RADIUS} />
                    <path d={`M${post.x - 7} ${post.y}h14M${post.x} ${post.y - 7}v14`} />
                    <text x={post.x} y={post.y - 28} textAnchor="middle">{index + 1}</text>
                  </g>
                ))}
                <circle className="magnetron-puck-halo" cx={state.puck.x} cy={state.puck.y} r={MAGNETRON_PUCK_RADIUS + 7} />
                <circle className="magnetron-puck" cx={state.puck.x} cy={state.puck.y} r={MAGNETRON_PUCK_RADIUS} />
              </svg>
            </div>

            <p className="magnetron-status" role="status" aria-live="polite">{state.message}</p>
            <div className="magnetron-pole-controls" role="group" aria-label="Magnetic field polarity controls">
              {state.posts.map((post, index) => (
                <button
                  key={`${post.name}-${index}`}
                  className={`magnetron-pole-button ${post.polarity === 1 ? 'is-pull' : 'is-push'}`}
                  type="button"
                  onClick={() => reversePost(index)}
                  disabled={state.phase !== 'playing'}
                  aria-label={`Reverse ${post.name} post, currently ${post.polarity === 1 ? 'pulling' : 'pushing'}`}
                >
                  <span className="magnetron-pole-key">{index + 1}</span>
                  <span className="magnetron-polarity" aria-hidden="true">{post.polarity === 1 ? '+' : '−'}</span>
                  <span><strong>{post.name}</strong><small>{post.polarity === 1 ? 'PULL' : 'PUSH'}</small></span>
                </button>
              ))}
            </div>

            <div className="magnetron-actions">
              {state.phase === 'ready' ? <button className="magnetron-action magnetron-action-primary" type="button" onClick={start}>Start run <span aria-hidden="true">▶</span></button>
                : state.phase === 'won' ? <button className="magnetron-action magnetron-action-primary" type="button" onClick={start}>Run it again <span aria-hidden="true">↻</span></button>
                  : <button className="magnetron-action magnetron-action-pause" type="button" onClick={togglePause}>{state.phase === 'paused' ? 'Resume run' : 'Pause run'} <kbd>ESC</kbd></button>}
              {(state.phase === 'playing' || state.phase === 'paused') && <button className="magnetron-action magnetron-action-reset" type="button" onClick={() => { commit(resetMagnetronCourse(stateRef.current)); focusField() }}>Reset puck <small>+3 SEC</small></button>}
              <button className="magnetron-action magnetron-action-restart" type="button" onClick={restart}>Restart</button>
            </div>
            <div className="magnetron-console-footer"><span>1–4 / TOUCH POLARITY</span><span>{state.courseIndex + 1} / 03 COURSES</span></div>
          </div>
          <p className="magnetron-footnote">The puck coasts while the field is live. Reverse a post with one press; no key holding is needed.</p>
          <span className="sr-only" aria-live="polite">{description}</span>
        </div>
      </div>
    </section>
  )
}
