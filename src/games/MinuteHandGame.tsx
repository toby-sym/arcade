import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { utcDateKey } from './dailyPattern'
import {
  adjustMinuteHand,
  checkMinuteHand,
  createMinuteHandState,
  formatClock,
  MINUTE_HAND_ROUNDS,
  minuteHandPuzzleForDate,
  pauseMinuteHand,
  restartMinuteHand,
  resumeMinuteHand,
  startMinuteHand,
  type MinuteHandProgress,
} from './minuteHand'

export function MinuteHandGame({ onBack, bestMoves, progress, onSaveProgress, reduceMotion }: {
  onBack: () => void
  bestMoves: number | null
  progress: MinuteHandProgress | null
  onSaveProgress: (progress: MinuteHandProgress | null) => void
  reduceMotion: boolean
}) {
  const date = utcDateKey()
  const [state, setState] = useState(() => createMinuteHandState(date, progress))
  const [feedback, setFeedback] = useState('Set the hands to match the clue.')
  const stateRef = useRef(state)
  const saveProgressRef = useRef(onSaveProgress)
  const pauseButtonRef = useRef<HTMLButtonElement>(null)
  const clues = minuteHandPuzzleForDate(state.date)
  const currentClue = clues[Math.min(state.clueIndex, clues.length - 1)]!
  const displayTime = state.phase === 'complete' ? formatClock(currentClue.targetMinutes) : formatClock(state.clockMinutes)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { saveProgressRef.current = onSaveProgress }, [onSaveProgress])
  useEffect(() => { onSaveProgress(state) }, [state])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState === 'hidden') setState((current) => pauseMinuteHand(current))
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  useEffect(() => {
    if (state.phase === 'paused') window.requestAnimationFrame(() => pauseButtonRef.current?.focus())
  }, [state.phase])

  function start() {
    setState((current) => startMinuteHand(current))
  }

  function togglePause() {
    setState((current) => current.phase === 'paused' ? resumeMinuteHand(current) : pauseMinuteHand(current))
  }

  function restart() {
    setState((current) => restartMinuteHand(current))
    setFeedback('Read the first clue, then start the clocks.')
  }

  function returnToFloor() {
    if (stateRef.current.phase === 'playing') {
      const paused = pauseMinuteHand(stateRef.current)
      stateRef.current = paused
      setState(paused)
      saveProgressRef.current(paused)
    }
    onBack()
  }

  function adjust(amount: number) {
    setFeedback('Set the hands to match the clue.')
    setState((current) => adjustMinuteHand(current, amount))
  }

  function submit() {
    const current = stateRef.current
    const checked = checkMinuteHand(current)
    stateRef.current = checked
    setState(checked)
    setFeedback(checked.phase === 'complete' ? 'Every clock is set.'
      : checked.clueIndex !== current.clueIndex ? 'Good chime. Read the next clue.'
        : checked.mistakes > current.mistakes ? 'No chime yet. Check the clue and try another setting.'
          : 'Set the hands to match the clue.')
  }

  function onSectionKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && (state.phase === 'playing' || state.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    if (event.key.toLowerCase() === 'r' && (state.phase === 'playing' || state.phase === 'paused' || state.phase === 'complete')) {
      event.preventDefault()
      restart()
      return
    }
    if (state.phase !== 'playing') return
    const adjustment = event.key === 'ArrowLeft' ? -5
      : event.key === 'ArrowRight' ? 5
        : event.key === 'ArrowUp' ? -60
          : event.key === 'ArrowDown' ? 60 : null
    if (adjustment !== null) {
      event.preventDefault()
      adjust(adjustment)
    } else if (event.key === 'Enter' && event.target === event.currentTarget) {
      event.preventDefault()
      submit()
    }
  }

  const phaseLabel = state.phase === 'ready' ? 'CABINET READY'
    : state.phase === 'playing' ? 'CLOCKS LIVE'
      : state.phase === 'paused' ? 'PAUSED' : 'ALL CHIMED'
  const hour = state.clockMinutes / 60
  const minute = state.clockMinutes % 60
  const minuteAngle = minute * 6 - 90
  const hourAngle = hour * 30 + minute * 0.5 - 90
  const minuteEnd = pointOnClock(minuteAngle, 75)
  const hourEnd = pointOnClock(hourAngle, 52)
  const roundsDone = state.phase === 'complete' ? MINUTE_HAND_ROUNDS : state.clueIndex

  return (
    <section className={`snake-view minutehand-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="minutehand-title" onKeyDown={onSectionKeyDown}>
      <button className="back-link" type="button" onClick={returnToFloor}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout minutehand-layout">
        <div className="snake-copy minutehand-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY CLOCK LOGIC · UTC</p>
          <h1 id="minutehand-title">Minute Hand<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Read each time clue. Set the hands. Ring all five bells.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Set the clock to match each clue, then ring the bell to check it. The long hand moves in five-minute steps; move the short hand by a full hour at a time.</p>
            <p>Use the four controls or the arrow keys: left and right move five minutes, up and down move one hour. <strong>Escape</strong> pauses; <strong>R</strong> starts today’s puzzle over.</p>
          </div>
          <div className="score-card minutehand-score" aria-label={`Today ${state.date}. ${roundsDone} of ${MINUTE_HAND_ROUNDS} clocks solved. ${state.moves} adjustments. ${bestMoves === null ? 'No personal best yet.' : `Fewest adjustments ${bestMoves}.`}`}>
            <div><span className="score-caption">TODAY · {state.date}</span><strong className="score-value">{roundsDone}<small> / {MINUTE_HAND_ROUNDS}</small></strong><span className="score-unit">clocks solved</span></div>
            <div className="minutehand-run-stat"><span className="score-caption">THIS RUN</span><strong className="score-value">{state.moves}</strong><span className="score-unit">hand adjustments</span><span className="minutehand-mistakes">{state.mistakes} <small>MISREADS</small></span></div>
            <div className="local-best-readout"><span className="score-caption">FEWEST · THIS BROWSER</span><strong className="score-value">{bestMoves === null ? '—' : bestMoves}</strong><span className="score-unit">adjustments to clear</span></div>
          </div>
          <p className="minutehand-local-note">The daily clock clues are generated in the app. Progress and personal records stay in this browser and do not sync.</p>
        </div>

        <div className="play-column minutehand-play-column">
          <div className={`minutehand-console phase-${state.phase}`} aria-label="Minute Hand daily puzzle">
            <div className="frame-topline"><span>FIELD 52</span><span className={`frame-light ${state.phase === 'complete' ? 'phase-complete' : ''}`}><i /> {phaseLabel}</span></div>
            <div className="minutehand-roundline"><div><span>DAILY CLOCK SET</span><strong>{state.date} · CLUE {Math.min(state.clueIndex + 1, MINUTE_HAND_ROUNDS)} / {MINUTE_HAND_ROUNDS}</strong></div><b>{roundsDone}<small> SOLVED</small></b></div>

            <div className={`minutehand-instrument phase-${state.phase}`}>
              <div className="minutehand-clue" aria-live="polite">
                <span>TIME CLUE {String(Math.min(state.clueIndex + 1, MINUTE_HAND_ROUNDS)).padStart(2, '0')}</span>
                <strong>{state.phase === 'complete' ? 'Every clock is set. Nice work!' : currentClue.text}</strong>
              </div>
              <figure className="minutehand-clock">
                <svg viewBox="0 0 240 240" role="img" aria-label={`Analog clock set to ${displayTime}`}>
                  <circle className="minutehand-clock-face" cx="120" cy="120" r="106" />
                  {Array.from({ length: 60 }, (_, index) => {
                    const angle = index * 6 - 90
                    const outer = pointOnClock(angle, 97)
                    const inner = pointOnClock(angle, index % 5 === 0 ? 86 : 92)
                    return <line key={index} className={`minutehand-tick${index % 5 === 0 ? ' is-hour' : ''}`} x1={120 + inner.x} y1={120 + inner.y} x2={120 + outer.x} y2={120 + outer.y} />
                  })}
                  {Array.from({ length: 12 }, (_, index) => {
                    const point = pointOnClock(index * 30 - 90, 72)
                    return <text key={index} className="minutehand-number" x={120 + point.x} y={120 + point.y + 5} textAnchor="middle">{index === 0 ? 12 : index}</text>
                  })}
                  <line className="minutehand-hour" x1="120" y1="120" x2={120 + hourEnd.x} y2={120 + hourEnd.y} />
                  <line className="minutehand-minute" x1="120" y1="120" x2={120 + minuteEnd.x} y2={120 + minuteEnd.y} />
                  <circle className="minutehand-pin" cx="120" cy="120" r="6" />
                </svg>
                <figcaption>{displayTime}</figcaption>
              </figure>

              {state.phase !== 'complete' && <>
                <div className="minutehand-adjustments" role="group" aria-label="Adjust clock hands">
                  <button type="button" onClick={() => adjust(-60)} disabled={state.phase !== 'playing'} aria-label="Move the hour hand back one hour">−1 hour <kbd>↑</kbd></button>
                  <button type="button" onClick={() => adjust(-5)} disabled={state.phase !== 'playing'} aria-label="Move the minute hand back five minutes">−5 min <kbd>←</kbd></button>
                  <button type="button" onClick={() => adjust(5)} disabled={state.phase !== 'playing'} aria-label="Move the minute hand forward five minutes">+5 min <kbd>→</kbd></button>
                  <button type="button" onClick={() => adjust(60)} disabled={state.phase !== 'playing'} aria-label="Move the hour hand forward one hour">+1 hour <kbd>↓</kbd></button>
                </div>
                <p className="minutehand-status" role="status" aria-live="polite">{state.phase === 'ready' ? 'Read the first clue, then start the clocks.' : state.phase === 'paused' ? 'Your clock and adjustment count are saved.' : feedback}</p>
              </>}
              {state.phase !== 'playing' && <div className="minutehand-overlay" aria-hidden="true"><div>
                <span>{state.phase === 'ready' ? 'A LITTLE TIME PUZZLE' : state.phase === 'paused' ? 'CLOCK ON HOLD' : 'ALL FIVE BELLS'}</span>
                <strong>{state.phase === 'ready' ? 'Read the clue. Set the hands.' : state.phase === 'paused' ? 'Pick up where you left off.' : `${state.moves} ${state.moves === 1 ? 'adjustment' : 'adjustments'} to clear.`}</strong>
                <p>{state.phase === 'ready' ? 'Your moves count across all five clocks.' : state.phase === 'paused' ? 'Today’s progress is saved in this browser.' : state.mistakes === 0 ? 'Perfect timekeeping. A new set arrives tomorrow.' : `${state.mistakes} ${state.mistakes === 1 ? 'misread' : 'misreads'} along the way. A new set arrives tomorrow.`}</p>
              </div></div>}
            </div>

            <div className="minutehand-actions">
              {state.phase === 'ready' ? <button type="button" className="minutehand-action minutehand-action-primary" onClick={start}>Start today’s clocks <kbd>ENTER</kbd></button>
                : state.phase === 'paused' ? <button ref={pauseButtonRef} type="button" className="minutehand-action minutehand-action-primary" onClick={togglePause}>Resume clocks <kbd>ESC</kbd></button>
                  : state.phase === 'complete' ? <button type="button" className="minutehand-action minutehand-action-primary" onClick={restart}>Try the set again <kbd>R</kbd></button>
                    : <button ref={pauseButtonRef} type="button" className="minutehand-action minutehand-action-pause" onClick={togglePause}>Pause clocks <kbd>ESC</kbd></button>}
              {state.phase === 'playing' && <button type="button" className="minutehand-action minutehand-action-primary" onClick={submit}>Ring the bell <kbd>ENTER</kbd></button>}
              {state.phase !== 'ready' && <button type="button" className="minutehand-action" onClick={restart}>Restart today <kbd>R</kbd></button>}
            </div>
            <p className="minutehand-footnote">Five original time clues, generated locally each day. Local progress and records do not sync.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function pointOnClock(angle: number, radius: number): { x: number; y: number } {
  const radians = angle * Math.PI / 180
  return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius }
}
