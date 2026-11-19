import { useEffect, useRef, useState } from 'react'

type Phase = 'ready' | 'waiting' | 'go' | 'false-start' | 'result'

export function ReactionGame({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [result, setResult] = useState<number | null>(null)
  const [notice, setNotice] = useState('Press the button when you are ready to begin.')
  const timerRef = useRef<number | null>(null)
  const signalTimeRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }

  useEffect(() => {
    return () => clearTimer()
  }, [])

  useEffect(() => {
    const resetWhenHidden = () => {
      if (document.hidden && (phase === 'waiting' || phase === 'go')) {
        clearTimer()
        signalTimeRef.current = null
        setPhase('ready')
        setNotice('Round reset because the page was hidden. Start again when ready.')
      }
    }
    document.addEventListener('visibilitychange', resetWhenHidden)
    return () => document.removeEventListener('visibilitychange', resetWhenHidden)
  }, [phase])

  const start = () => {
    clearTimer()
    signalTimeRef.current = null
    setResult(null)
    setNotice('Wait for the green signal. Then press as quickly as you can.')
    setPhase('waiting')
    const delay = 1800 + Math.floor(Math.random() * 2201)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      signalTimeRef.current = performance.now()
      setPhase('go')
      setNotice('Green signal. Press now!')
    }, delay)
  }

  const reset = () => {
    clearTimer()
    signalTimeRef.current = null
    setResult(null)
    setPhase('ready')
    setNotice('Press the button when you are ready to begin.')
  }

  const activate = () => {
    if (phase === 'ready' || phase === 'false-start' || phase === 'result') {
      start()
    } else if (phase === 'waiting') {
      clearTimer()
      setPhase('false-start')
      setNotice('Too soon. Wait for green next time.')
    } else if (phase === 'go' && signalTimeRef.current !== null) {
      const elapsed = Math.max(0, Math.round(performance.now() - signalTimeRef.current))
      signalTimeRef.current = null
      setResult(elapsed)
      setPhase('result')
      setNotice(`Your reaction time was ${elapsed} milliseconds.`)
    }
  }

  const targetCopy: Record<Phase, string> = {
    ready: 'Start a round',
    waiting: 'Wait for green…',
    go: 'PRESS NOW!',
    'false-start': 'Too soon! Try again',
    result: 'Another round?',
  }
  const targetHint: Record<Phase, string> = {
    ready: 'Tap, click, or press Space to start',
    waiting: 'Hold steady. Don’t press yet.',
    go: 'Tap, click, or press Space',
    'false-start': 'Tap, click, or press Space to retry',
    result: 'Tap, click, or press Space to play again',
  }

  return (
    <section className="snake-view reaction-view" aria-labelledby="reaction-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout reaction-layout">
        <div className="snake-copy reaction-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="reaction-title">Reaction<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Wait for the green. Then see how quickly you can answer the signal.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Press the large button to start. Keep your hands off until it turns green, then tap, click, or press Space as fast as you can. Pressing early ends the round.</p>
          </div>
          <div className="reaction-result">
            <span className="score-caption">YOUR REACTION TIME</span>
            {phase === 'result' ? (
              <strong className="reaction-time">{result}<span> ms</span></strong>
            ) : (
              <strong className="reaction-time reaction-time-placeholder">—<span> ms</span></strong>
            )}
          </div>
          <div className="game-actions">
            <button className="button button-quiet" type="button" onClick={reset}>Restart</button>
          </div>
          <p className="keyboard-hint">Space to respond when the signal is green.</p>
        </div>

        <div className="play-column reaction-play-column">
          <div className={`reaction-console phase-${phase}`}>
            <div className="frame-topline">
              <span>FIELD 02</span>
              <span className="frame-light"><i /> {phase === 'go' ? 'SIGNAL' : phase === 'waiting' ? 'WAIT' : phase === 'result' ? 'RECORDED' : 'READY'}</span>
            </div>
            <button
              className="reaction-target"
              type="button"
              onClick={activate}
              aria-describedby="reaction-instructions reaction-status"
            >
              <span className="reaction-target-mark" aria-hidden="true" />
              <strong>{targetCopy[phase]}</strong>
              <span className="reaction-target-hint">{targetHint[phase]}</span>
            </button>
            <div className="reaction-console-footer">
              <span id="reaction-instructions">TOUCH · CLICK · SPACE</span>
              <span>ONE SIGNAL</span>
            </div>
          </div>
          <p id="reaction-status" className="reaction-status" role="status" aria-live="polite">{notice}</p>
        </div>
      </div>
    </section>
  )
}
