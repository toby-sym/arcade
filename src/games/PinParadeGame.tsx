import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  PIN_PARADE_FRAME_COUNT,
  PIN_PARADE_LANE_HEIGHT,
  PIN_PARADE_LANE_WIDTH,
  advancePinParade,
  adjustPinParadeAim,
  adjustPinParadePower,
  adjustPinParadeSpin,
  createPinParadeState,
  launchPinParadeBall,
  nextPinParadeRoll,
  pausePinParade,
  pinParadeNextRollLabel,
  restartPinParade,
  resumePinParade,
  scorePinParade,
  setPinParadeControls,
  startPinParade,
  type PinParadePin,
  type PinParadeState,
} from './pinParade'

export function PinParadeGame({
  onBack,
  bestScore,
  onRecordScore,
  reduceMotion,
}: {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createPinParadeState)
  const stateRef = useRef(state)
  const laneRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ pointerId: number } | null>(null)
  const lastRecordedScore = useRef<number | null>(null)
  const previousKnocked = useRef<number | null>(null)
  const playSound = useArcadeSound()
  const score = scorePinParade(state.frames)
  const frameRolls = state.frames[Math.min(state.frameIndex, PIN_PARADE_FRAME_COUNT - 1)] ?? []
  const phaseLabel = state.phase === 'ready' ? 'GAME SET'
    : state.phase === 'aiming' ? 'YOUR TURN'
      : state.phase === 'rolling' ? 'BALL IN PLAY'
        : state.phase === 'result' ? 'PINS SETTLED'
          : state.phase === 'paused' ? 'PAUSED' : 'FINAL SCORE'
  const description = state.phase === 'complete'
    ? `Ten frames complete. Final score ${score.total}.`
    : `Frame ${Math.min(state.frameIndex + 1, PIN_PARADE_FRAME_COUNT)} of ${PIN_PARADE_FRAME_COUNT}. ${state.message}`

  function commit(next: PinParadeState) {
    stateRef.current = next
    setState(next)
  }

  function focusLane() {
    window.requestAnimationFrame(() => laneRef.current?.focus())
  }

  function start() {
    lastRecordedScore.current = null
    previousKnocked.current = null
    commit(startPinParade(stateRef.current))
    focusLane()
  }

  function restart() {
    lastRecordedScore.current = null
    previousKnocked.current = null
    dragRef.current = null
    commit(restartPinParade(stateRef.current))
    focusLane()
  }

  function bowl() {
    const next = launchPinParadeBall(stateRef.current)
    if (next === stateRef.current) return
    dragRef.current = null
    commit(next)
    playSound('hit')
  }

  function togglePause() {
    const current = stateRef.current
    commit(current.phase === 'paused' ? resumePinParade(current) : pausePinParade(current))
  }

  function lanePoint(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * PIN_PARADE_LANE_WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * PIN_PARADE_LANE_HEIGHT / bounds.height,
    }
  }

  function controlsFromDrag(point: { x: number; y: number }) {
    const dx = 200 - point.x
    const dy = 652 - point.y
    const distance = Math.hypot(dx, dy)
    if (distance < 4) return stateRef.current
    const angle = Math.atan2(dx, -dy) * 180 / Math.PI
    const power = Math.max(35, Math.min(100, distance * .42))
    return setPinParadeControls(stateRef.current, angle, power, stateRef.current.spin)
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (stateRef.current.phase !== 'aiming') return
    const point = lanePoint(event)
    if (Math.hypot(point.x - 200, point.y - 652) > 48) return
    dragRef.current = { pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    commit(controlsFromDrag(lanePoint(event)))
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    commit(launchPinParadeBall(controlsFromDrag(lanePoint(event))))
    dragRef.current = null
    playSound('hit')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.repeat) return
    const key = event.key.toLowerCase()
    if (key === 'escape' && (stateRef.current.phase === 'aiming' || stateRef.current.phase === 'rolling' || stateRef.current.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    if (key === 'r') {
      event.preventDefault()
      restart()
      return
    }
    if (event.target instanceof HTMLElement && event.target.matches('input, button')) return
    if (key === ' ' || key === 'enter') { event.preventDefault(); bowl(); return }
    if (key === 'arrowleft' || key === 'a') { event.preventDefault(); commit(adjustPinParadeAim(stateRef.current, -1)); return }
    if (key === 'arrowright' || key === 'd') { event.preventDefault(); commit(adjustPinParadeAim(stateRef.current, 1)); return }
    if (key === 'arrowup' || key === 'w') { event.preventDefault(); commit(adjustPinParadePower(stateRef.current, 3)); return }
    if (key === 'arrowdown' || key === 's') { event.preventDefault(); commit(adjustPinParadePower(stateRef.current, -3)); return }
    if (key === 'q') { event.preventDefault(); commit(adjustPinParadeSpin(stateRef.current, -5)); return }
    if (key === 'e') { event.preventDefault(); commit(adjustPinParadeSpin(stateRef.current, 5)) }
  }

  useEffect(() => {
    if (state.phase !== 'rolling') return
    let frame = 0
    let previousTime: number | null = null
    const tick = (time: number) => {
      const current = stateRef.current
      if (current.phase !== 'rolling') return
      const elapsed = previousTime === null ? 1 / 60 : Math.min(.05, (time - previousTime) / 1000)
      previousTime = time
      const next = advancePinParade(current, elapsed)
      stateRef.current = next
      setState(next)
      if (next.phase === 'rolling') frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [state.phase])

  useEffect(() => {
    if (state.phase !== 'complete' || lastRecordedScore.current === score.total) return
    lastRecordedScore.current = score.total
    onRecordScore(score.total)
    playSound('win')
  }, [onRecordScore, playSound, score.total, state.phase])

  useEffect(() => {
    if (state.pinsKnocked !== null && state.pinsKnocked !== previousKnocked.current && state.pinsKnocked > 0) playSound('score')
    previousKnocked.current = state.pinsKnocked
  }, [playSound, state.pinsKnocked])

  const lineAngle = state.aimDegrees * Math.PI / 180
  const guideEnd = { x: 200 + Math.sin(lineAngle) * 165, y: 652 - Math.cos(lineAngle) * 165 }
  const rollsLabel = (rolls: readonly number[]) => rolls.map((_, index) => formatRoll(rolls, index, state.frameIndex === 9)).join(' · ')

  return (
    <section className={`snake-view pin-parade-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="pin-parade-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout pin-parade-layout">
        <div className="snake-copy pin-parade-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="pin-parade-title">Pin Parade<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Find the line. Feel the lane. Bowl a perfect game.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Play all ten frames. Aim the ball through the pin deck; power adds carry, while spin bends its line. A strike clears the rack on your first ball. A spare takes both balls.</p>
            <p>Pull back from the ball and release, or adjust your line with <strong>Left / Right</strong>, power with <strong>Up / Down</strong>, and spin with <strong>Q / E</strong>. Press <strong>Space</strong> to bowl, <strong>Escape</strong> to pause, and <strong>R</strong> to restart.</p>
          </div>
          <div className="score-card pin-parade-score" aria-label={`Frame ${Math.min(state.frameIndex + 1, 10)} of 10. Current score ${score.total}. ${bestScore === null ? 'No local best yet.' : `Local best ${bestScore} points.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">GAME SCORE</span>
              <strong className="score-value">{String(score.total).padStart(3, '0')}</strong>
              <span className="score-unit">frame {Math.min(state.frameIndex + 1, 10)} of 10</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong>{bestScore === null ? '—' : String(bestScore).padStart(3, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
          </div>
          <p className="pin-parade-local-note">Your highest ten-frame score stays in this browser and does not sync.</p>
        </div>

        <div className="play-column pin-parade-play-column">
          <div className={`pin-parade-console phase-${state.phase}`}>
            <div className="frame-topline"><span>LANE 43</span><span className="frame-light"><i /> {phaseLabel}</span></div>
            <div className="pin-parade-roundline">
              <div><span>FRAME {String(Math.min(state.frameIndex + 1, 10)).padStart(2, '0')} / 10</span><strong>{frameRolls.length ? rollsLabel(frameRolls) : 'SET YOUR APPROACH'}</strong></div>
              <b>{String(score.total).padStart(3, '0')}<small> PTS</small></b>
            </div>

            <div className="pin-parade-lane-frame">
              <svg
                ref={laneRef}
                className="pin-parade-lane"
                viewBox={`0 0 ${PIN_PARADE_LANE_WIDTH} ${PIN_PARADE_LANE_HEIGHT}`}
                role="img"
                tabIndex={0}
                aria-label={`Bowling lane. Frame ${Math.min(state.frameIndex + 1, 10)}. ${state.pins.filter((pin) => pin.upright).length} pins remain standing. Pull back from the ball to set line and power.`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => { dragRef.current = null }}
              >
                <defs>
                  <linearGradient id="pin-parade-wood" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#9d6135" /><stop offset=".2" stopColor="#d3985b" /><stop offset=".5" stopColor="#efbb77" /><stop offset=".8" stopColor="#d3985b" /><stop offset="1" stopColor="#945c36" /></linearGradient>
                  <linearGradient id="pin-parade-rail" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#e2b474" /><stop offset=".5" stopColor="#75513c" /><stop offset="1" stopColor="#d4a366" /></linearGradient>
                  <radialGradient id="pin-parade-ball"><stop stopColor="#a4f8ee" /><stop offset=".58" stopColor="#54bcb5" /><stop offset="1" stopColor="#1b666f" /></radialGradient>
                  <pattern id="pin-parade-boards" width="36" height="80" patternUnits="userSpaceOnUse"><path d="M0 0v80M18 0v80M0 40h36" fill="none" stroke="#713f27" strokeOpacity=".2" strokeWidth="1" /></pattern>
                </defs>
                <rect className="pin-parade-lane-surround" x="16" y="8" width="368" height="704" rx="20" />
                <rect className="pin-parade-gutter" x="50" y="28" width="28" height="664" rx="8" />
                <rect className="pin-parade-gutter" x="322" y="28" width="28" height="664" rx="8" />
                <rect className="pin-parade-lane-wood" x="78" y="28" width="244" height="664" rx="6" fill="url(#pin-parade-wood)" />
                <rect className="pin-parade-boards" x="78" y="28" width="244" height="664" rx="6" fill="url(#pin-parade-boards)" />
                <path className="pin-parade-lane-highlight" d="M88 40v638M312 40v638" />
                {[125, 155, 185].map((y) => <g key={y} className="pin-parade-aim-mark"><circle cx="150" cy={y} r="3" /><circle cx="175" cy={y} r="3" /><circle cx="200" cy={y} r="3" /><circle cx="225" cy={y} r="3" /><circle cx="250" cy={y} r="3" /></g>)}
                <line className="pin-parade-foul-line" x1="80" y1="600" x2="320" y2="600" />
                <text className="pin-parade-lane-label" x="200" y="620" textAnchor="middle">FOUL LINE</text>
                {state.phase === 'aiming' && <line className="pin-parade-aim-guide" x1="200" y1="652" x2={guideEnd.x} y2={guideEnd.y} />}
                {state.pins.map((pin) => <PinGlyph key={pin.number} pin={pin} />)}
                {state.ball && <g className="pin-parade-ball" transform={`translate(${state.ball.x} ${state.ball.y})`} aria-hidden="true"><circle className="pin-parade-ball-shadow" cx="2" cy="3" r="14" /><circle className="pin-parade-ball-body" r="11" fill="url(#pin-parade-ball)" /><circle className="pin-parade-ball-hole" cx="-3" cy="-3" r="2" /><circle className="pin-parade-ball-hole" cx="3" cy="-4" r="2" /><circle className="pin-parade-ball-hole" cy="2" r="2" /></g>}
                {!state.ball && state.phase === 'aiming' && <g className="pin-parade-ball" transform="translate(200 652)" aria-hidden="true"><circle className="pin-parade-ball-shadow" cx="2" cy="3" r="14" /><circle className="pin-parade-ball-body" r="11" fill="url(#pin-parade-ball)" /><circle className="pin-parade-ball-hole" cx="-3" cy="-3" r="2" /><circle className="pin-parade-ball-hole" cx="3" cy="-4" r="2" /><circle className="pin-parade-ball-hole" cy="2" r="2" /></g>}
                {state.phase === 'ready' && <text className="pin-parade-lane-message" x="200" y="360" textAnchor="middle">PRESS START TO BOWL</text>}
                {state.phase === 'paused' && <text className="pin-parade-lane-message" x="200" y="360" textAnchor="middle">LANE PAUSED</text>}
                {state.phase === 'complete' && <text className="pin-parade-lane-message" x="200" y="360" textAnchor="middle">GAME COMPLETE</text>}
              </svg>
            </div>

            <p className="pin-parade-status" role="status" aria-live="polite">{state.message}</p>
            <div className="pin-parade-frames" role="group" aria-label="Frame scores">
              {score.frames.map((frame, index) => <div key={index} className={`pin-parade-frame${index === state.frameIndex && state.phase !== 'complete' ? ' is-current' : ''}`} aria-label={`Frame ${index + 1}: ${frame.rolls.length ? formatFrameRolls(frame.rolls, index === 9) : 'not played'}. ${frame.score === null ? 'Score pending.' : `Frame score ${frame.score}.`}`}>
                <span>{index + 1}</span><small>{formatFrameRolls(frame.rolls, index === 9)}</small><strong>{frame.cumulative ?? '—'}</strong>
              </div>)}
            </div>

            <div className="pin-parade-controls" role="group" aria-label="Bowling controls">
              <div className="pin-parade-aim-controls"><button type="button" className="pin-parade-adjust" aria-label="Aim left" disabled={state.phase !== 'aiming'} onClick={() => commit(adjustPinParadeAim(stateRef.current, -1))}>↶</button><span>AIM <strong>{state.aimDegrees.toFixed(0)}°</strong></span><button type="button" className="pin-parade-adjust" aria-label="Aim right" disabled={state.phase !== 'aiming'} onClick={() => commit(adjustPinParadeAim(stateRef.current, 1))}>↷</button></div>
              <label className="pin-parade-slider"><span>POWER</span><input type="range" min="35" max="100" step="1" value={state.power} disabled={state.phase !== 'aiming'} onChange={(event) => commit(setPinParadeControls(stateRef.current, stateRef.current.aimDegrees, Number(event.currentTarget.value), stateRef.current.spin))} /><output>{state.power}%</output></label>
              <label className="pin-parade-slider"><span>SPIN</span><input type="range" min="-100" max="100" step="5" value={state.spin} disabled={state.phase !== 'aiming'} onChange={(event) => commit(setPinParadeControls(stateRef.current, stateRef.current.aimDegrees, stateRef.current.power, Number(event.currentTarget.value)))} /><output>{state.spin < 0 ? 'HOOK L' : state.spin > 0 ? 'HOOK R' : 'STRAIGHT'}</output></label>
            </div>

            <div className="pin-parade-actions">
              {state.phase === 'ready' ? <button className="pin-parade-action pin-parade-action-primary" type="button" onClick={start}>Start game <span aria-hidden="true">▶</span></button>
                : state.phase === 'result' ? <button className="pin-parade-action pin-parade-action-primary" type="button" onClick={() => commit(nextPinParadeRoll(stateRef.current))}>{pinParadeNextRollLabel(state)} <span aria-hidden="true">→</span></button>
                  : state.phase === 'complete' ? <button className="pin-parade-action pin-parade-action-primary" type="button" onClick={start}>Play again <span aria-hidden="true">↻</span></button>
                    : <button className="pin-parade-action pin-parade-action-pause" type="button" onClick={togglePause}>{state.phase === 'paused' ? 'Resume lane' : 'Pause lane'} <kbd>ESC</kbd></button>}
              <button className="pin-parade-action pin-parade-action-bowl" type="button" onClick={bowl} disabled={state.phase !== 'aiming'}>Bowl <kbd>SPACE</kbd></button>
              <button className="pin-parade-action pin-parade-action-restart" type="button" onClick={restart}>Restart</button>
            </div>
            <div className="pin-parade-console-footer"><span>DRAG BALL · ARROWS AIM · Q / E SPIN</span><span>SPACE BOWL · ESC PAUSE · R RESET</span></div>
          </div>
          <p className="pin-parade-footnote">Bonus balls in frame ten follow a strike or spare. The final screen uses standard strike and spare scoring.</p>
          <span className="sr-only" aria-live="polite">{description}</span>
        </div>
      </div>
    </section>
  )
}

function PinGlyph({ pin }: { pin: PinParadePin }) {
  return (
    <g className={`pin-parade-pin${pin.upright ? '' : ' is-fallen'}`} transform={`translate(${pin.x} ${pin.y}) rotate(${pin.upright ? 0 : pin.vx < 0 ? -68 : 68})`} aria-hidden="true">
      <ellipse className="pin-parade-pin-shadow" cx="2" cy="3" rx="9" ry="5" />
      <path className="pin-parade-pin-body" d="M0-10C-5-10-7-6-6-2L-9 5C-10 9-6 11 0 11S10 9 9 5L6-2C7-6 5-10 0-10Z" />
      <path className="pin-parade-pin-stripe" d="M-6 2h12M-7 5h14" />
      <circle className="pin-parade-pin-dot" r="1.3" />
    </g>
  )
}

function formatFrameRolls(rolls: readonly number[], isTenth: boolean): string {
  if (rolls.length === 0) return '· ·'
  return rolls.map((_, index) => formatRoll(rolls, index, isTenth)).join(' ')
}

function formatRoll(rolls: readonly number[], index: number, isTenth: boolean): string {
  const value = rolls[index]!
  if (value === 10) return 'X'
  if (index > 0 && (isTenth ? rolls[index - 1]! < 10 && rolls[index - 1]! + value === 10 : rolls[index - 1]! + value === 10)) return '/'
  if (value === 0) return '–'
  return String(value)
}
