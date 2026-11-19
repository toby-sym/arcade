import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  cipherCircuitProgress,
  cipherCircuitReducer,
  cipherSignalFeedback,
  createCipherCircuitState,
  CIPHER_CIRCUIT_CODE_LENGTH,
  CIPHER_CIRCUIT_GUESS_LIMIT,
  CIPHER_CIRCUIT_SIGNALS,
  type CipherCircuitAction,
  type CipherCircuitProgress,
} from './cipherCircuit'

interface CipherCircuitGameProps {
  onBack: () => void
  bestPulses: number | null
  progress: CipherCircuitProgress | null
  onSaveProgress: (progress: CipherCircuitProgress) => void
}

export function CipherCircuitGame({ onBack, bestPulses, progress, onSaveProgress }: CipherCircuitGameProps) {
  const today = utcDateKey()
  const boardRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    cipherCircuitReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createCipherCircuitState(date, saved),
  )
  const guessesLeft = CIPHER_CIRCUIT_GUESS_LIMIT - state.guesses.length

  useEffect(() => {
    boardRef.current?.focus()
  }, [])

  const sendAction = (action: CipherCircuitAction) => {
    const next = cipherCircuitReducer(state, action)
    if (next === state) return
    dispatch(action)
    onSaveProgress(cipherCircuitProgress(next))
    if (next.phase === 'solved' && state.phase !== 'solved') playSound('win')
    else if (next.phase === 'failed' && state.phase !== 'failed') playSound('lose')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLButtonElement && (event.key === ' ' || (event.key === 'Enter' && !event.target.classList.contains('cipher-submit-button')))) return
    if (/^[1-6]$/.test(event.key)) {
      event.preventDefault()
      sendAction({ type: 'select', signal: Number(event.key) - 1 as 0 | 1 | 2 | 3 | 4 | 5 })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      sendAction({ type: 'submit' })
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      sendAction({ type: 'backspace' })
    }
  }

  const status = state.phase === 'playing'
    ? `${guessesLeft} ${guessesLeft === 1 ? 'pulse' : 'pulses'} left · ${state.guesses.length} sent`
    : state.phase === 'solved'
      ? `Circuit aligned in ${state.guesses.length} ${state.guesses.length === 1 ? 'pulse' : 'pulses'}.`
      : `No pulses remain. The signal key is revealed.`

  return (
    <section className="snake-view cipher-circuit-view" aria-labelledby="cipher-circuit-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout cipher-circuit-layout">
        <div className="snake-copy cipher-circuit-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY CODE · UTC</p>
          <h1 id="cipher-circuit-title">Cipher Circuit<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Read the feedback. Reroute the signals. Close the circuit.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Set four signals in a row and send the pulse. <strong>Locked</strong> signals are in the correct socket. <strong>Rerouted</strong> signals belong in a different socket.</p>
            <p>The key uses six signals, may repeat a signal, and takes up to eight pulses to crack. The same daily key is shared on this UTC date.</p>
          </div>
          <div className="score-card cipher-circuit-score" aria-label={`Today ${state.date}. ${state.guesses.length} pulses sent. ${guessesLeft} pulses left. ${bestPulses === null ? 'No local best yet.' : `Best solve ${bestPulses} pulses.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{String(state.guesses.length).padStart(2, '0')}</strong>
              <span className="score-unit">pulses sent</span>
            </div>
            <div className="breakout-stats"><span><strong>{guessesLeft}</strong> left</span><span><strong>{state.guesses.length}</strong> rows used</span></div>
            <div className="local-best-readout">
              <span className="score-caption">BEST SOLVE · THIS BROWSER</span>
              <strong className="score-value">{bestPulses === null ? '—' : String(bestPulses).padStart(2, '0')}</strong>
              <span className="score-unit">{bestPulses === 1 ? 'pulse' : 'pulses'}</span>
            </div>
          </div>
          <p className="keyboard-hint">Keys 1–6 choose · Enter sends · Backspace removes</p>
          <p className="cipher-circuit-local-note">Your unfinished rows and personal best stay in this browser and do not sync.</p>
        </div>

        <div className="play-column cipher-circuit-play-column" onKeyDown={handleKeyDown}>
          <div className="cipher-circuit-console">
            <div className="frame-topline">
              <span>FIELD 26 · SIGNAL ARRAY</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? 'LIVE' : state.phase.toUpperCase()}</span>
            </div>
            <div ref={boardRef} className="cipher-circuit-board" role="group" aria-label={`Eight signal attempts. ${status}`} tabIndex={0}>
              {Array.from({ length: CIPHER_CIRCUIT_GUESS_LIMIT }, (_, rowIndex) => {
                const guess = state.guesses[rowIndex]
                const active = rowIndex === state.guesses.length && state.phase === 'playing'
                const feedback = guess ? cipherSignalFeedback(state.answer, guess) : null
                return (
                  <div className={`cipher-attempt-row${active ? ' is-active' : ''}${guess ? ' is-sent' : ''}`} key={rowIndex} aria-label={guess ? `Pulse ${rowIndex + 1}` : undefined}>
                    <span className="cipher-row-number">{String(rowIndex + 1).padStart(2, '0')}</span>
                    <div className="cipher-sockets" role="group" aria-label={active ? `Pulse ${rowIndex + 1} input` : guess ? `Pulse ${rowIndex + 1} signals` : `Pulse ${rowIndex + 1} empty`}>
                      {Array.from({ length: CIPHER_CIRCUIT_CODE_LENGTH }, (_, socketIndex) => {
                        const signal = guess?.[socketIndex] ?? (active ? state.activeGuess[socketIndex] : null)
                        return active ? (
                          <button
                            className={`cipher-socket cipher-socket-button${signal === null ? '' : ` signal-${CIPHER_CIRCUIT_SIGNALS[signal].color}`}`}
                            type="button"
                            key={socketIndex}
                            aria-label={`Socket ${socketIndex + 1}: ${signal === null ? 'empty' : `${CIPHER_CIRCUIT_SIGNALS[signal].name} signal`}`}
                            onClick={() => signal !== null && sendAction({ type: 'remove', index: socketIndex })}
                          >
                            {signal === null ? <span aria-hidden="true">·</span> : <span aria-hidden="true">{CIPHER_CIRCUIT_SIGNALS[signal].glyph}</span>}
                          </button>
                        ) : (
                          <span className={`cipher-socket${signal === null ? '' : ` signal-${CIPHER_CIRCUIT_SIGNALS[signal].color}`}`} key={socketIndex} aria-label={signal === null ? 'Empty socket' : `${CIPHER_CIRCUIT_SIGNALS[signal].name} signal`}>
                            {signal === null ? <span aria-hidden="true">·</span> : <span aria-hidden="true">{CIPHER_CIRCUIT_SIGNALS[signal].glyph}</span>}
                          </span>
                        )
                      })}
                    </div>
                    {feedback ? (
                      <div className="cipher-feedback" aria-label={`${feedback.locked} locked, ${feedback.rerouted} rerouted`}>
                        <span className="cipher-locked">{feedback.locked} <small>LOCKED</small></span>
                        <span className="cipher-rerouted">{feedback.rerouted} <small>REROUTED</small></span>
                      </div>
                    ) : active ? (
                      <span className="cipher-feedback-pending">INPUT</span>
                    ) : (
                      <span className="cipher-feedback-pending" aria-hidden="true">··</span>
                    )}
                  </div>
                )
              })}
            </div>

            {state.phase === 'playing' ? (
              <div className="cipher-signal-controls">
                <div className="cipher-signal-palette" role="group" aria-label="Choose a signal">
                  {CIPHER_CIRCUIT_SIGNALS.map((signal, index) => (
                    <button className={`cipher-signal-button signal-${signal.color}`} type="button" key={signal.name} aria-label={`Choose ${signal.name} signal, key ${index + 1}`} onClick={() => sendAction({ type: 'select', signal: index as 0 | 1 | 2 | 3 | 4 | 5 })}>
                      <span aria-hidden="true">{signal.glyph}</span><small>{index + 1}</small>
                    </button>
                  ))}
                </div>
                <div className="cipher-row-actions">
                  <button className="button button-quiet" type="button" disabled={state.activeGuess.every((signal) => signal === null)} onClick={() => sendAction({ type: 'clear' })}>Clear row</button>
                  <button className="button button-primary cipher-submit-button" type="button" disabled={state.activeGuess.some((signal) => signal === null)} onClick={() => sendAction({ type: 'submit' })}>Send pulse <span aria-hidden="true">→</span></button>
                </div>
              </div>
            ) : (
              <div className="cipher-circuit-result" role="status" aria-live="polite">
                <strong>{state.phase === 'solved' ? 'Circuit aligned' : 'Signal key revealed'}</strong>
                <span>{state.phase === 'solved' ? `Solved in ${state.guesses.length} ${state.guesses.length === 1 ? 'pulse' : 'pulses'}.` : 'A fresh code arrives tomorrow.'}</span>
                <div className="cipher-key-reveal" aria-label="Daily signal key">
                  {state.answer.map((signal, index) => (
                    <span className={`cipher-socket signal-${CIPHER_CIRCUIT_SIGNALS[signal].color}`} key={index} aria-label={`${CIPHER_CIRCUIT_SIGNALS[signal].name} signal`}>
                      <span aria-hidden="true">{CIPHER_CIRCUIT_SIGNALS[signal].glyph}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="cipher-circuit-footer"><span>{CIPHER_CIRCUIT_CODE_LENGTH} SOCKETS · {state.date}</span><span>{guessesLeft} PULSES LEFT</span></div>
          </div>
          {state.phase !== 'playing' && <button className="button button-secondary cipher-restart" type="button" onClick={() => sendAction({ type: 'restart' })}>Replay today’s circuit</button>}
          <p className="cipher-circuit-status" role="status" aria-live="polite">{state.message}</p>
        </div>
      </div>
    </section>
  )
}
