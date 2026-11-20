import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeTone } from '../audio/arcadeAudio'
import {
  TUNING_FORK_MAX_SCORE,
  TUNING_FORK_PROMPTS,
  answerTuningFork,
  createTuningForkState,
  pauseTuningFork,
  resumeTuningFork,
  startTuningFork,
  tuningForkIntervalCopy,
  tuningForkTargetHz,
  type TuningForkInterval,
  type TuningForkPrompt,
} from './tuningFork'

const intervalChoices: Array<{ id: TuningForkInterval; title: string; direction: string; size: string; key: string }> = [
  { id: 'up-step', title: 'Up a step', direction: '↑', size: 'SMALL RISE', key: '1' },
  { id: 'up-leap', title: 'Up a leap', direction: '↗', size: 'LARGE RISE', key: '2' },
  { id: 'down-step', title: 'Down a step', direction: '↓', size: 'SMALL FALL', key: '3' },
  { id: 'down-leap', title: 'Down a leap', direction: '↘', size: 'LARGE FALL', key: '4' },
]

function PitchContour({ prompt }: { prompt: TuningForkPrompt }) {
  const startY = 91
  const endY = startY - prompt.semitones * 7
  const description = `Pitch contour ${prompt.semitones > 0 ? 'rises' : 'falls'} by ${Math.abs(prompt.semitones)} semitones.`
  return (
    <svg className="tuning-fork-contour" viewBox="0 0 520 160" role="img" aria-label={description}>
      <path className="tuning-fork-staff" d="M35 35H485M35 57H485M35 79H485M35 101H485M35 123H485" />
      <path className="tuning-fork-contour-line" d={`M115 ${startY} C205 ${startY}, 290 ${endY}, 405 ${endY}`} />
      <circle className="tuning-fork-note anchor" cx="115" cy={startY} r="11" />
      <circle className="tuning-fork-note destination" cx="405" cy={endY} r="11" />
      <text className="tuning-fork-note-label" x="115" y="147" textAnchor="middle">ANCHOR</text>
      <text className="tuning-fork-note-label" x="405" y="147" textAnchor="middle">TARGET</text>
    </svg>
  )
}

