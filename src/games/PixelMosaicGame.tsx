import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { utcDateKey } from './dailyPattern'
import {
  createPixelMosaicState,
  formatPixelMosaicTime,
  markPixelMosaicCell,
  pausePixelMosaic,
  pixelMosaicElapsedMs,
  pixelMosaicProgress,
  restartPixelMosaic,
  resumePixelMosaic,
  startPixelMosaic,
  type PixelMosaicMark,
  type PixelMosaicProgress,
} from './pixelMosaic'

export function PixelMosaicGame({ onBack, bestTimeMs, progress, onSaveProgress, reduceMotion }: {
  onBack: () => void
  bestTimeMs: number | null
  progress: PixelMosaicProgress | null
  onSaveProgress: (progress: PixelMosaicProgress) => void
  reduceMotion: boolean
}) {
  const date = utcDateKey()
  const [state, setState] = useState(() => createPixelMosaicState(date, progress))
  const [clock, setClock] = useState(() => performance.now())
  const [mode, setMode] = useState<Exclude<PixelMosaicMark, 'unknown'>>('filled')
  const [focusedCell, setFocusedCell] = useState(0)
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pauseButtonRef = useRef<HTMLButtonElement>(null)
  const elapsedMs = pixelMosaicElapsedMs(state, clock)

  useEffect(() => {
    onSaveProgress(pixelMosaicProgress(state))
  }, [state])

  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => {
      const now = performance.now()
      setClock(now)
      onSaveProgress(pixelMosaicProgress(state, now))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [state.phase, state.startedAt, state.elapsedMs])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState === 'hidden') setState((current) => pausePixelMosaic(current, performance.now()))
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  useEffect(() => {
    if (state.phase === 'paused') window.requestAnimationFrame(() => pauseButtonRef.current?.focus())
  }, [state.phase])

  function start() {
    const now = performance.now()
    setState((current) => startPixelMosaic(current, now))
    setClock(now)
    window.requestAnimationFrame(() => cellRefs.current[focusedCell]?.focus())
  }

  function togglePause() {
    const now = performance.now()
    setState((current) => current.phase === 'paused' ? resumePixelMosaic(current, now) : pausePixelMosaic(current, now))
    setClock(now)
  }

  function restart() {
    const now = performance.now()
    setState((current) => restartPixelMosaic(current, now))
    setClock(now)
    setFocusedCell(0)
    window.requestAnimationFrame(() => cellRefs.current[0]?.focus())
  }

  function returnToFloor() {
    if (state.phase === 'playing') {
      const paused = pausePixelMosaic(state, performance.now())
      setState(paused)
      onSaveProgress(pixelMosaicProgress(paused))
    }
    onBack()
  }

  function setCell(index: number, mark: Exclude<PixelMosaicMark, 'unknown'>) {
    const now = performance.now()
    setState((current) => markPixelMosaicCell(current, index, mark, now))
    setClock(now)
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = focusedCell
    let next = current
    const row = Math.floor(current / 8)
    const column = current % 8
    if (event.key === 'ArrowRight') next = row * 8 + Math.min(7, column + 1)
    else if (event.key === 'ArrowLeft') next = row * 8 + Math.max(0, column - 1)
    else if (event.key === 'ArrowDown') next = Math.min(7, row + 1) * 8 + column
    else if (event.key === 'ArrowUp') next = Math.max(0, row - 1) * 8 + column
    else if (event.key.toLowerCase() === 'x' || event.key.toLowerCase() === 'e') {
      event.preventDefault()
      setCell(current, 'empty')
      return
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      setCell(current, 'filled')
      return
    } else if (event.key === ' ') {
      event.preventDefault()
      setCell(current, mode)
      return
    } else return
    event.preventDefault()
    setFocusedCell(next)
    cellRefs.current[next]?.focus()
  }

  function onSectionKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && (state.phase === 'playing' || state.phase === 'paused')) {
      event.preventDefault()
      togglePause()
    }
    if ((event.key.toLowerCase() === 'r') && (state.phase === 'playing' || state.phase === 'paused' || state.phase === 'complete')) {
      event.preventDefault()
      restart()
    }
  }

  const phaseLabel = state.phase === 'ready' ? 'PICTURE READY'
    : state.phase === 'playing' ? 'PIXELS LIVE'
      : state.phase === 'paused' ? 'PAUSED' : 'MOSAIC COMPLETE'
  const boardDisabled = state.phase !== 'playing'
  const rowLabels = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, column) => row * 8 + column))
  const columnDone = (column: number) => lineIsSolved(Array.from({ length: 8 }, (_, row) => state.cells[row * 8 + column]!), state.columnClues[column]!)
  const rowDone = (row: number) => lineIsSolved(state.cells.slice(row * 8, row * 8 + 8), state.rowClues[row]!)

  return (
    <section className={`snake-view pixelmosaic-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="pixelmosaic-title" onKeyDown={onSectionKeyDown}>
      <button className="back-link" type="button" onClick={returnToFloor}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout pixelmosaic-layout">
        <div className="snake-copy pixelmosaic-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY PICTURE LOGIC · UTC</p>
          <h1 id="pixelmosaic-title">Pixel Mosaic<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Read the runs. Light the pixels. Reveal the little picture hidden in the grid.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Numbers tell you the lengths of consecutive lit pixels in each row and column, in order. Fill those squares and mark every other square dark to finish the picture.</p>
            <p>Choose <strong>Fill</strong> or <strong>Mark dark</strong>, then tap a square. On a keyboard, use the arrow keys to move, <strong>Space</strong> to use the selected tool, <strong>F</strong> to fill, and <strong>X</strong> to mark dark. <strong>Escape</strong> pauses; <strong>R</strong> restarts today’s picture.</p>
          </div>
          <div className="score-card pixelmosaic-score" aria-label={`Today ${state.date}. Current time ${formatPixelMosaicTime(elapsedMs)}. ${state.mistakes} mistakes. ${bestTimeMs === null ? 'No personal best yet.' : `Fastest clear ${formatPixelMosaicTime(bestTimeMs)}.`}`}>
            <div className="pixelmosaic-run-stat"><span className="score-caption">TODAY · {state.date}</span><strong className="score-value">{formatPixelMosaicTime(elapsedMs)}</strong><span className="score-unit">time in this run</span><span className="pixelmosaic-mistakes">{state.mistakes} <small>MISTAKES</small></span></div>
            <div className="local-best-readout"><span className="score-caption">FASTEST · THIS BROWSER</span><strong className="score-value">{bestTimeMs === null ? '—' : formatPixelMosaicTime(bestTimeMs)}</strong><span className="score-unit">completed picture</span></div>
          </div>
          <p className="pixelmosaic-local-note">Your fastest clear stays in this browser and does not sync. A new picture arrives daily at midnight UTC.</p>
        </div>

        <div className="play-column pixelmosaic-play-column">
          <div className={`pixelmosaic-console phase-${state.phase}`} aria-label="Pixel Mosaic daily puzzle">
            <div className="frame-topline"><span>FIELD 51</span><span className={`frame-light ${state.phase === 'complete' ? 'phase-complete' : ''}`}><i /> {phaseLabel}</span></div>
            <div className="pixelmosaic-roundline"><div><span>DAILY MOSAIC</span><strong>{state.date} · 8 × 8</strong></div><b>{formatPixelMosaicTime(elapsedMs)}<small> TIME</small></b></div>
            <div className="pixelmosaic-tools" role="group" aria-label="Square marking tool">
              <button type="button" className={`pixelmosaic-tool${mode === 'filled' ? ' is-active' : ''}`} aria-pressed={mode === 'filled'} onClick={() => setMode('filled')}><i aria-hidden="true" /> Fill <kbd>F</kbd></button>
              <button type="button" className={`pixelmosaic-tool${mode === 'empty' ? ' is-active' : ''}`} aria-pressed={mode === 'empty'} onClick={() => setMode('empty')}><i aria-hidden="true">×</i> Mark dark <kbd>X</kbd></button>
            </div>
            <div className="pixelmosaic-board" role="grid" aria-rowcount={8} aria-colcount={8} aria-label="Eight by eight pixel picture. Row clues appear on the left and column clues above." onKeyDown={onGridKeyDown}>
              <div className="pixelmosaic-board-head" role="row">
                <div className="pixelmosaic-corner" role="columnheader" aria-label="Row clues"><span aria-hidden="true">↓</span><span aria-hidden="true">→</span></div>
                {state.columnClues.map((clue, column) => <div className={`pixelmosaic-clue-stack${columnDone(column) ? ' is-solved' : ''}`} role="columnheader" key={column} aria-label={`Column ${column + 1}: ${clue.join(', ')}`}>
                  {clue[0] === 0 ? <span>·</span> : clue.map((run, index) => <span key={index}>{run}</span>)}
                </div>)}
              </div>
              <div className="pixelmosaic-data" role="rowgroup">
                {rowLabels.map((cells, row) => <div className="pixelmosaic-data-row" role="row" key={row}>
                  <div className={`pixelmosaic-row-clue${rowDone(row) ? ' is-solved' : ''}`} role="rowheader" aria-label={`Row ${row + 1}: ${state.rowClues[row]!.join(', ')}`}>
                    {state.rowClues[row]![0] === 0 ? <span>·</span> : state.rowClues[row]!.map((run, index) => <span key={index}>{run}</span>)}
                  </div>
                  {cells.map((index) => {
                    const mark = state.cells[index]!
                    const incorrect = mark !== 'unknown' && ((mark === 'filled') !== state.solution[index])
                    const label = `Row ${row + 1}, column ${(index % 8) + 1}: ${mark === 'unknown' ? 'unmarked' : mark === 'filled' ? 'filled' : 'marked dark'}${incorrect ? ', does not match the picture' : ''}`
                    return <button
                      key={index}
                      ref={(element) => { cellRefs.current[index] = element }}
                      type="button"
                      role="gridcell"
                      className={`pixelmosaic-cell mark-${mark}${incorrect ? ' is-incorrect' : ''}`}
                      aria-label={label}
                      aria-pressed={mark !== 'unknown'}
                      disabled={boardDisabled}
                      tabIndex={focusedCell === index ? 0 : -1}
                      onFocus={() => setFocusedCell(index)}
                      onClick={() => setCell(index, mode)}
                    ><span aria-hidden="true">{mark === 'empty' ? '×' : ''}</span></button>
                  })}
                </div>)}
              </div>
            </div>
            <p className="pixelmosaic-status" role="status" aria-live="polite">{state.message}</p>
            {state.phase !== 'playing' && <div className="pixelmosaic-overlay"><div>
              <span>{state.phase === 'ready' ? 'THE PICTURE IS HIDING' : state.phase === 'paused' ? 'BOARD ON HOLD' : 'PICTURE REVEALED'}</span>
              <strong>{state.phase === 'ready' ? 'Read the runs.' : state.phase === 'paused' ? 'Pick up where you left off.' : `${state.name}, in ${formatPixelMosaicTime(state.elapsedMs)}.`}</strong>
              <p>{state.phase === 'ready' ? 'Each number is one run of lit squares. Start when you are ready.' : state.phase === 'paused' ? 'Your progress and clock are saved in this browser.' : `You placed ${state.mistakes} ${state.mistakes === 1 ? 'wrong square' : 'wrong squares'} along the way.`}</p>
            </div></div>}
            <div className="pixelmosaic-actions">
              {state.phase === 'ready' ? <button type="button" className="pixelmosaic-action pixelmosaic-action-primary" onClick={start}>Start picture <kbd>ENTER</kbd></button>
                : state.phase === 'paused' ? <button ref={pauseButtonRef} type="button" className="pixelmosaic-action pixelmosaic-action-primary" onClick={togglePause}>Resume picture <kbd>ESC</kbd></button>
                  : state.phase === 'complete' ? <button type="button" className="pixelmosaic-action pixelmosaic-action-primary" onClick={restart}>Try again <kbd>R</kbd></button>
                    : <button ref={pauseButtonRef} type="button" className="pixelmosaic-action pixelmosaic-action-pause" onClick={togglePause}>Pause picture <kbd>ESC</kbd></button>}
              {state.phase !== 'ready' && <button type="button" className="pixelmosaic-action" onClick={restart}>Restart board <kbd>R</kbd></button>}
            </div>
            <p className="pixelmosaic-footnote">Today’s puzzle is the same for everyone and generated here in the app. Personal records and saved progress do not sync.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function lineIsSolved(marks: readonly PixelMosaicMark[], clue: readonly number[]): boolean {
  if (marks.some((mark) => mark === 'unknown')) return false
  const runs: number[] = []
  let run = 0
  for (const mark of marks) {
    if (mark === 'filled') run += 1
    else if (run > 0) { runs.push(run); run = 0 }
  }
  if (run > 0) runs.push(run)
  if (runs.length === 0) runs.push(0)
  return runs.length === clue.length && runs.every((length, index) => length === clue[index])
}
