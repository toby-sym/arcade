import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createPrismDashState,
  formatPrismDashTime,
  PRISM_DASH_SEGMENT_COUNT,
  prismDashReducer,
  prismDashSegmentDuration,
  type PrismDashLane,
} from './prismDash'

interface PrismDashGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
  reduceMotion: boolean
}

const LANE_NAMES = ['Left lane', 'Center lane', 'Right lane'] as const

export function PrismDashGame({ onBack, bestScore, onRecordScore, reduceMotion }: PrismDashGameProps) {
  const today = utcDateKey()
  const [state, dispatch] = useReducer(prismDashReducer, today, createPrismDashState)
  const [systemReduceMotion, setSystemReduceMotion] = useState(false)
  const fieldRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const previousResult = useRef({ shards: state.shards, gatesHit: state.gatesHit, phase: state.phase })
  const recordedScore = useRef(0)
  const segment = state.course[Math.min(state.segmentIndex, state.course.length - 1)]!
  const duration = prismDashSegmentDuration(Math.min(state.segmentIndex, state.course.length - 1))
  const progress = state.segmentElapsedMs / duration
  const remainingMs = Math.max(0, duration - state.segmentElapsedMs)
  const runTime = formatPrismDashTime(state.elapsedMs)
  const markerProgress = reduceMotion || systemReduceMotion ? .58 : progress
  const markerY = 118 + markerProgress * 184
  const gateX = laneCenter(segment.gateLane, markerProgress)
  const shardX = laneCenter(segment.shardLane, markerProgress)
  const runnerX = laneCenter(state.lane, 1)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setSystemReduceMotion(preference.matches)
    updatePreference()
    preference.addEventListener('change', updatePreference)
    return () => preference.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (state.score > recordedScore.current) {
      recordedScore.current = state.score
      onRecordScore(state.score)
    }
  }, [onRecordScore, state.score])

  useEffect(() => {
    const previous = previousResult.current
    if (state.phase === 'won' && previous.phase !== 'won') playSound('win')
    else if (state.phase === 'over' && previous.phase !== 'over') playSound('lose')
    else if (state.shards > previous.shards) playSound('score')
    else if (state.gatesHit > previous.gatesHit) playSound('miss')
    previousResult.current = { shards: state.shards, gatesHit: state.gatesHit, phase: state.phase }
  }, [playSound, state.gatesHit, state.phase, state.shards])

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
  const chooseLane = (lane: PrismDashLane) => dispatch({ type: 'lane', lane })

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
      chooseLane(Number(event.key) - 1 as PrismDashLane)
      return
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    if (key === 'ArrowLeft' || key === 'a') {
      event.preventDefault()
      dispatch({ type: 'move', delta: -1 })
    } else if (key === 'ArrowRight' || key === 'd') {
      event.preventDefault()
      dispatch({ type: 'move', delta: 1 })
    }
  }

  return (
    <section className="snake-view prism-dash-view" aria-labelledby="prism-dash-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout prism-dash-layout">
        <div className="snake-copy prism-dash-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY RUN · UTC</p>
          <h1 id="prism-dash-title">Prism Dash<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Three lanes. Catch the light. Slip past the gates.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Each checkpoint has a bright shard and a gate. Change lanes to catch the shard, or take the open lane to stay safe. A gate strike costs one of your three lives.</p>
            <p>Press <strong>Left / Right</strong> or <strong>A / D</strong> to shift one lane. Press <strong>1–3</strong> or tap a lane button to jump straight there. Reach the finish line; the daily course is the same for everyone on a UTC date.</p>
            <p><strong>Space</strong> starts or resumes, <strong>Escape</strong> pauses, and <strong>R</strong> restarts the run. Your best score stays saved in this browser and does not sync.</p>
          </div>

          <div className="score-card prism-dash-score" aria-label={`Score ${state.score}. ${state.shards} shards caught. ${state.lives} lives remain. ${state.streak} shard streak. Course segment ${Math.min(state.segmentIndex + 1, PRISM_DASH_SEGMENT_COUNT)} of ${PRISM_DASH_SEGMENT_COUNT}. Run time ${runTime}. ${bestScore === null ? 'No local best yet.' : `Local best ${bestScore} points.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">RUN SCORE</span>
              <strong className="score-value">{String(state.score).padStart(4, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
            <div className="breakout-stats">
              <span><strong>{state.shards}</strong> shards</span>
              <span><strong>{state.lives}</strong> lives</span>
              <span><strong>{state.streak}</strong> streak</span>
              <span><strong>{Math.min(state.segmentIndex + 1, PRISM_DASH_SEGMENT_COUNT)}</strong> / {PRISM_DASH_SEGMENT_COUNT} gates</span>
              <span><strong>{runTime}</strong> elapsed</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST RUN · THIS BROWSER</span>
              <strong className="score-value">{bestScore === null ? '—' : String(bestScore).padStart(4, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
          </div>
          <p className="prism-dash-local-note">Your highest run score is saved in this browser and does not sync.</p>
          <div className="game-actions">
            {state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Start the run <span aria-hidden="true">→</span></button>
            ) : state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => dispatch({ type: 'pause' })}>Pause run <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume run <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Run today again <span aria-hidden="true">→</span></button>
            )}
            {state.phase !== 'ready' && <button className="button button-quiet" type="button" onClick={restart}>Restart course</button>}
          </div>
        </div>

        <div className="play-column prism-dash-play-column">
          <div className="prism-dash-console" onKeyDown={handleKeyDown}>
            <div className="frame-topline">
              <span>COURSE 30</span>
              <span className={`frame-light${state.phase === 'won' ? ' phase-complete' : ''}`}><i />{state.phase === 'playing' ? `GATE ${state.segmentIndex + 1} / ${PRISM_DASH_SEGMENT_COUNT}` : state.phase.toUpperCase()}</span>
            </div>
            <div className="prism-dash-target">
              <span className="score-caption">{state.phase === 'playing' ? 'NEXT CHECKPOINT' : 'DAILY COURSE · UTC'}</span>
              <strong><i className="prism-target-shard" /> Lane {segment.shardLane + 1} shard <i className="prism-target-gate" /> Lane {segment.gateLane + 1} gate</strong>
              <span>{state.phase === 'playing' ? `${(remainingMs / 1000).toFixed(1)} seconds to switch` : `${state.course.length} gates · 3 lanes · one finish line`}</span>
            </div>
            <div
              ref={fieldRef}
              className={`prism-dash-field${state.phase === 'paused' ? ' is-paused' : ''}`}
              role="group"
              aria-label="Prism Dash three lane course"
              tabIndex={0}
            >
              <svg className="prism-dash-track" viewBox="0 0 620 410" aria-hidden="true">
                <defs>
                  <linearGradient id="prism-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#151524" /><stop offset="1" stopColor="#10121b" /></linearGradient>
                  <filter id="prism-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <path className="prism-road" d="M228 50 H392 L620 390 H0 Z" />
                <path className="prism-rail" d="M228 50 L0 390 M283 50 L200 390 M337 50 L420 390 M392 50 L620 390" />
                <path className="prism-horizon" d="M226 51 H394" />
                <path className="prism-progress-lines" d="M74 116 H546 M45 205 H575 M18 294 H602" />
                <text className="prism-lane-label" x="82" y="375" textAnchor="middle">1</text>
                <text className="prism-lane-label" x="310" y="375" textAnchor="middle">2</text>
                <text className="prism-lane-label" x="538" y="375" textAnchor="middle">3</text>
                {state.phase !== 'ready' && (
                  <>
                    <g className="prism-gate-marker" transform={`translate(${gateX} ${markerY})`} filter="url(#prism-glow)">
                      <path d="M-25 -12 H25 L19 12 H-19 Z" />
                      <text x="0" y="4" textAnchor="middle">▲</text>
                    </g>
                    <g className="prism-shard-marker" transform={`translate(${shardX} ${markerY - 20})`} filter="url(#prism-glow)">
                      <path d="M0 -17 L14 0 L0 17 L-14 0 Z" />
                      <text x="0" y="4" textAnchor="middle">✦</text>
                    </g>
                    <g className={`prism-runner prism-runner-lane-${state.lane}`} transform={`translate(${runnerX} 332)`}>
                      <circle r="23" />
                      <path d="M-5 -12 L13 0 L-5 12 Z" />
                      <path className="prism-runner-trail" d="M-26 0 H-42" />
                    </g>
                  </>
                )}
              </svg>
              <div className="prism-dash-meter" role="progressbar" aria-label="Time to the next gate" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <span style={{ width: `${progress * 100}%` }} />
              </div>
              {(state.phase === 'ready' || state.phase === 'paused' || state.phase === 'won' || state.phase === 'over') && (
                <div className="prism-dash-overlay">
                  <strong>{state.phase === 'ready' ? 'FIND YOUR LINE' : state.phase === 'paused' ? 'RUN PAUSED' : state.phase === 'won' ? 'FINISH LINE' : 'RUN OVER'}</strong>
                  <span>{state.phase === 'ready' ? 'Catch the shard or move clear before each gate.' : state.phase === 'paused' ? 'The course is stopped. Your run is safe.' : `${state.shards} shards · ${state.score} points · ${runTime}`}</span>
                  {state.phase === 'ready' && <button className="button button-primary" type="button" onClick={start}>Start the run</button>}
                  {state.phase === 'paused' && <button className="button button-primary" type="button" onClick={start}>Resume run</button>}
                  {(state.phase === 'won' || state.phase === 'over') && <button className="button button-primary" type="button" onClick={restart}>Run today again</button>}
                </div>
              )}
            </div>
            <div className="prism-dash-lane-buttons" aria-label="Choose a running lane">
              {LANE_NAMES.map((name, index) => (
                <button
                  key={name}
                  className={`prism-lane-button prism-lane-button-${index}${state.lane === index ? ' is-selected' : ''}${segment.shardLane === index ? ' has-shard' : ''}${segment.gateLane === index ? ' has-gate' : ''}`}
                  type="button"
                  aria-pressed={state.lane === index}
                  disabled={state.phase !== 'playing'}
                  onClick={() => chooseLane(index as PrismDashLane)}
                >
                  <span className="prism-lane-symbol" aria-hidden="true">{segment.shardLane === index ? '✦' : segment.gateLane === index ? '▲' : '◇'}</span>
                  <strong>{name}</strong>
                  <small>{index + 1} · {segment.shardLane === index ? 'SHARD' : segment.gateLane === index ? 'GATE' : 'CLEAR'}</small>
                </button>
              ))}
            </div>
            <p className="prism-dash-status" role="status" aria-live="polite">{state.message}</p>
            <div className="prism-dash-console-footer"><span>LEFT / RIGHT · A / D · 1–3 · TOUCH</span><span>{state.lives} / 3 LIVES</span></div>
          </div>
          <p className="prism-dash-keyboard-hint">Focus the course to shift lanes. One lane change per key press; Escape pauses the run.</p>
        </div>
      </div>
    </section>
  )
}

function laneCenter(lane: PrismDashLane, progress: number): number {
  const far = [246, 310, 374][lane]!
  const near = [100, 310, 520][lane]!
  return far + (near - far) * progress
}
