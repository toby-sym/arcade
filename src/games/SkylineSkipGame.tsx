import { useEffect, useReducer, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import {
  createSkylineState,
  SKYLINE_FINISH_X,
  SKYLINE_CHECKPOINTS,
  SKYLINE_HAZARDS,
  SKYLINE_PLATFORMS,
  SKYLINE_SHARDS,
  SKYLINE_VIEW_HEIGHT,
  SKYLINE_VIEW_WIDTH,
  skylineCameraX,
  skylineReducer,
} from './skylineSkip'

interface SkylineSkipGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
}

const CITY_BLOCKS = Array.from({ length: 15 }, (_, index) => ({
  x: index * 205,
  width: 104 + (index * 37 % 74),
  height: 62 + (index * 53 % 94),
}))

export function SkylineSkipGame({ onBack, bestScore, onRecordScore }: SkylineSkipGameProps) {
  const [state, dispatch] = useReducer(skylineReducer, undefined, createSkylineState)
  const stageRef = useRef<HTMLDivElement>(null)
  const input = useRef({ left: false, right: false, jumpPressed: false })
  const cameraX = skylineCameraX(state.x)
  const statusLabel = state.phase === 'playing' ? 'RUNNING' : state.phase.toUpperCase()
  const shardsLeft = SKYLINE_SHARDS.length - state.shards.length

  useEffect(() => {
    if (state.score > 0) onRecordScore(state.score)
  }, [onRecordScore, state.score])

  useEffect(() => {
    if (state.phase !== 'playing') return
    let frame = 0
    let previousTime = window.performance.now()
    const update = (time: number) => {
      const deltaMs = Math.min(Math.max(time - previousTime, 0), 50)
      previousTime = time
      const { left, right, jumpPressed } = input.current
      input.current.jumpPressed = false
      dispatch({ type: 'step', deltaMs, direction: (Number(right) - Number(left)) as -1 | 0 | 1, jumpPressed })
      frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frame)
  }, [state.phase])

  useEffect(() => {
    const releaseKey = (event: globalThis.KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if (key === 'ArrowLeft' || key === 'a') input.current.left = false
      if (key === 'ArrowRight' || key === 'd') input.current.right = false
    }
    const releaseAll = () => {
      input.current.left = false
      input.current.right = false
      input.current.jumpPressed = false
    }
    const pauseWhenHidden = () => {
      if (document.hidden) {
        releaseAll()
        dispatch({ type: 'pause' })
      }
    }
    window.addEventListener('keyup', releaseKey)
    window.addEventListener('blur', releaseAll)
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => {
      window.removeEventListener('keyup', releaseKey)
      window.removeEventListener('blur', releaseAll)
      document.removeEventListener('visibilitychange', pauseWhenHidden)
    }
  }, [])

  const focusStage = () => window.requestAnimationFrame(() => stageRef.current?.focus())
  const start = () => {
    dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusStage()
  }
  const restart = () => {
    input.current.left = false
    input.current.right = false
    input.current.jumpPressed = false
    dispatch({ type: 'restart' })
    focusStage()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') {
      event.preventDefault()
      if (state.phase === 'playing') {
        if (key === 'ArrowLeft' || key === 'a') input.current.left = true
        else input.current.right = true
      }
      return
    }
    if ((event.code === 'Space' || key === 'ArrowUp' || key === 'w') && state.phase === 'ready') {
      event.preventDefault()
      start()
    } else if ((event.code === 'Space' || key === 'ArrowUp' || key === 'w') && state.phase === 'playing') {
      event.preventDefault()
      if (!event.repeat) input.current.jumpPressed = true
    } else if (event.key === 'Escape' && state.phase === 'playing') {
      event.preventDefault()
      input.current.left = false
      input.current.right = false
      dispatch({ type: 'pause' })
    } else if (event.key === 'Escape' && state.phase === 'paused') {
      event.preventDefault()
      start()
    } else if (key === 'r') {
      event.preventDefault()
      restart()
    }
  }

  const setTouchDirection = (direction: 'left' | 'right', pressed: boolean) => {
    input.current[direction] = pressed
  }

  const holdPointer = (event: PointerEvent<HTMLButtonElement>, direction: 'left' | 'right') => {
    event.preventDefault()
    if (state.phase !== 'playing') return
    setTouchDirection(direction, true)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Pointer capture is optional. */ }
  }

  const releasePointer = (direction: 'left' | 'right') => setTouchDirection(direction, false)

  const tapDirection = (event: MouseEvent<HTMLButtonElement>, direction: 'left' | 'right') => {
    if (event.detail !== 0 || state.phase !== 'playing') return
    const axis = direction === 'right' ? 1 : -1
    for (let frame = 0; frame < 3; frame += 1) dispatch({ type: 'step', deltaMs: 50, direction: axis })
  }

  const jumpPointer = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (state.phase === 'playing') input.current.jumpPressed = true
  }

  const tapJump = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0 && state.phase === 'playing') dispatch({ type: 'step', deltaMs: 16, direction: 0, jumpPressed: true })
  }

  const courseDescription = state.phase === 'ready'
    ? 'Ready at the first rooftop. Reach the beacon at the far end.'
    : state.phase === 'playing'
      ? `${state.lives} lives remain. ${shardsLeft} shards remain. Checkpoint ${state.checkpoint + 1} of 3.`
      : state.phase === 'paused'
        ? 'Run paused.'
        : state.phase === 'won'
          ? `Beacon reached with ${state.score} points in ${(state.elapsedMs / 1000).toFixed(1)} seconds.`
          : `Run over with ${state.score} points. The next run starts at the last checkpoint.`

  return (
    <section className="snake-view skyline-view" aria-labelledby="skyline-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout skyline-layout">
        <div className="snake-copy skyline-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> ARCADE RUN · ROOFTOPS 01—03</p>
          <h1 id="skyline-title">Skyline Skip<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Keep your momentum. Clear the rooftops. Reach the beacon.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Run with the left and right arrows or A and D. Press Space, Up, or W to jump over gaps and signal spikes. Shards add points; beacons mark checkpoints.</p>
            <p>On a phone, hold the direction buttons and tap <strong>Jump</strong>. You have three lives. Escape pauses and R restarts.</p>
          </div>
          <div className="score-card skyline-score" aria-label={`Score ${state.score}. ${state.lives} lives left. ${shardsLeft} shards left. ${bestScore === null ? 'No local best yet.' : `Local best ${bestScore} points.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">THIS RUN</span>
              <strong className="score-value">{String(state.score).padStart(3, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
            <div className="breakout-stats">
              <span><strong>{state.lives}</strong> lives</span>
              <span><strong>{shardsLeft}</strong> shards</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong className="score-value">{bestScore === null ? '—' : String(bestScore).padStart(3, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
          </div>
          <div className="game-actions">
            {state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => { input.current.left = false; input.current.right = false; dispatch({ type: 'pause' }) }}>Pause <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume <span aria-hidden="true">→</span></button>
            ) : state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Start run <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Run again <span aria-hidden="true">→</span></button>
            )}
            <button className="button button-quiet" type="button" onClick={restart}>Restart run</button>
          </div>
          <p className="keyboard-hint">Hold arrows / A-D · Space jumps · Escape pauses · R restarts</p>
        </div>

        <div className="play-column skyline-play-column" onKeyDown={handleKeyDown}>
          <div
            ref={stageRef}
            className="skyline-stage"
            role="group"
            aria-label={`Skyline Skip course. ${courseDescription}`}
            tabIndex={0}
          >
            <div className="skyline-stage-topline">
              <span>ROOFTOP RUN · CHECKPOINT {state.checkpoint + 1}/3</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {statusLabel}</span>
            </div>
            <svg className="skyline-course" viewBox={`0 0 ${SKYLINE_VIEW_WIDTH} ${SKYLINE_VIEW_HEIGHT}`} aria-hidden="true">
              <defs>
                <linearGradient id="skyline-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#201b38" />
                  <stop offset="1" stopColor="#392744" />
                </linearGradient>
                <linearGradient id="skyline-roof" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#473954" />
                  <stop offset="1" stopColor="#252035" />
                </linearGradient>
              </defs>
              <rect width={SKYLINE_VIEW_WIDTH} height={SKYLINE_VIEW_HEIGHT} fill="url(#skyline-sky)" />
              <path className="skyline-moon" d="M684 44a22 22 0 1 0 22 22 18 18 0 0 1-22-22Z" />
              {CITY_BLOCKS.map((block, index) => (
                <g key={block.x} transform={`translate(${block.x - cameraX * 0.28}, 0)`}>
                  <rect x={0} y={204 - block.height} width={block.width} height={block.height + 180} fill={index % 2 === 0 ? '#262039' : '#2d2542'} />
                  {Array.from({ length: Math.floor(block.height / 22) }, (_, row) => (
                    <g key={row} className="skyline-windows">
                      <rect x="16" y={219 - block.height + row * 22} width="8" height="6" />
                      <rect x="38" y={219 - block.height + row * 22} width="8" height="6" />
                      {block.width > 145 && <rect x="60" y={219 - block.height + row * 22} width="8" height="6" />}
                    </g>
                  ))}
                </g>
              ))}
              {SKYLINE_PLATFORMS.map((platform, index) => (
                <g key={platform.x} transform={`translate(${platform.x - cameraX}, 0)`}>
                  <rect x="0" y={platform.top} width={platform.width} height={SKYLINE_VIEW_HEIGHT - platform.top} fill="url(#skyline-roof)" />
                  <rect x="0" y={platform.top} width={platform.width} height="4" className="skyline-roof-edge" />
                  {index % 2 === 0 && <path d={`M16 ${platform.top + 15}h34m14 0h25m22 0h18`} className="skyline-roof-grit" />}
                </g>
              ))}
              {SKYLINE_HAZARDS.map((hazard) => (
                <g key={hazard.x} transform={`translate(${hazard.x - cameraX}, 0)`}>
                  <path d={`M0 ${hazard.top + hazard.height}l${hazard.width / 2} -${hazard.height}l${hazard.width / 2} ${hazard.height}Z`} className="skyline-spike" />
                  <path d={`M0 ${hazard.top + hazard.height}h${hazard.width}`} className="skyline-spike-base" />
                </g>
              ))}
              {SKYLINE_SHARDS.map((shard, index) => state.shards.includes(index) ? null : (
                <g key={shard.x} transform={`translate(${shard.x - cameraX}, ${shard.y})`}>
                  <path d="M0 -9L8 0 0 9 -8 0Z" className="skyline-shard" />
                  <circle r="2" className="skyline-shard-core" />
                </g>
              ))}
              {SKYLINE_CHECKPOINTS.slice(1).map((checkpointX, index) => (
                <g key={checkpointX} transform={`translate(${checkpointX - cameraX}, 0)`}>
                  <path d="M0 304V190" className="skyline-checkpoint-stem" />
                  <path d="M0 190h30l-8 9 8 9H0Z" className={`skyline-checkpoint-flag${state.checkpoint >= index + 1 ? ' is-active' : ''}`} />
                  <text x="5" y="220" className="skyline-checkpoint-number">{index + 1}</text>
                </g>
              ))}
              <g transform={`translate(${SKYLINE_FINISH_X - cameraX}, 0)`}>
                <path d="M0 304V172" className="skyline-beacon-stem" />
                <path d="M0 172h42l-10 12 10 12H0Z" className="skyline-beacon-flag" />
              </g>
              <g transform={`translate(${state.x - cameraX}, ${state.y})`} className={`skyline-runner${state.grounded ? '' : ' is-airborne'}`}>
                <rect x="1" y="8" width="26" height="28" rx="6" className="skyline-runner-body" />
                <path d="M5 8V4a9 9 0 0 1 18 0v4Z" className="skyline-runner-helmet" />
                <circle cx="20" cy="16" r="2" className="skyline-runner-eye" />
                <path d="M4 35h9m3 0h8" className="skyline-runner-feet" />
              </g>
            </svg>
            <div className="skyline-stage-footer"><span>{state.score} POINTS · {shardsLeft} SHARDS</span><span>{(state.elapsedMs / 1000).toFixed(1)} SEC</span></div>
            {(state.phase === 'ready' || state.phase === 'paused' || state.phase === 'won' || state.phase === 'over') && (
              <div className="skyline-stage-overlay" role="status" aria-live="polite">
                <strong>{state.phase === 'ready' ? 'Rooftops ahead' : state.phase === 'paused' ? 'Run paused' : state.phase === 'won' ? 'Beacon reached!' : 'Run over'}</strong>
                <span>{state.phase === 'ready' ? 'Keep your stride, leap the gaps, and follow the shards.' : state.phase === 'paused' ? 'Pick up where you left off.' : state.phase === 'won' ? `You made the skyline in ${(state.elapsedMs / 1000).toFixed(1)} seconds.` : 'Your last beacon keeps your next run moving.'}</span>
              </div>
            )}
          </div>
          <div className="skyline-touch-controls" role="group" aria-label="Skyline Skip touch controls">
            <button className="button button-secondary" type="button" aria-label="Run left" disabled={state.phase !== 'playing'} onPointerDown={(event) => holdPointer(event, 'left')} onPointerUp={() => releasePointer('left')} onPointerCancel={() => releasePointer('left')} onClick={(event) => tapDirection(event, 'left')}>←</button>
            <button className="button button-secondary" type="button" aria-label="Run right" disabled={state.phase !== 'playing'} onPointerDown={(event) => holdPointer(event, 'right')} onPointerUp={() => releasePointer('right')} onPointerCancel={() => releasePointer('right')} onClick={(event) => tapDirection(event, 'right')}>→</button>
            <button className="button button-primary skyline-jump-button" type="button" aria-label="Jump" disabled={state.phase !== 'playing'} onPointerDown={jumpPointer} onClick={tapJump}>JUMP <span aria-hidden="true">↑</span></button>
          </div>
          <p className="skyline-status" role="status" aria-live="polite">{courseDescription}</p>
        </div>
      </div>
    </section>
  )
}
