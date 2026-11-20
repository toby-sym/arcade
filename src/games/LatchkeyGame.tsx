import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  advanceLatchkeyTime,
  createLatchkeyState,
  formatLatchkeyTime,
  isLatchkeyGrounded,
  LATCHKEY_HEIGHT,
  LATCHKEY_ROOMS,
  LATCHKEY_WIDTH,
  latchkeyRoomCell,
  moveLatchkey,
  pauseLatchkey,
  restartLatchkey,
  resumeLatchkey,
  startLatchkey,
  type LatchkeyAction,
} from './latchkey'

export function LatchkeyGame({
  onBack,
  bestSeconds,
  onRecordTime,
  reduceMotion,
}: {
  onBack: () => void
  bestSeconds: number | null
  onRecordTime: (seconds: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createLatchkeyState)
  const boardRef = useRef<HTMLDivElement>(null)
  const recordedRun = useRef(false)
  const playSound = useArcadeSound()
  const room = LATCHKEY_ROOMS[state.roomIndex]!
  const phaseLabel = state.phase === 'ready' ? 'ROUTE READY'
    : state.phase === 'playing' ? 'ROOM LIVE'
      : state.phase === 'paused' ? 'PAUSED' : 'ROUTE CLEAR'

  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => setState((current) => advanceLatchkeyTime(current)), 1000)
    return () => window.clearInterval(timer)
  }, [state.phase])

  useEffect(() => {
    if (state.phase !== 'complete' || recordedRun.current) return
    recordedRun.current = true
    onRecordTime(Math.max(1, state.elapsedSeconds))
    playSound('win')
  }, [onRecordTime, playSound, state.elapsedSeconds, state.phase])

  function focusBoard() {
    window.requestAnimationFrame(() => boardRef.current?.focus())
  }

  function start() {
    recordedRun.current = false
    setState((current) => startLatchkey(current))
    focusBoard()
  }

  function restart() {
    recordedRun.current = false
    setState((current) => restartLatchkey(current))
    focusBoard()
  }

  function togglePause() {
    setState((current) => current.phase === 'paused' ? resumeLatchkey(current) : pauseLatchkey(current))
    focusBoard()
  }

  function move(action: LatchkeyAction) {
    const next = moveLatchkey(state, action)
    if (next !== state) {
      setState(next)
      if (next.roomIndex !== state.roomIndex || next.phase === 'complete') playSound('score')
      else if (next.x !== state.x || next.y !== state.y || next.hasKey !== state.hasKey) playSound('hit')
    }
  }

  function moveFromControl(action: LatchkeyAction) {
    move(action)
    focusBoard()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('button, input, select, textarea')) return
    if (event.repeat) return
    if (event.key === 'Escape' && (state.phase === 'playing' || state.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'enter' && state.phase === 'ready') {
      event.preventDefault()
      start()
      return
    }
    if (key === 'r') {
      event.preventDefault()
      restart()
      return
    }
    if (state.phase !== 'playing') return
    const action: LatchkeyAction | null = key === 'arrowleft' || key === 'a' ? 'left'
      : key === 'arrowright' || key === 'd' ? 'right'
        : key === 'arrowup' || key === 'w' || key === ' ' ? 'jump' : null
    if (action) {
      event.preventDefault()
      move(action)
    }
  }

  const boardLabel = `${room.title}, room ${state.roomIndex + 1} of ${LATCHKEY_ROOMS.length}. ${state.hasKey ? 'Key collected.' : 'Key still in the room.'} ${isLatchkeyGrounded(state) ? 'Standing on a ledge.' : 'In the air.'}`

  return (
    <section className={`snake-view latchkey-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="latchkey-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout latchkey-layout">
        <div className="snake-copy latchkey-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="latchkey-title">Latchkey<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">A little route through three rooms. Find each key and make the jump count.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Step left or right one tile at a time. A jump is one deliberate pulse: it travels three tiles forward and clears a short gap. Collect the key, then reach the lit exit.</p>
            <p>Use <strong>← / →</strong> or <strong>A / D</strong> to step, and <strong>↑</strong>, <strong>W</strong>, or <strong>Space</strong> to jump. Tap the direction controls on a phone. <strong>Escape</strong> pauses and <strong>R</strong> restarts.</p>
          </div>
          <div className="score-card latchkey-score" aria-label={`Route time ${formatLatchkeyTime(state.elapsedSeconds)}. Room ${state.roomIndex + 1} of ${LATCHKEY_ROOMS.length}. ${bestSeconds === null ? 'No local fastest route yet.' : `Local fastest route ${formatLatchkeyTime(bestSeconds)}.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">ROUTE TIME</span>
              <strong className="score-value">{formatLatchkeyTime(state.elapsedSeconds)}</strong>
              <span className="score-unit">room {String(state.roomIndex + 1).padStart(2, '0')} / {String(LATCHKEY_ROOMS.length).padStart(2, '0')}</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">FASTEST IN THIS BROWSER</span>
              <strong>{bestSeconds === null ? '—' : formatLatchkeyTime(bestSeconds)}</strong>
              <span className="score-unit">three-room route</span>
            </div>
          </div>
          <p className="latchkey-local-note">Your fastest route stays in this browser and does not sync.</p>
        </div>

        <div className="play-column latchkey-play-column">
          <div className={`latchkey-console phase-${state.phase}`}>
            <div className="frame-topline"><span>FIELD 45</span><span className="frame-light"><i /> {phaseLabel}</span></div>
            <div className="latchkey-roomline">
              <div><span>ROOM {String(state.roomIndex + 1).padStart(2, '0')} / 03</span><strong>{room.title}</strong></div>
              <span className={`latchkey-key-readout${state.hasKey ? ' is-held' : ''}`} aria-label={state.hasKey ? 'Key collected' : 'Key not collected'}>{state.hasKey ? 'KEY HELD' : 'KEY NEEDED'}</span>
            </div>
            <div className="latchkey-progress" aria-label={`${state.roomIndex + (state.phase === 'complete' ? 1 : 0)} of ${LATCHKEY_ROOMS.length} rooms cleared`}>
              {LATCHKEY_ROOMS.map((item, index) => <span key={item.title} className={index < state.roomIndex || state.phase === 'complete' ? 'is-clear' : index === state.roomIndex ? 'is-current' : ''} />)}
            </div>
            <div className="latchkey-board-wrap">
              <div className="latchkey-skyline" aria-hidden="true"><i /><i /><i /><i /><i /></div>
              <div
                className="latchkey-board"
                ref={boardRef}
                role="group"
                tabIndex={0}
                aria-label={boardLabel}
              >
                {Array.from({ length: LATCHKEY_WIDTH * LATCHKEY_HEIGHT }, (_, index) => {
                  const x = index % LATCHKEY_WIDTH
                  const y = Math.floor(index / LATCHKEY_WIDTH)
                  const cell = latchkeyRoomCell(room, x, y)
                  const isPlayer = state.x === x && state.y === y
                  const isKey = room.key.x === x && room.key.y === y && !state.hasKey
                  const isExit = room.exit.x === x && room.exit.y === y
                  return (
                    <span
                      key={`${x}-${y}`}
                      className={`latchkey-cell${cell === '#' ? ' is-platform' : ''}${isExit ? ` is-exit${state.hasKey ? ' is-open' : ''}` : ''}`}
                      style={{ gridColumn: x + 1, gridRow: y + 1 }}
                      aria-hidden="true"
                    >
                      {isKey && <i className="latchkey-key-glyph">✦</i>}
                      {isExit && <i className="latchkey-exit-glyph">{state.hasKey ? '↗' : '⌑'}</i>}
                      {isPlayer && <i className={`latchkey-runner${state.phase === 'complete' ? ' is-celebrating' : ''}`}>◆</i>}
                    </span>
                  )
                })}
              </div>
              {state.phase !== 'playing' && (
                <div className="latchkey-overlay">
                  <div>
                    <span>{state.phase === 'ready' ? 'THREE ROOMS' : state.phase === 'paused' ? 'ROUTE PAUSED' : 'ALL DOORS OPEN'}</span>
                    <strong>{state.phase === 'ready' ? 'Find the key.' : state.phase === 'paused' ? 'Take your time.' : 'Clean getaway.'}</strong>
                    <p>{state.phase === 'ready' ? 'One tap moves one step. Jump once to clear a gap.' : state.phase === 'paused' ? 'Resume when you are ready.' : `Route cleared in ${formatLatchkeyTime(state.elapsedSeconds)}.`}</p>
                  </div>
                </div>
              )}
            </div>
            <p className="latchkey-status" role="status" aria-live="polite">{state.message}</p>
            <div className="latchkey-touch-controls" aria-label="Movement controls">
              <button className="latchkey-control" type="button" aria-label="Step left" disabled={state.phase !== 'playing'} onClick={() => moveFromControl('left')}>←</button>
              <button className="latchkey-control latchkey-jump" type="button" aria-label="Jump" disabled={state.phase !== 'playing' || !isLatchkeyGrounded(state)} onClick={() => moveFromControl('jump')}>JUMP</button>
              <button className="latchkey-control" type="button" aria-label="Step right" disabled={state.phase !== 'playing'} onClick={() => moveFromControl('right')}>→</button>
            </div>
            <div className="latchkey-actions">
              {state.phase === 'ready' ? <button className="latchkey-action latchkey-action-primary" type="button" onClick={start}>Start route <kbd>ENTER</kbd></button>
                : state.phase === 'complete' ? <button className="latchkey-action latchkey-action-primary" type="button" onClick={restart}>Run it again <kbd>R</kbd></button>
                  : <button className="latchkey-action latchkey-action-pause" type="button" onClick={togglePause}>{state.phase === 'paused' ? 'Resume route' : 'Pause'} <kbd>ESC</kbd></button>}
              {state.phase !== 'ready' && <button className="latchkey-action" type="button" onClick={restart}>Restart <kbd>R</kbd></button>}
            </div>
            <div className="latchkey-console-footer"><span>{room.hint}</span><span>{state.phase === 'complete' ? 'ROUTE COMPLETE' : `${state.hasKey ? 'KEY SECURED' : 'FIND THE KEY'}`}</span></div>
          </div>
          <p className="latchkey-footnote">Every step is a single press. The route is the same each time; beat your local time with a cleaner run.</p>
        </div>
      </div>
    </section>
  )
}
