import { useEffect, useReducer, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { asteroidsReducer, createAsteroidsState, type AsteroidsControl } from './asteroids'

interface AsteroidsGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
}

const controlKeys: Record<string, AsteroidsControl> = {
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  ArrowUp: 'thrust',
  w: 'thrust',
  ' ': 'fire',
}

const controlForKey = (key: string) => controlKeys[key] ?? controlKeys[key.toLowerCase()]

export function AsteroidsGame({ onBack, bestScore, onRecordScore }: AsteroidsGameProps) {
  const [state, dispatch] = useReducer(asteroidsReducer, undefined, createAsteroidsState)
  const boardRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const previousAudioState = useRef({ score: state.score, lives: state.lives, wave: state.wave, phase: state.phase, shots: state.shots.length })

  useEffect(() => {
    if (state.phase !== 'playing') return
    let frame = 0
    let previousTime = 0
    const tick = (time: number) => {
      if (previousTime !== 0) dispatch({ type: 'tick', deltaMs: time - previousTime })
      previousTime = time
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [state.phase])

  useEffect(() => {
    const releaseControls = () => {
      for (const control of ['left', 'right', 'thrust', 'fire'] as const) dispatch({ type: 'control', control, pressed: false })
    }
    const pauseWhenHidden = () => {
      if (document.hidden) {
        dispatch({ type: 'pause' })
        releaseControls()
      }
    }
    window.addEventListener('blur', releaseControls)
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => {
      window.removeEventListener('blur', releaseControls)
      document.removeEventListener('visibilitychange', pauseWhenHidden)
    }
  }, [])

  useEffect(() => {
    if (state.score > 0) onRecordScore(state.score)
  }, [onRecordScore, state.score])

  useEffect(() => {
    const previous = previousAudioState.current
    if (state.phase === 'over' && previous.phase !== 'over') playSound('lose')
    else if (state.wave > previous.wave) playSound('wave')
    else if (state.score > previous.score) playSound('hit')
    else if (state.lives < previous.lives) playSound('miss')
    else if (state.shots.length > previous.shots && state.phase === 'playing') playSound('fire')
    previousAudioState.current = { score: state.score, lives: state.lives, wave: state.wave, phase: state.phase, shots: state.shots.length }
  }, [playSound, state.lives, state.phase, state.score, state.shots.length, state.wave])

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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.code === 'Space') {
      event.preventDefault()
      if (state.phase === 'ready') dispatch({ type: 'start' })
      dispatch({ type: 'control', control: 'fire', pressed: true })
      return
    }
    const control = controlForKey(event.key)
    if (control) {
      event.preventDefault()
      dispatch({ type: 'control', control, pressed: true })
      return
    }
    if (event.key === 'Escape' && state.phase === 'playing') {
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

  useEffect(() => {
    const releaseKey = (event: globalThis.KeyboardEvent) => {
      const control = event.code === 'Space' ? 'fire' : controlForKey(event.key)
      if (control) dispatch({ type: 'control', control, pressed: false })
    }
    window.addEventListener('keyup', releaseKey)
    return () => window.removeEventListener('keyup', releaseKey)
  }, [])

  const holdControl = (control: AsteroidsControl) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    dispatch({ type: 'control', control, pressed: true })
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Pointer capture is optional. */ }
    }
    focusBoard()
  }
  const releaseControl = (control: AsteroidsControl) => () => dispatch({ type: 'control', control, pressed: false })
  const controlsDisabled = state.phase !== 'playing'
  const statusLabel = state.phase === 'playing' ? 'LIVE' : state.phase.toUpperCase()
  const isFresh = state.score === 0 && state.wave === 1 && state.lives === 3

  return (
    <section className="snake-view asteroids-view" aria-labelledby="asteroids-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout asteroids-layout">
        <div className="snake-copy asteroids-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="asteroids-title">Asteroids<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Keep your nose pointed into the chaos. The field is a loop, so keep moving.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Rotate with the left and right arrows or A and D. Hold up or W to thrust, then hold Space or Fire to shoot. On a phone, hold the cabinet buttons.</p>
          </div>
          <div className="score-card asteroids-score" aria-label={`Score: ${state.score}. ${state.lives} ships remaining. Wave ${state.wave}. ${bestScore === null ? 'No personal best yet.' : `Local best: ${bestScore} points.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">THIS RUN</span>
              <strong className="score-value">{String(state.score).padStart(3, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
            <div className="breakout-stats"><span><strong>{state.lives}</strong> {state.lives === 1 ? 'ship' : 'ships'}</span><span><strong>{state.wave}</strong> wave</span></div>
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
          <p className="keyboard-hint">Arrows / A D to rotate · Up / W to thrust · Space to fire · Esc to pause · R to restart</p>
        </div>

        <div className="play-column asteroids-play-column">
          <div className="asteroids-console">
            <div className="frame-topline">
              <span>FIELD 07</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {statusLabel}</span>
            </div>
            <div
              ref={boardRef}
              className={`asteroids-field phase-${state.phase}`}
              tabIndex={0}
              role="group"
              aria-label="Asteroids playfield"
              aria-describedby="asteroids-instructions"
              onKeyDown={handleKeyDown}
            >
              {state.rocks.map((rock) => <span key={rock.id} className={`asteroid-rock asteroid-${rock.size}`} aria-hidden="true" style={{ left: `${(rock.x / 600) * 100}%`, top: `${(rock.y / 600) * 100}%`, transform: `translate(-50%, -50%) rotate(${rock.rotation}deg)` }} />)}
              {state.shots.map((shot, index) => <span key={`shot-${index}`} className="asteroids-shot" aria-hidden="true" style={{ left: `${(shot.x / 600) * 100}%`, top: `${(shot.y / 600) * 100}%` }} />)}
              <span className={`asteroids-ship${state.ship.invulnerable > 0 ? ' ship-blinking' : ''}`} aria-hidden="true" style={{ left: `${(state.ship.x / 600) * 100}%`, top: `${(state.ship.y / 600) * 100}%`, transform: `translate(-50%, -50%) rotate(${state.ship.angle}rad)` }} />
              {state.phase !== 'playing' && (
                <div className="asteroids-overlay" aria-hidden="true">
                  <strong>{state.phase === 'ready' ? 'Ready for liftoff?' : state.phase === 'paused' ? 'Paused' : 'Ship lost'}</strong>
                  <span>{state.phase === 'ready' ? 'Break up the rocks and keep your ship intact.' : state.phase === 'paused' ? 'Take a breath, then head back out.' : `Final score · ${state.score} points`}</span>
                </div>
              )}
            </div>
            <div className="asteroids-console-footer"><span>ARROWS / A D · UP / W · SPACE</span><span>{state.lives} SHIPS · WAVE {state.wave}</span></div>
          </div>
          <div className="asteroids-touch-controls" role="group" aria-label="Touch controls">
            <button className="dpad-button" type="button" aria-label="Rotate left" disabled={controlsDisabled} onPointerDown={holdControl('left')} onPointerUp={releaseControl('left')} onPointerCancel={releaseControl('left')}>↶</button>
            <button className="button button-secondary asteroids-thrust-button" type="button" disabled={controlsDisabled} onPointerDown={holdControl('thrust')} onPointerUp={releaseControl('thrust')} onPointerCancel={releaseControl('thrust')}>Thrust</button>
            <button className="dpad-button" type="button" aria-label="Rotate right" disabled={controlsDisabled} onPointerDown={holdControl('right')} onPointerUp={releaseControl('right')} onPointerCancel={releaseControl('right')}>↷</button>
            <button className="button button-primary asteroids-fire-button" type="button" disabled={controlsDisabled} onPointerDown={holdControl('fire')} onPointerUp={releaseControl('fire')} onPointerCancel={releaseControl('fire')}>Fire</button>
          </div>
          <p id="asteroids-instructions" className="asteroids-status" role="status" aria-live="polite">{state.message}</p>
        </div>
      </div>
    </section>
  )
}
