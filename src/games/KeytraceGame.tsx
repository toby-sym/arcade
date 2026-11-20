import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createKeytraceState,
  formatKeytraceTime,
  keytraceAccuracy,
  keytraceClearIsAccurate,
  keytraceElapsedMs,
  pauseKeytrace,
  restartKeytrace,
  resumeKeytrace,
  startKeytrace,
  submitKeytraceWord,
} from './keytrace'

export function KeytraceGame({
  onBack,
  bestTimeMs,
  onRecordTime,
  reduceMotion,
}: {
  onBack: () => void
  bestTimeMs: number | null
  onRecordTime: (milliseconds: number) => void
  reduceMotion: boolean
}) {
  const date = utcDateKey()
  const [state, setState] = useState(() => createKeytraceState(date))
  const [typedWord, setTypedWord] = useState('')
  const [clock, setClock] = useState(() => performance.now())
  const inputRef = useRef<HTMLInputElement>(null)
  const primaryActionRef = useRef<HTMLButtonElement>(null)
  const pauseButtonRef = useRef<HTMLButtonElement>(null)
  const playSound = useArcadeSound()
  const elapsedMs = keytraceElapsedMs(state, clock)
  const accuracy = keytraceAccuracy(state.correctCharacters, state.mistakes)
  const currentWord = state.words[state.wordIndex] ?? ''

  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => setClock(performance.now()), 80)
    return () => window.clearInterval(timer)
  }, [state.phase])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState !== 'hidden') return
      setState((current) => pauseKeytrace(current, performance.now()))
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  useEffect(() => {
    if (state.phase === 'complete') window.requestAnimationFrame(() => primaryActionRef.current?.focus())
    else if (state.phase === 'paused') window.requestAnimationFrame(() => pauseButtonRef.current?.focus())
  }, [state.phase])

  function startRun() {
    setState((current) => startKeytrace(current, performance.now()))
    setClock(performance.now())
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  function togglePause() {
    const now = performance.now()
    const next = state.phase === 'paused' ? resumeKeytrace(state, now) : pauseKeytrace(state, now)
    setState(next)
    setClock(now)
    if (next.phase === 'playing') window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  function restartRun() {
    setState(restartKeytrace(state))
    setTypedWord('')
    window.requestAnimationFrame(() => primaryActionRef.current?.focus())
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = submitKeytraceWord(state, typedWord, performance.now())
    if (next === state) return
    setState(next)
    setTypedWord('')
    setClock(performance.now())
    if (next.wordIndex > state.wordIndex) {
      if (next.phase === 'complete') {
        playSound('win')
        if (keytraceClearIsAccurate(next) && next.elapsedMs > 0) onRecordTime(next.elapsedMs)
      } else playSound('hit')
    } else playSound('miss')
    if (next.phase === 'playing') window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape' || (state.phase !== 'playing' && state.phase !== 'paused')) return
    event.preventDefault()
    togglePause()
  }

  const phaseLabel = state.phase === 'ready' ? 'STRIP READY'
    : state.phase === 'playing' ? 'TYPE THE LINE'
      : state.phase === 'paused' ? 'PAUSED' : keytraceClearIsAccurate(state) ? 'CLEAN CLEAR' : 'STRIP CLEAR'
  const accuracyMessage = keytraceClearIsAccurate(state)
    ? 'Accuracy stayed above 95%. This clear qualifies for your local best.'
    : `Accuracy ${accuracy}%. Reach at least 95% for a fastest-time record.`

  return (
    <section className={`snake-view keytrace-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="keytrace-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout keytrace-layout">
        <div className="snake-copy keytrace-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY TYPE RUN · UTC</p>
          <h1 id="keytrace-title">Keytrace<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Twelve words, one line. Keep your hands light and let the time fall.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Type each highlighted word in order, then press <strong>Enter</strong> or the check button. A typo keeps you on that word and lowers accuracy; correct it and carry on.</p>
            <p><strong>Escape</strong> pauses or resumes. <strong>Restart run</strong> gives you the same daily strip again. A fastest clear needs at least 95% accuracy.</p>
          </div>
          <div className="score-card keytrace-score" aria-label={`Today ${state.date}. Current time ${formatKeytraceTime(elapsedMs)}. Accuracy ${accuracy} percent. ${bestTimeMs === null ? 'No local best yet.' : `Fastest accurate clear ${formatKeytraceTime(bestTimeMs)}.`}`}>
            <div className="keytrace-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{formatKeytraceTime(elapsedMs)}</strong>
              <span className="score-unit">time in this run</span>
              <span className="keytrace-accuracy">{accuracy}% <small>ACCURACY</small></span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">FASTEST · THIS BROWSER</span>
              <strong className="score-value">{bestTimeMs === null ? '—' : formatKeytraceTime(bestTimeMs)}</strong>
              <span className="score-unit">accurate clear</span>
            </div>
          </div>
          <p className="keytrace-local-note">Your fastest accurate clear stays in this browser and does not sync.</p>
        </div>

        <div className="play-column keytrace-play-column">
          <div className={`keytrace-console phase-${state.phase}`} tabIndex={-1} aria-label="Keytrace daily typing challenge">
            <div className="frame-topline"><span>FIELD 50</span><span className={`frame-light ${state.phase === 'complete' ? 'phase-complete' : ''}`}><i /> {phaseLabel}</span></div>
            <div className="keytrace-time-row">
              <div><span>DAILY STRIP</span><strong>{state.date} · 12 WORDS</strong></div>
              <b>{formatKeytraceTime(elapsedMs)}<small> TIME</small></b>
            </div>
            <div className="keytrace-progress" role="progressbar" aria-label="Words typed" aria-valuemin={0} aria-valuemax={state.words.length} aria-valuenow={state.wordIndex}>
              {state.words.map((word, index) => <i key={`${index}-${word}`} className={index < state.wordIndex ? 'is-done' : index === state.wordIndex ? 'is-current' : ''} />)}
            </div>
            <div className="keytrace-strip" role="group" aria-label={`Daily word strip, word ${Math.min(state.wordIndex + 1, state.words.length)} of ${state.words.length}`}>
              {state.words.map((word, index) => (
                <span key={`${index}-${word}`} className={`keytrace-word${index < state.wordIndex ? ' is-done' : ''}${index === state.wordIndex && state.phase !== 'complete' ? ' is-current' : ''}`} aria-current={index === state.wordIndex && state.phase !== 'complete' ? 'step' : undefined}>{word}</span>
              ))}
            </div>
            <div className="keytrace-entry">
              {state.phase === 'playing' ? (
                <form onSubmit={handleSubmit}>
                  <label htmlFor="keytrace-word">TYPE THIS WORD <strong>{currentWord}</strong></label>
                  <div className="keytrace-input-row">
                    <input
                      ref={inputRef}
                      id="keytrace-word"
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={24}
                      value={typedWord}
                      onChange={(event) => setTypedWord(event.currentTarget.value)}
                      aria-label={`Type the word ${currentWord}`}
                    />
                    <button type="submit" disabled={!typedWord.trim()} aria-label="Check word">Check <kbd>ENTER</kbd></button>
                  </div>
                </form>
              ) : (
                <div className="keytrace-entry-locked" aria-label={state.phase === 'ready' ? 'Start the run to type the daily strip' : state.phase === 'paused' ? 'Run paused' : 'Daily strip complete'}>
                  <span>{state.phase === 'ready' ? 'READY WHEN YOU ARE' : state.phase === 'paused' ? 'RUN HELD' : 'STRIP FINISHED'}</span>
                  <strong>{state.phase === 'ready' ? 'Find a comfortable rhythm.' : state.phase === 'paused' ? 'Time is stopped.' : formatKeytraceTime(state.elapsedMs)}</strong>
                </div>
              )}
            </div>

            {state.phase !== 'playing' && (
              <div className="keytrace-overlay">
                <div>
                  <span>{state.phase === 'ready' ? 'THE LINE IS YOURS' : state.phase === 'paused' ? 'RUN PAUSED' : keytraceClearIsAccurate(state) ? 'ACCURATE RUN' : 'STRIP COMPLETE'}</span>
                  <strong>{state.phase === 'ready' ? 'Start the daily strip.' : state.phase === 'paused' ? 'Take your time.' : `${formatKeytraceTime(state.elapsedMs)} · ${accuracy}%`}</strong>
                  <p>{state.phase === 'ready' ? 'Type twelve short words in order. The clock begins when you start.' : state.phase === 'paused' ? 'Resume when you are ready; your time is held.' : state.phase === 'complete' ? accuracyMessage : state.message}</p>
                </div>
              </div>
            )}

            <p className="keytrace-status" role="status" aria-live="polite">{state.message}</p>
            <div className="keytrace-actions">
              {state.phase === 'ready' ? <button className="keytrace-action keytrace-action-primary" type="button" ref={primaryActionRef} onClick={startRun}>Start run <kbd>ENTER</kbd></button>
                : state.phase === 'complete' ? <button className="keytrace-action keytrace-action-primary" type="button" ref={primaryActionRef} onClick={restartRun}>Type today again <kbd>ENTER</kbd></button>
                  : <button className="keytrace-action keytrace-action-pause" type="button" ref={pauseButtonRef} onClick={togglePause}>{state.phase === 'paused' ? 'Resume run' : 'Pause run'} <kbd>ESC</kbd></button>}
              {(state.phase === 'playing' || state.phase === 'paused') && <button className="keytrace-action" type="button" onClick={restartRun}>Restart run</button>}
            </div>
          </div>
          <p className="keytrace-footnote">Today’s strip comes from words bundled with Arcade. Your time and accuracy stay on this device.</p>
        </div>
      </div>
    </section>
  )
}
