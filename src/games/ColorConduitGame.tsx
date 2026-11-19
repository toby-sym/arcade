import { useEffect, useReducer, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  colorConduitProgress,
  colorConduitReducer,
  colorConduitSignalAt,
  createColorConduitState,
  formatColorConduitTime,
  COLOR_CONDUIT_GRID_SIZE,
  COLOR_CONDUIT_SIGNALS,
  type ColorConduitAction,
  type ColorConduitProgress,
  type ColorConduitSignal,
} from './colorConduit'

interface ColorConduitGameProps {
  onBack: () => void
  bestSeconds: number | null
  progress: ColorConduitProgress | null
  onSaveProgress: (progress: ColorConduitProgress) => void
}

export function ColorConduitGame({ onBack, bestSeconds, progress, onSaveProgress }: ColorConduitGameProps) {
  const today = utcDateKey()
  const [state, dispatch] = useReducer(
    colorConduitReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createColorConduitState(date, saved),
  )
  const playSound = useArcadeSound()
  const boardRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const previousSound = useRef({ phase: state.phase, mistakes: state.mistakes })
  const occupiedCount = new Set(state.paths.flat()).size
  const connectedCount = state.puzzle.routes.filter((route) => {
    const path = state.paths[route.signal]!
    return path.length > 1 && (path[0] === route.start ? path.at(-1) === route.end : path.at(-1) === route.start)
  }).length

  useEffect(() => {
    const previous = previousSound.current
    if (state.phase === 'complete' && previous.phase !== 'complete') playSound('win')
    else if (state.mistakes > previous.mistakes) playSound('miss')
    previousSound.current = { phase: state.phase, mistakes: state.mistakes }
  }, [playSound, state.mistakes, state.phase])

  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => sendAction({ type: 'tick' }), 1000)
    return () => window.clearInterval(timer)
  }, [state.phase, state.elapsedSeconds])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) sendAction({ type: 'pause' })
    }
    const releasePointer = () => { dragging.current = false }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    window.addEventListener('pointerup', releasePointer)
    window.addEventListener('pointercancel', releasePointer)
    return () => {
      document.removeEventListener('visibilitychange', pauseWhenHidden)
      window.removeEventListener('pointerup', releasePointer)
      window.removeEventListener('pointercancel', releasePointer)
    }
  }, [state])

  function sendAction(action: ColorConduitAction) {
    const next = colorConduitReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (next.moves !== state.moves
      || next.mistakes !== state.mistakes
      || next.elapsedSeconds !== state.elapsedSeconds
      || next.activeSignal !== state.activeSignal
      || next.phase === 'complete') {
      onSaveProgress(colorConduitProgress(next))
    }
  }

  function activateCell(index: number) {
    sendAction({ type: 'cursor', index })
    sendAction({ type: 'cell', index })
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      const row = Math.floor(state.cursor / COLOR_CONDUIT_GRID_SIZE)
      const column = state.cursor % COLOR_CONDUIT_GRID_SIZE
      const nextRow = Math.max(0, Math.min(COLOR_CONDUIT_GRID_SIZE - 1, row + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0)))
      const nextColumn = Math.max(0, Math.min(COLOR_CONDUIT_GRID_SIZE - 1, column + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)))
      sendAction({ type: 'cursor', index: nextRow * COLOR_CONDUIT_GRID_SIZE + nextColumn })
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      sendAction({ type: state.phase === 'paused' ? 'resume' : 'pause' })
      return
    }
    if (event.key === 'Backspace' || event.key.toLowerCase() === 'u') {
      event.preventDefault()
      sendAction({ type: 'undo' })
      return
    }
    if (event.key.toLowerCase() === 'c') {
      event.preventDefault()
      sendAction({ type: 'clear' })
      return
    }
    if (event.key >= '1' && event.key <= '4') {
      event.preventDefault()
      sendAction({ type: 'select', signal: Number(event.key) - 1 as ColorConduitSignal })
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activateCell(state.cursor)
    }
  }

  function pointerDown(index: number, event: PointerEvent<HTMLButtonElement>) {
    if ((event.button !== undefined && event.button !== 0) || state.phase !== 'playing') return
    event.preventDefault()
    dragging.current = true
    activateCell(index)
  }

  const restartDisabled = state.phase !== 'complete' && state.moves === 0 && state.mistakes === 0

  return (
    <section className="snake-view color-conduit-view" aria-labelledby="color-conduit-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout color-conduit-layout">
        <div className="snake-copy color-conduit-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY ROUTING · UTC</p>
          <h1 id="color-conduit-title">Color Conduit<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Four signals. One board. Every cell has to carry the current.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Choose a signal, then connect its two matching terminals by tracing one square at a time. Paths cannot cross or share a square. Power all 36 squares to bring the station online.</p>
            <p>Use the palette or keys <strong>1–4</strong>, then click or drag through neighboring cells. Arrow keys move the board cursor; <strong>Enter</strong> traces a cell. <strong>U</strong> or <strong>Backspace</strong> undoes one cell, <strong>C</strong> clears the active path, and <strong>Escape</strong> pauses.</p>
            <p>A new shared board arrives at midnight UTC. Your current route and fastest solve stay in this browser and do not sync.</p>
          </div>

          <div className="score-card color-conduit-score" aria-label={`Elapsed ${formatColorConduitTime(state.elapsedSeconds)}. ${occupiedCount} of 36 cells powered. ${connectedCount} of 4 signals connected. ${state.mistakes} mistakes.`}>
            <div className="color-conduit-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{formatColorConduitTime(state.elapsedSeconds)}</strong>
              <span className="score-unit">elapsed</span>
            </div>
            <div className="color-conduit-run-stat">
              <span className="score-caption">POWERED</span>
              <strong className="score-value">{occupiedCount}<small> / 36</small></strong>
              <span className="score-unit">squares</span>
            </div>
            <div className="breakout-stats color-conduit-breakout-stats">
              <span><strong>{connectedCount}</strong> / 4 links</span>
              <span><strong>{state.mistakes}</strong> misroutes</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">FASTEST SOLVE · THIS BROWSER</span>
              <strong className="score-value">{bestSeconds === null ? '—' : formatColorConduitTime(bestSeconds)}</strong>
              <span className="score-unit">minutes : seconds</span>
            </div>
          </div>
          <div className="color-conduit-local-note">Daily routes and best solve are saved locally on this browser. They do not sync.</div>
          <div className="game-actions">
            {state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={() => sendAction({ type: 'start' })}>Power up <span aria-hidden="true">→</span></button>
            ) : state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'pause' })}>Pause routes <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={() => sendAction({ type: 'resume' })}>Resume routes <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={() => sendAction({ type: 'restart' })}>Route today again <span aria-hidden="true">→</span></button>
            )}
            {state.phase !== 'ready' && <button className="button button-quiet" type="button" onClick={() => sendAction({ type: 'restart' })} disabled={restartDisabled}>Restart board</button>}
          </div>
        </div>

        <div className="play-column color-conduit-play-column">
          <div className="color-conduit-console">
            <div className="frame-topline">
              <span>FIELD 28</span>
              <span className={`frame-light${state.phase === 'complete' ? ' phase-complete' : ''}`}><i />{state.phase === 'complete' ? 'ONLINE' : `${connectedCount} / 4 LINKS`}</span>
            </div>
            <div className="color-conduit-palette" aria-label="Signal routes">
              {COLOR_CONDUIT_SIGNALS.map((signal, index) => {
                const route = state.puzzle.routes.find((entry) => entry.signal === index)!
                const path = state.paths[index]!
                const connected = path.length > 1 && (path.at(-1) === route.start || path.at(-1) === route.end)
                return (
                  <button
                    key={signal.name}
                    className={`color-conduit-signal color-conduit-${signal.color}${state.activeSignal === index ? ' is-active' : ''}${connected ? ' is-connected' : ''}`}
                    type="button"
                    aria-pressed={state.activeSignal === index}
                    disabled={state.phase !== 'playing'}
                    onClick={() => sendAction({ type: 'select', signal: index as ColorConduitSignal })}
                  >
                    <span className="color-conduit-glyph" aria-hidden="true">{signal.glyph}</span>
                    <span>{signal.name}</span>
                    <span className="color-conduit-signal-state">{connected ? 'LINKED' : path.length > 0 ? `${path.length} CELLS` : 'OPEN'}</span>
                  </button>
                )
              })}
            </div>
            <div
              ref={boardRef}
              className={`color-conduit-board${state.phase === 'paused' ? ' is-paused' : ''}`}
              role="grid"
              aria-label="Six by six Color Conduit routing board"
              aria-rowcount={COLOR_CONDUIT_GRID_SIZE}
              aria-colcount={COLOR_CONDUIT_GRID_SIZE}
              tabIndex={0}
              onKeyDown={handleGridKeyDown}
              onPointerUp={() => { dragging.current = false }}
              onPointerCancel={() => { dragging.current = false }}
            >
              {Array.from({ length: COLOR_CONDUIT_GRID_SIZE }, (_, row) => (
                <div className="color-conduit-row" role="row" key={row}>
                  {Array.from({ length: COLOR_CONDUIT_GRID_SIZE }, (_, column) => {
                    const index = row * COLOR_CONDUIT_GRID_SIZE + column
                    const route = state.puzzle.routes.find((entry) => entry.start === index || entry.end === index)
                    const signal = route?.signal ?? colorConduitSignalAt(state.puzzle, state.paths, index)
                    const signalInfo = signal === null ? null : COLOR_CONDUIT_SIGNALS[signal]
                    const isStart = route?.start === index
                    const isEnd = route?.end === index
                    const isCursor = state.cursor === index
                    const glyph = route ? signalInfo?.glyph : signal !== null ? '·' : ''
                    const cellLabel = route
                      ? `Row ${row + 1}, column ${column + 1}, ${signalInfo?.name} ${isStart ? 'start' : isEnd ? 'end' : 'signal'} terminal${isCursor ? ', cursor' : ''}`
                      : `Row ${row + 1}, column ${column + 1}, ${signalInfo ? `${signalInfo.name} conduit` : 'empty'}${isCursor ? ', cursor' : ''}`
                    return (
                      <button
                        key={index}
                        className={`color-conduit-cell${signalInfo ? ` has-${signalInfo.color}` : ''}${route ? ' is-terminal' : ''}${isCursor ? ' is-cursor' : ''}`}
                        type="button"
                        role="gridcell"
                        aria-label={cellLabel}
                        aria-selected={isCursor}
                        data-cell-index={index}
                        disabled={state.phase !== 'playing'}
                        tabIndex={-1}
                        onPointerDown={(event) => pointerDown(index, event)}
                        onPointerEnter={() => { if (dragging.current) activateCell(index) }}
                        onClick={(event) => { if (event.detail === 0) activateCell(index) }}
                      >
                        <span aria-hidden="true">{glyph}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
              {state.phase === 'ready' && (
                <div className="color-conduit-overlay">
                  <strong>ROUTE THE CURRENT</strong>
                  <span>Connect four signals, then fill every square.</span>
                  <button className="button button-primary" type="button" onClick={() => { sendAction({ type: 'start' }); boardRef.current?.focus() }}>Power up</button>
                </div>
              )}
              {state.phase === 'paused' && (
                <div className="color-conduit-overlay">
                  <strong>ROUTES PAUSED</strong>
                  <span>Your progress is saved on this device.</span>
                  <button className="button button-primary" type="button" onClick={() => { sendAction({ type: 'resume' }); boardRef.current?.focus() }}>Resume routes</button>
                </div>
              )}
              {state.phase === 'complete' && (
                <div className="color-conduit-overlay is-complete" role="status">
                  <strong>STATION ONLINE</strong>
                  <span>All 36 squares are carrying power.</span>
                  <span>Solved in {formatColorConduitTime(state.elapsedSeconds)}.</span>
                </div>
              )}
            </div>
            <div className="color-conduit-board-actions">
              <button className="button button-quiet" type="button" onClick={() => sendAction({ type: 'undo' })} disabled={state.phase !== 'playing' || state.activeSignal === null || state.paths[state.activeSignal]!.length === 0}>Undo cell</button>
              <button className="button button-quiet" type="button" onClick={() => sendAction({ type: 'clear' })} disabled={state.phase !== 'playing' || state.activeSignal === null || state.paths[state.activeSignal]!.length === 0}>Clear route</button>
            </div>
            <p className="color-conduit-status" role="status" aria-live="polite">{state.message}</p>
            <div className="color-conduit-console-footer"><span>1–4 SIGNAL · ARROWS · ENTER · DRAG</span><span>{occupiedCount} / 36 CELLS</span></div>
          </div>
          <p className="color-conduit-keyboard-hint">Focus the grid to route with the keyboard. Escape pauses; U undoes a cell; C clears the active route.</p>
        </div>
      </div>
    </section>
  )
}
