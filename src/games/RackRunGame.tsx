import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  RACK_RUN_BALL_RADIUS,
  RACK_RUN_POCKETS,
  RACK_RUN_WIDTH,
  advanceRackRun,
  adjustRackRunPower,
  callRackRunPocket,
  createRackRunState,
  pauseRackRun,
  rackRunRemainingColors,
  restartRackRun,
  resumeRackRun,
  rotateRackRunAim,
  setRackRunAim,
  shootRackRun,
  startRackRun,
  type RackRunBall,
  type RackRunState,
} from './rackRun'

export function RackRunGame({
  onBack,
  bestShots,
  onRecordShots,
  reduceMotion,
}: {
  onBack: () => void
  bestShots: number | null
  onRecordShots: (shots: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createRackRunState)
  const stateRef = useRef(state)
  const tableRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ pointerId: number } | null>(null)
  const lastRecordedShots = useRef<number | null>(null)
  const lastPocketedIds = useRef<string[]>([])
  const playSound = useArcadeSound()
  const cue = state.balls.find((ball) => ball.id === 'cue')!
  const colorsRemaining = rackRunRemainingColors(state)
  const phaseLabel = state.phase === 'ready' ? 'RACK SET'
    : state.phase === 'aiming' ? 'TABLE LIVE'
      : state.phase === 'rolling' ? 'BALLS MOVING'
        : state.phase === 'paused' ? 'PAUSED'
          : state.phase === 'complete' ? 'RACK CLEARED' : 'RACK LOST'
  const description = state.phase === 'complete'
    ? `Rack cleared in ${state.shots} shots.`
    : state.phase === 'lost'
      ? 'The eight ball ended the rack early or in an uncalled pocket.'
      : `${colorsRemaining} colors remain. ${state.message}`

  function commit(next: RackRunState) {
    stateRef.current = next
    setState(next)
  }

  function focusTable() {
    window.requestAnimationFrame(() => tableRef.current?.focus())
  }

  function start() {
    lastRecordedShots.current = null
    lastPocketedIds.current = []
    commit(startRackRun(stateRef.current))
    focusTable()
  }

  function restart() {
    lastRecordedShots.current = null
    lastPocketedIds.current = []
    dragRef.current = null
    commit(restartRackRun(stateRef.current))
    focusTable()
  }

  function shoot() {
    const next = shootRackRun(stateRef.current)
    if (next === stateRef.current) return
    dragRef.current = null
    commit(next)
    playSound('hit')
  }

  function togglePause() {
    const current = stateRef.current
    commit(current.phase === 'paused' ? resumeRackRun(current) : pauseRackRun(current))
  }

  function setAngle(delta: number) {
    commit(rotateRackRunAim(stateRef.current, delta))
  }

  function pocketPoint(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * RACK_RUN_WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * (RACK_RUN_WIDTH / 2) / bounds.height,
    }
  }

  function aimFromPoint(point: { x: number; y: number }) {
    const current = stateRef.current
    const dx = cue.x - point.x
    const dy = cue.y - point.y
    const distance = Math.hypot(dx, dy)
    if (distance < 4) return current
    return setRackRunAim(current, Math.atan2(dy, dx), Math.max(10, Math.min(100, distance * .65)))
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (stateRef.current.phase !== 'aiming' || cue.pocketed) return
    const point = pocketPoint(event)
    if (Math.hypot(point.x - cue.x, point.y - cue.y) > 54) return
    dragRef.current = { pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    commit(aimFromPoint(pocketPoint(event)))
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    const aimed = aimFromPoint(pocketPoint(event))
    const shot = shootRackRun(aimed)
    if (shot === aimed) commit(aimed)
    else {
      commit(shot)
      playSound('hit')
    }
    dragRef.current = null
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
    if (key === ' ' || key === 'enter') {
      event.preventDefault()
      shoot()
      return
    }
    if (key === 'arrowleft' || key === 'a') { event.preventDefault(); setAngle(-Math.PI / 60); return }
    if (key === 'arrowright' || key === 'd') { event.preventDefault(); setAngle(Math.PI / 60); return }
    if (key === 'arrowup' || key === 'w') { event.preventDefault(); commit(adjustRackRunPower(stateRef.current, 5)); return }
    if (key === 'arrowdown' || key === 's') { event.preventDefault(); commit(adjustRackRunPower(stateRef.current, -5)); return }
    const pocketIndex = Number(event.key) - 1
    if (Number.isInteger(pocketIndex) && RACK_RUN_POCKETS[pocketIndex]) {
      event.preventDefault()
      commit(callRackRunPocket(stateRef.current, RACK_RUN_POCKETS[pocketIndex]!.id))
    }
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
      const next = advanceRackRun(current, elapsed)
      stateRef.current = next
      setState(next)
      if (next.phase === 'rolling') frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [state.phase])

  useEffect(() => {
    if (state.phase !== 'complete' || lastRecordedShots.current === state.shots) return
    lastRecordedShots.current = state.shots
    if (state.fouls === 0) onRecordShots(state.shots)
    playSound('win')
  }, [onRecordShots, playSound, state.fouls, state.phase, state.shots])

  useEffect(() => {
    const pocketed = state.balls.filter((ball) => ball.pocketed).map((ball) => ball.id)
    if (pocketed.some((id) => !lastPocketedIds.current.includes(id))) playSound('score')
    lastPocketedIds.current = pocketed
  }, [playSound, state.balls])

  const angleX = Math.cos(state.angle)
  const angleY = Math.sin(state.angle)
  return (
    <section className={`snake-view rack-run-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="rack-run-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout rack-run-layout">
        <div className="snake-copy rack-run-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="rack-run-title">Rack Run<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Read the angle. Call the pocket. Clear the rack.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Sink the three colored balls first, then call a pocket and sink the eight. A called-pocket foul or cue scratch costs a foul. Pocketing the eight early or in the wrong pocket ends the rack.</p>
            <p>Pull back from the cue ball and release, or set your angle and power below. Call a pocket with <strong>1–6</strong>, <strong>Escape</strong> pauses, and <strong>R</strong> resets the rack.</p>
          </div>
          <div className="score-card rack-run-score" aria-label={`${colorsRemaining} colors remain. ${state.shots} shots. ${state.fouls} fouls. ${bestShots === null ? 'No local best yet.' : `Local best ${bestShots} shots.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">SHOTS</span>
              <strong className="score-value">{String(state.shots).padStart(2, '0')}</strong>
              <span className="score-unit">{colorsRemaining} color{colorsRemaining === 1 ? '' : 's'} left</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong>{bestShots === null ? '—' : String(bestShots).padStart(2, '0')}</strong>
              <span className="score-unit">shots · {state.fouls} fouls</span>
            </div>
          </div>
          <p className="rack-run-local-note">Your fewest shots for a clean rack stays in this browser and does not sync.</p>
        </div>

        <div className="play-column rack-run-play-column">
          <div className={`rack-run-console phase-${state.phase}`}>
            <div className="frame-topline"><span>TABLE 42</span><span className="frame-light"><i /> {phaseLabel}</span></div>
            <div className="rack-run-roundline">
              <div><span>CALL POCKET · CLEAR COLORS · FINISH ON 8</span><strong>{state.calledPocket ? `${RACK_RUN_POCKETS.find((pocket) => pocket.id === state.calledPocket)!.shortLabel} CALLED` : 'NO POCKET CALLED'}</strong></div>
              <b>{String(state.shots).padStart(2, '0')}<small> SHOTS</small></b>
            </div>

            <div className="rack-run-table-frame">
              <svg
                ref={tableRef}
                className="rack-run-table"
                viewBox={`0 0 ${RACK_RUN_WIDTH} ${RACK_RUN_WIDTH / 2}`}
                role="img"
                tabIndex={0}
                aria-label={`Pool table. ${colorsRemaining} colors remain. Drag back from the cue ball and release to shoot. Arrow keys adjust aim and power; keys 1 to 6 call a pocket.`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => { dragRef.current = null }}
              >
                <defs>
                  <linearGradient id="rack-run-cloth" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1d5c4d" /><stop offset=".5" stopColor="#15463f" /><stop offset="1" stopColor="#103a38" /></linearGradient>
                  <linearGradient id="rack-run-rail" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#916442" /><stop offset=".5" stopColor="#65452f" /><stop offset="1" stopColor="#3b2e28" /></linearGradient>
                  <radialGradient id="rack-run-cue"><stop stopColor="#fffef1" /><stop offset=".78" stopColor="#dedbd0" /><stop offset="1" stopColor="#89867e" /></radialGradient>
                  <radialGradient id="rack-run-one"><stop stopColor="#ffb38b" /><stop offset=".78" stopColor="#e5794f" /><stop offset="1" stopColor="#9a432f" /></radialGradient>
                  <radialGradient id="rack-run-two"><stop stopColor="#fff0a0" /><stop offset=".78" stopColor="#e8c54c" /><stop offset="1" stopColor="#99802e" /></radialGradient>
                  <radialGradient id="rack-run-three"><stop stopColor="#d1b8ff" /><stop offset=".78" stopColor="#946ed1" /><stop offset="1" stopColor="#584182" /></radialGradient>
                  <radialGradient id="rack-run-eight"><stop stopColor="#777a94" /><stop offset=".78" stopColor="#282b3a" /><stop offset="1" stopColor="#11131d" /></radialGradient>
                </defs>
                <rect className="rack-run-rail" x="6" y="6" width="708" height="348" rx="32" />
                <rect className="rack-run-cushion" x="25" y="25" width="670" height="310" rx="22" />
                <rect className="rack-run-cloth" x="38" y="38" width="644" height="284" rx="14" fill="url(#rack-run-cloth)" />
                <path className="rack-run-felt-mark" d="M57 55H663M57 305H663" />
                <line className="rack-run-head-string" x1="225" y1="40" x2="225" y2="320" />
                {RACK_RUN_POCKETS.map((pocket) => <g key={pocket.id} className={`rack-run-pocket${state.calledPocket === pocket.id ? ' is-called' : ''}`}><circle cx={pocket.x} cy={pocket.y} r="23" /><circle cx={pocket.x} cy={pocket.y} r="15" /></g>)}
                {state.phase === 'aiming' && !cue.pocketed && <g className="rack-run-aim-guide" aria-hidden="true">
                  <line x1={cue.x} y1={cue.y} x2={cue.x + angleX * 235} y2={cue.y + angleY * 235} />
                  <line className="rack-run-cue-stick" x1={cue.x - angleX * 38} y1={cue.y - angleY * 38} x2={cue.x - angleX * (52 + state.power * .34)} y2={cue.y - angleY * (52 + state.power * .34)} />
                </g>}
                {state.balls.map((ball) => !ball.pocketed && <PoolBall key={ball.id} ball={ball} />)}
                {state.phase === 'ready' && <text className="rack-run-table-message" x="360" y="185" textAnchor="middle">PRESS START TO BREAK</text>}
                {state.phase === 'paused' && <text className="rack-run-table-message" x="360" y="185" textAnchor="middle">TABLE PAUSED</text>}
              </svg>
            </div>

            <p className="rack-run-status" role="status" aria-live="polite">{state.message}</p>
            <div className="rack-run-called-pockets" role="group" aria-label="Call a pocket">
              {RACK_RUN_POCKETS.map((pocket, index) => <button key={pocket.id} type="button" className={`rack-run-pocket-button${state.calledPocket === pocket.id ? ' is-called' : ''}`} aria-label={`Call ${pocket.label.toLowerCase()}`} aria-pressed={state.calledPocket === pocket.id} disabled={state.phase !== 'aiming'} onClick={() => commit(callRackRunPocket(stateRef.current, pocket.id))}>
                <kbd>{index + 1}</kbd><span>{pocket.shortLabel}</span>
              </button>)}
            </div>

            <div className="rack-run-shot-controls" role="group" aria-label="Aim and shot power">
              <div className="rack-run-aim-controls">
                <button type="button" className="rack-run-adjust" aria-label="Aim left" disabled={state.phase !== 'aiming'} onClick={() => setAngle(-Math.PI / 60)}>↶</button>
                <span>AIM</span>
                <button type="button" className="rack-run-adjust" aria-label="Aim right" disabled={state.phase !== 'aiming'} onClick={() => setAngle(Math.PI / 60)}>↷</button>
              </div>
              <label className="rack-run-power-control"><span>SHOT POWER</span><input type="range" min="10" max="100" step="5" value={state.power} disabled={state.phase !== 'aiming'} onChange={(event) => commit(setRackRunAim(stateRef.current, stateRef.current.angle, Number(event.currentTarget.value)))} /><output>{state.power}%</output></label>
            </div>

            <div className="rack-run-actions">
              {state.phase === 'ready' ? <button className="rack-run-action rack-run-action-primary" type="button" onClick={start}>Start rack <span aria-hidden="true">▶</span></button>
                : state.phase === 'complete' || state.phase === 'lost' ? <button className="rack-run-action rack-run-action-primary" type="button" onClick={start}>Play again <span aria-hidden="true">↻</span></button>
                  : <button className="rack-run-action rack-run-action-pause" type="button" onClick={togglePause} disabled={state.phase === 'paused' && state.resumePhase === null}>{state.phase === 'paused' ? 'Resume table' : 'Pause table'} <kbd>ESC</kbd></button>}
              <button className="rack-run-action rack-run-action-shoot" type="button" onClick={shoot} disabled={state.phase !== 'aiming' || state.calledPocket === null}>Shoot <kbd>SPACE</kbd></button>
              <button className="rack-run-action rack-run-action-restart" type="button" onClick={restart}>Restart</button>
            </div>
            <div className="rack-run-console-footer"><span>DRAG CUE · ARROWS / A-D AIM</span><span>1–6 CALL · SPACE SHOOT · R RESET</span></div>
          </div>
          <p className="rack-run-footnote">Pull back from the cue ball to set direction and strength. Pocket calls are one-shot inputs; no key holding is needed.</p>
          <span className="sr-only" aria-live="polite">{description}</span>
        </div>
      </div>
    </section>
  )
}

function PoolBall({ ball }: { ball: RackRunBall }) {
  const fill = ball.id === 'cue' ? 'url(#rack-run-cue)'
    : ball.id === 'one' ? 'url(#rack-run-one)'
      : ball.id === 'two' ? 'url(#rack-run-two)'
        : ball.id === 'three' ? 'url(#rack-run-three)' : 'url(#rack-run-eight)'
  return (
    <g className={`rack-run-ball rack-run-ball-${ball.id}`} transform={`translate(${ball.x} ${ball.y})`} aria-hidden="true">
      <circle className="rack-run-ball-shadow" cx="1.5" cy="2" r={RACK_RUN_BALL_RADIUS} />
      <circle className="rack-run-ball-body" r={RACK_RUN_BALL_RADIUS} fill={fill} />
      <ellipse className="rack-run-ball-glint" cx="-3" cy="-4" rx="3.2" ry="1.8" />
      {ball.number !== null && <><circle className="rack-run-ball-number-disc" r="5.8" /><text className="rack-run-ball-number" y="2.2" textAnchor="middle">{ball.number}</text></>}
    </g>
  )
}
