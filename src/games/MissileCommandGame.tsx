import { useEffect, useReducer, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { missileCommandReducer, createMissileCommandState, MISSILE_CITY_X, MISSILE_CITY_Y, MISSILE_COMMAND_HEIGHT, MISSILE_COMMAND_WIDTH, MISSILE_SILO_X, MISSILE_SILO_Y } from './missileCommand'

interface MissileCommandGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
}

const aimKeys: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -26, dy: 0 },
  a: { dx: -26, dy: 0 },
  ArrowRight: { dx: 26, dy: 0 },
  d: { dx: 26, dy: 0 },
  ArrowUp: { dx: 0, dy: -26 },
  w: { dx: 0, dy: -26 },
  ArrowDown: { dx: 0, dy: 26 },
  s: { dx: 0, dy: 26 },
}

export function MissileCommandGame({ onBack, bestScore, onRecordScore }: MissileCommandGameProps) {
  const [state, dispatch] = useReducer(missileCommandReducer, undefined, createMissileCommandState)
  const boardRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const previousAudioState = useRef({ score: state.score, wave: state.wave, phase: state.phase })
  const isFresh = state.score === 0 && state.wave === 1 && state.cities.every(Boolean)
  const statusLabel = state.phase === 'playing' ? 'LIVE' : state.phase.toUpperCase()

  useEffect(() => {
    if (state.phase !== 'playing') return
    let frame = 0
    const tick = () => {
      dispatch({ type: 'tick' })
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [state.phase])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) dispatch({ type: 'pause' })
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  useEffect(() => {
    if (state.score > 0) onRecordScore(state.score)
  }, [onRecordScore, state.score])

  useEffect(() => {
    const previous = previousAudioState.current
    if (state.phase === 'over' && previous.phase !== 'over') playSound('lose')
    else if (state.wave > previous.wave) playSound('wave')
    else if (state.score > previous.score) playSound('hit')
    previousAudioState.current = { score: state.score, wave: state.wave, phase: state.phase }
  }, [playSound, state.phase, state.score, state.wave])

  const focusBoard = () => window.requestAnimationFrame(() => boardRef.current?.focus())
  const start = () => {
    dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusBoard()
  }
  const restart = () => {
    dispatch({ type: 'restart' })
    focusBoard()
  }
  const playAgain = () => {
    dispatch({ type: 'restart' })
    dispatch({ type: 'start' })
    focusBoard()
  }
  const fire = () => {
    if (state.phase === 'ready') dispatch({ type: 'start' })
    if (state.phase === 'playing' || state.phase === 'ready') {
      if (state.ammo.some((ammo) => ammo > 0) && state.defense.length < 3) playSound('fire')
      dispatch({ type: 'fire' })
      focusBoard()
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = aimKeys[event.key] ?? aimKeys[event.key.toLowerCase()]
    if (move) {
      event.preventDefault()
      dispatch({ type: 'moveAim', ...move })
    } else if (event.code === 'Space') {
      event.preventDefault()
      fire()
    } else if (event.key === 'Escape' && state.phase === 'playing') {
      event.preventDefault()
      dispatch({ type: 'pause' })
    } else if (event.key === 'Escape' && state.phase === 'paused') {
      event.preventDefault()
      dispatch({ type: 'resume' })
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      restart()
    }
  }

  const pointerPosition = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return null
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * MISSILE_COMMAND_WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * MISSILE_COMMAND_HEIGHT,
    }
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (state.phase !== 'playing') return
    const aim = pointerPosition(event)
    if (aim) dispatch({ type: 'aim', ...aim })
  }
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    const aim = pointerPosition(event)
    if (!aim) return
    dispatch({ type: 'aim', ...aim })
    if (state.phase === 'ready') {
      dispatch({ type: 'start' })
      if (state.ammo.some((ammo) => ammo > 0)) playSound('fire')
      dispatch({ type: 'fire' })
      focusBoard()
    } else if (state.phase === 'playing') {
      if (state.ammo.some((ammo) => ammo > 0) && state.defense.length < 3) playSound('fire')
      dispatch({ type: 'fire' })
      focusBoard()
    }
  }

  return (
    <section className="snake-view missile-view" aria-labelledby="missile-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout missile-layout">
        <div className="snake-copy missile-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="missile-title">Missile Command<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Keep the skyline lit. Put an interceptor where the enemy missiles will be.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Click or tap a spot above the cities to launch. Use the arrow keys or WASD to aim, then press Space. Each silo has limited ammo; one blast can clear a cluster.</p>
          </div>
          <div className="score-card missile-score" aria-label={`Score: ${state.score}. ${state.cities.filter(Boolean).length} cities remain. Wave ${state.wave}. ${bestScore === null ? 'No personal best yet.' : `Local best: ${bestScore} points.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">THIS RUN</span>
              <strong className="score-value">{String(state.score).padStart(3, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
            <div className="breakout-stats"><span><strong>{state.cities.filter(Boolean).length}</strong> cities</span><span><strong>{state.wave}</strong> wave</span></div>
            <div className="missile-silo-readout"><span className="score-caption">SILO AMMO</span>{state.ammo.map((ammo, index) => <span key={index}><strong>{ammo}</strong> {['West', 'Central', 'East'][index]}</span>)}</div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong className="score-value">{bestScore === null ? '—' : String(bestScore).padStart(3, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
          </div>
          <div className="game-actions">
            {state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => dispatch({ type: 'pause' })}>Pause <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume <span aria-hidden="true">→</span></button>
            ) : state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>{isFresh ? 'Start game' : 'Continue'} <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={playAgain}>Play again</button>
            )}
            {(!isFresh || state.phase === 'playing' || state.phase === 'paused') && state.phase !== 'over' && (
              <button className="button button-quiet" type="button" onClick={restart}>Restart</button>
            )}
          </div>
          <p className="keyboard-hint">Arrows / WASD to aim · Space to fire · Esc to pause · R to restart</p>
        </div>

        <div className="play-column missile-play-column">
          <div className="missile-console">
            <div className="frame-topline">
              <span>FIELD 08</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {statusLabel}</span>
            </div>
            <div
              ref={boardRef}
              className={`missile-field phase-${state.phase}`}
              role="group"
              aria-label="Missile Command playfield"
              aria-describedby="missile-instructions"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerDown}
            >
              {state.incoming.map((missile) => <span key={missile.id} className="incoming-missile" aria-hidden="true" style={{ left: `${(missile.x / MISSILE_COMMAND_WIDTH) * 100}%`, top: `${(missile.y / MISSILE_COMMAND_HEIGHT) * 100}%`, transform: `translate(-50%, -50%) rotate(${Math.atan2(missile.vy, missile.vx)}rad)` }} />)}
              {state.defense.map((missile) => <span key={missile.id} className="defense-missile" aria-hidden="true" style={{ left: `${(missile.x / MISSILE_COMMAND_WIDTH) * 100}%`, top: `${(missile.y / MISSILE_COMMAND_HEIGHT) * 100}%`, transform: `translate(-50%, -50%) rotate(${Math.atan2(missile.vy, missile.vx)}rad)` }} />)}
              {state.blasts.map((blast) => <span key={blast.id} className="missile-blast" aria-hidden="true" style={{ left: `${(blast.x / MISSILE_COMMAND_WIDTH) * 100}%`, top: `${(blast.y / MISSILE_COMMAND_HEIGHT) * 100}%`, width: `${(blast.radius * 2 / MISSILE_COMMAND_WIDTH) * 100}%`, height: `${(blast.radius * 2 / MISSILE_COMMAND_HEIGHT) * 100}%` }} />)}
              {MISSILE_CITY_X.map((x, index) => <span key={`city-${index}`} className={`missile-city city-tone-${index % 3}${state.cities[index] ? '' : ' city-lost'}`} aria-hidden="true" style={{ left: `${(x / MISSILE_COMMAND_WIDTH) * 100}%`, top: `${(MISSILE_CITY_Y / MISSILE_COMMAND_HEIGHT) * 100}%` }} />)}
              {MISSILE_SILO_X.map((x, index) => <span key={`silo-${index}`} className={`missile-silo${state.ammo[index] === 0 ? ' silo-empty' : ''}`} aria-hidden="true" style={{ left: `${(x / MISSILE_COMMAND_WIDTH) * 100}%`, top: `${(MISSILE_SILO_Y / MISSILE_COMMAND_HEIGHT) * 100}%` }}><i />{state.ammo[index]}</span>)}
              <span className="missile-aim" aria-hidden="true" style={{ left: `${(state.aim.x / MISSILE_COMMAND_WIDTH) * 100}%`, top: `${(state.aim.y / MISSILE_COMMAND_HEIGHT) * 100}%` }} />
              {state.phase !== 'playing' && (
                <div className="missile-overlay" aria-hidden="true">
                  <strong>{state.phase === 'ready' ? 'Defend the cities' : state.phase === 'paused' ? 'Paused' : 'Skyline lost'}</strong>
                  <span>{state.phase === 'ready' ? 'Aim high. One well placed blast can stop several missiles.' : state.phase === 'paused' ? 'Take a breath, then return to the defense.' : `Final score · ${state.score} points`}</span>
                </div>
              )}
            </div>
            <div className="missile-console-footer"><span>AIM · SPACE / TAP TO FIRE</span><span>{state.cities.filter(Boolean).length} CITIES · WAVE {state.wave}</span></div>
          </div>
          <div className="missile-touch-controls" role="group" aria-label="Aim controls">
            <button className="dpad-button" type="button" aria-label="Aim left" disabled={state.phase !== 'playing'} onClick={() => dispatch({ type: 'moveAim', dx: -34, dy: 0 })}>←</button>
            <button className="dpad-button" type="button" aria-label="Aim up" disabled={state.phase !== 'playing'} onClick={() => dispatch({ type: 'moveAim', dx: 0, dy: -34 })}>↑</button>
            <button className="dpad-button" type="button" aria-label="Aim down" disabled={state.phase !== 'playing'} onClick={() => dispatch({ type: 'moveAim', dx: 0, dy: 34 })}>↓</button>
            <button className="dpad-button" type="button" aria-label="Aim right" disabled={state.phase !== 'playing'} onClick={() => dispatch({ type: 'moveAim', dx: 34, dy: 0 })}>→</button>
            <button className="button button-primary missile-fire-button" type="button" disabled={state.phase !== 'playing' && state.phase !== 'ready'} onClick={fire}>Fire at target</button>
          </div>
          <p id="missile-instructions" className="missile-status" role="status" aria-live="polite">{state.message}</p>
        </div>
      </div>
    </section>
  )
}