export function TuningForkGame({
  onBack,
  bestScore,
  onRecordScore,
  reduceMotion,
}: {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createTuningForkState)
  const tone = useArcadeTone()
  const lastRecordedScore = useRef<number | null>(null)
  const playbackTimeout = useRef<number | null>(null)

  const playPair = useCallback((prompt: TuningForkPrompt) => {
    if (playbackTimeout.current !== null) window.clearTimeout(playbackTimeout.current)
    tone(prompt.anchorHz)
    playbackTimeout.current = window.setTimeout(() => tone(tuningForkTargetHz(prompt)), 360)
  }, [tone])

  useEffect(() => {
    if (state.phase !== 'playing') return
    playPair(TUNING_FORK_PROMPTS[state.roundIndex]!)
    return () => {
      if (playbackTimeout.current !== null) {
        window.clearTimeout(playbackTimeout.current)
        playbackTimeout.current = null
      }
    }
  }, [playPair, state.phase, state.roundIndex])

  useEffect(() => () => {
    if (playbackTimeout.current !== null) window.clearTimeout(playbackTimeout.current)
  }, [])

  useEffect(() => {
    if (state.phase !== 'complete' || lastRecordedScore.current === state.score) return
    lastRecordedScore.current = state.score
    onRecordScore(state.score)
  }, [onRecordScore, state.phase, state.score])

  const prompt = TUNING_FORK_PROMPTS[state.roundIndex]!
  const onChoice = (answer: TuningForkInterval) => setState((current) => answerTuningFork(current, answer))
  const start = () => {
    lastRecordedScore.current = null
    setState((current) => startTuningFork(current))
  }
  const restart = () => {
    lastRecordedScore.current = null
    setState(createTuningForkState())
  }
  const togglePause = () => setState((current) => current.phase === 'paused' ? resumeTuningFork(current) : pauseTuningFork(current))

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && (state.phase === 'playing' || state.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    if (event.repeat || state.phase !== 'playing') return
    const choice = intervalChoices.find((item) => item.key === event.key)
    if (choice) {
      event.preventDefault()
      onChoice(choice.id)
    }
  }

  const statusLabel = state.phase === 'ready' ? 'STANDBY'
    : state.phase === 'playing' ? 'LISTEN / CHOOSE'
      : state.phase === 'paused' ? 'PAUSED' : 'SET COMPLETE'
  const description = state.phase === 'ready'
    ? 'An eight-pair pitch test. Listen to each two-note signal, then name its direction and size.'
    : state.phase === 'paused'
      ? 'The interval set is paused.'
      : state.phase === 'complete'
        ? `Eight pairs complete. You scored ${state.score} out of ${TUNING_FORK_MAX_SCORE}.`
        : `Pair ${state.roundIndex + 1} of ${TUNING_FORK_PROMPTS.length}. Choose the interval direction and size.`

  return (
    <section className={`tuning-fork-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="tuning-fork-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="tuning-fork-layout">
        <div className="tuning-fork-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="tuning-fork-title">Tuning Fork<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="tuning-fork-lede">Two notes. One interval. Tune your ear to the space between them.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Hear a pair of locally synthesized notes, or follow its visual pitch contour. Choose whether the target moved up or down by a small step or a larger leap.</p>
            <p>Answer eight original pairs. Use <kbd>1</kbd>–<kbd>4</kbd> or tap a choice. Press <kbd>Escape</kbd> to pause.</p>
          </div>
          <div className="tuning-fork-score-card">
            <div>
              <span className="score-caption">THIS SET</span>
              <strong className="tuning-fork-score">{String(state.score).padStart(3, '0')}</strong>
              <span className="tuning-fork-score-max">/ {TUNING_FORK_MAX_SCORE}</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong>{bestScore === null ? '—' : String(bestScore).padStart(3, '0')}</strong>
            </div>
          </div>
          <p className="tuning-fork-local-note">Your ear-training record stays in this browser and does not sync. Audio cues use Arcade sounds; the visual contour remains available when sound is off.</p>
        </div>

        <div className="play-column tuning-fork-play-column">
          <div className={`tuning-fork-console phase-${state.phase}`}>
            <div className="frame-topline">
              <span>FIELD 38</span>
              <span className="frame-light"><i /> {statusLabel}</span>
            </div>

            <div className="tuning-fork-roundline">
              <div><span>PAIR {String(Math.min(state.roundIndex + 1, TUNING_FORK_PROMPTS.length)).padStart(2, '0')} / 08</span><strong>{state.phase === 'complete' ? 'Interval set' : 'Find the gap'}</strong></div>
              <b>{state.answers.filter(Boolean).length}<small> RIGHT</small></b>
            </div>

            <div className="tuning-fork-progress" aria-label={`${state.answers.length} of 8 pairs answered`}>
              {TUNING_FORK_PROMPTS.map((item, index) => (
                <span key={`${item.anchorHz}-${item.interval}`} className={`${index < state.answers.length ? state.answers[index] ? 'is-correct' : 'is-wrong' : ''}${index === state.roundIndex && state.phase !== 'complete' ? ' is-current' : ''}`} />
              ))}
            </div>

            <div className={`tuning-fork-signal${state.phase === 'paused' ? ' is-paused' : ''}`}>
              {state.phase === 'ready' ? (
                <div className="tuning-fork-ready">
                  <span>AN EIGHT-PAIR LISTENING TEST</span>
                  <strong>Find the interval.</strong>
                  <small>Audio and visual cues are both available.</small>
                </div>
              ) : state.phase === 'paused' ? (
                <div className="tuning-fork-ready"><span>SESSION HELD</span><strong>Paused</strong><small>Resume when you are ready.</small></div>
              ) : state.phase === 'complete' ? (
                <div className="tuning-fork-ready"><span>SET COMPLETE</span><strong>{state.score} / {TUNING_FORK_MAX_SCORE}</strong><small>{state.answers.filter(Boolean).length} intervals identified correctly.</small></div>
              ) : (
                <>
                  <PitchContour prompt={prompt} />
                  <button className="tuning-fork-replay" type="button" onClick={() => playPair(prompt)} aria-label="Hear this two-note interval again">↻ <span>PLAY PAIR AGAIN</span></button>
                </>
              )}
            </div>

            <div className="tuning-fork-choice-grid" role="group" aria-label="Choose the interval heard">
              {intervalChoices.map((choice) => (
                <button
                  key={choice.id}
                  className={`tuning-fork-choice${choice.id.startsWith('up') ? ' is-rising' : ' is-falling'}`}
                  type="button"
                  onClick={() => onChoice(choice.id)}
                  disabled={state.phase !== 'playing'}
                  aria-label={`${choice.title}, key ${choice.key}`}
                >
                  <span className="tuning-fork-choice-arrow" aria-hidden="true">{choice.direction}</span>
                  <strong>{choice.title}</strong>
                  <small>{choice.size}</small>
                  <kbd>{choice.key}</kbd>
                </button>
              ))}
            </div>

            <div className="tuning-fork-actions">
              {state.phase === 'ready' ? (
                <button className="tuning-fork-start" type="button" onClick={start}>Start listening <span aria-hidden="true">▶</span></button>
              ) : state.phase === 'complete' ? (
                <button className="tuning-fork-start" type="button" onClick={start}>Play again <span aria-hidden="true">↻</span></button>
              ) : (
                <button className="tuning-fork-pause" type="button" onClick={togglePause}>{state.phase === 'paused' ? 'Resume set' : 'Pause set'} <kbd>ESC</kbd></button>
              )}
              <button className="tuning-fork-restart" type="button" onClick={restart}>Restart</button>
            </div>
            <div className="tuning-fork-console-footer"><span>1 · 2 · 3 · 4 / TOUCH</span><span>{state.answers.length} / 08 PAIRS</span></div>
          </div>
          <p className="tuning-fork-status" role="status" aria-live="polite">{state.feedback}</p>
          <span className="sr-only" aria-live="polite">{description}{state.phase === 'playing' ? ` The pair moves ${tuningForkIntervalCopy(prompt.interval)}.` : ''}</span>
        </div>
      </div>
    </section>
  )
}

