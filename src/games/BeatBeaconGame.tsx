import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeTone } from '../audio/arcadeAudio'
import {
  BEAT_BEACON_BEATS_PER_TRACK,
  BEAT_BEACON_COUNT_IN_MS,
  BEAT_BEACON_MAX_SCORE,
  BEAT_BEACON_TIMING_WINDOW_MS,
  BEAT_BEACON_TRACKS,
  beatBeaconCurrentStep,
  beatBeaconStepTimeMs,
  createBeatBeaconState,
  hitBeatBeacon,
  pauseBeatBeacon,
  resumeBeatBeacon,
  startBeatBeacon,
  tickBeatBeacon,
  type BeatBeaconPad,
  type BeatBeaconState,
} from './beatBeacon'

const pads: Array<{ id: BeatBeaconPad; label: string; key: string; frequency: number }> = [
  { id: 'kick', label: 'Kick', key: 'Q', frequency: 196 },
  { id: 'snare', label: 'Snare', key: 'W', frequency: 247 },
  { id: 'hat', label: 'Hi-hat', key: 'E', frequency: 330 },
  { id: 'tom', label: 'Tom', key: 'R', frequency: 392 },
]

function padLabel(pad: BeatBeaconPad | undefined) {
  return pads.find((item) => item.id === pad)?.label ?? 'rest'
}

export function BeatBeaconGame({
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
  const [state, setState] = useState<BeatBeaconState>(createBeatBeaconState)
  const [nowMs, setNowMs] = useState(0)
  const tone = useArcadeTone()
  const lastRecordedScore = useRef<number | null>(null)
  const lastTone = useRef('')

  useEffect(() => {
    if (state.phase !== 'countIn' && state.phase !== 'playing') return
    const timer = window.setInterval(() => {
      const now = performance.now()
      setNowMs(now)
      setState((current) => tickBeatBeacon(current, now))
    }, 32)
    return () => window.clearInterval(timer)
  }, [state.phase])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const now = performance.now()
        setNowMs(now)
        setState((current) => pauseBeatBeacon(current, now))
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (state.phase !== 'complete' || lastRecordedScore.current === state.score) return
    lastRecordedScore.current = state.score
    onRecordScore(state.score)
  }, [onRecordScore, state.phase, state.score])

  const nextStep = state.judgements.findIndex((judgement) => judgement === null)
  const displayStep = nextStep === -1 ? state.judgements.length - 1 : nextStep
  const trackIndex = Math.floor(displayStep / BEAT_BEACON_BEATS_PER_TRACK)
  const beatInTrack = displayStep % BEAT_BEACON_BEATS_PER_TRACK
  const track = BEAT_BEACON_TRACKS[trackIndex]!
  const nextPad = track.pattern[beatInTrack]
  const elapsedNow = state.phase === 'paused' && state.pausedAtMs !== null
    ? state.pausedAtMs - (state.startedAtMs ?? state.pausedAtMs)
    : nowMs - (state.startedAtMs ?? nowMs)
  const countInBeat = Math.min(3, Math.max(0, Math.floor(Math.max(0, elapsedNow) / (BEAT_BEACON_COUNT_IN_MS / 4))))
  const activeStep = beatBeaconCurrentStep(state, nowMs)
  const audibleCue = state.phase === 'playing'
    && nextStep >= 0
    && state.startedAtMs !== null
    && nowMs >= state.startedAtMs + beatBeaconStepTimeMs(nextStep)
    && nowMs <= state.startedAtMs + beatBeaconStepTimeMs(nextStep) + BEAT_BEACON_TIMING_WINDOW_MS
    ? nextStep
    : null

  useEffect(() => {
    if (state.phase === 'countIn') {
      const cue = `count-${countInBeat}`
      if (lastTone.current !== cue) {
        lastTone.current = cue
        tone(220)
      }
      return
    }
    if (audibleCue !== null && lastTone.current !== `step-${audibleCue}`) {
      lastTone.current = `step-${audibleCue}`
      tone(pads.find((item) => item.id === track.pattern[audibleCue % BEAT_BEACON_BEATS_PER_TRACK])?.frequency ?? 330)
    }
    if (state.phase === 'ready' || state.phase === 'paused' || state.phase === 'complete') lastTone.current = ''
  }, [audibleCue, countInBeat, state.phase, tone, track.pattern])

  const start = useCallback(() => {
    const now = performance.now()
    setNowMs(now)
    lastRecordedScore.current = null
    lastTone.current = ''
    setState((current) => startBeatBeacon(current, now))
  }, [])

  const restart = useCallback(() => {
    lastRecordedScore.current = null
    lastTone.current = ''
    setNowMs(0)
    setState(createBeatBeaconState())
  }, [])

  const togglePause = useCallback(() => {
    const now = performance.now()
    setNowMs(now)
    setState((current) => current.phase === 'paused' ? resumeBeatBeacon(current, now) : pauseBeatBeacon(current, now))
  }, [])

  const hitPad = useCallback((pad: BeatBeaconPad) => {
    const now = performance.now()
    setNowMs(now)
    setState((current) => hitBeatBeacon(current, pad, now))
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && (state.phase === 'countIn' || state.phase === 'playing' || state.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    if (event.repeat) return
    const pad = pads.find((item) => item.key.toLowerCase() === event.key.toLowerCase())
    if (pad && state.phase === 'playing') {
      event.preventDefault()
      hitPad(pad.id)
    }
  }

  const completedBeats = state.judgements.filter((judgement) => judgement !== null).length
  const completedTracks = state.judgements.reduce((count, judgement, index) => (
    (index + 1) % BEAT_BEACON_BEATS_PER_TRACK === 0 && judgement !== null ? count + 1 : count
  ), 0)
  const statusLabel = state.phase === 'ready' ? 'STANDBY'
    : state.phase === 'countIn' ? 'COUNT IN'
      : state.phase === 'playing' ? 'LIVE'
        : state.phase === 'paused' ? 'PAUSED' : 'SET COMPLETE'
  const cueDescription = activeStep === null
    ? state.phase === 'countIn' ? `Count in, beat ${countInBeat + 1} of 4.` : state.feedback
    : `Round ${trackIndex + 1}, beat ${beatInTrack + 1}: ${padLabel(nextPad)}.`

  return (
    <section className={`beat-beacon-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="beat-beacon-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="beat-beacon-layout">
        <div className="beat-beacon-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="beat-beacon-title">Beat Beacon<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="beat-beacon-lede">Catch the light. Land the beat. Play four original drum patterns from first pulse to last.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Four pads follow four short rhythms. When a pad lights, hit that pad close to the beat. Earlier and later hits earn fewer points; the set gets quicker each round.</p>
            <p>Use <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> or tap the pads. Press <kbd>Escape</kbd> to pause.</p>
          </div>
          <div className="beat-beacon-score-card">
            <div>
              <span className="score-caption">THIS SET</span>
              <strong className="beat-beacon-score">{String(state.score).padStart(4, '0')}</strong>
              <span className="beat-beacon-score-max">/ {BEAT_BEACON_MAX_SCORE}</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong>{bestScore === null ? '—' : String(bestScore).padStart(4, '0')}</strong>
            </div>
          </div>
          <p className="beat-beacon-local-note">Your rhythm record stays in this browser and does not sync.</p>
        </div>

        <div className="play-column beat-beacon-play-column">
          <div className={`beat-beacon-console phase-${state.phase}`}>
            <div className="frame-topline">
              <span>FIELD 37</span>
              <span className="frame-light"><i /> {statusLabel}</span>
            </div>

            <div className="beat-beacon-track-readout">
              <div><span>ROUND {String(trackIndex + 1).padStart(2, '0')} / 04</span><strong>{track.title}</strong></div>
              <b>{track.bpm}<small> BPM</small></b>
            </div>

            <div className="beat-beacon-track-progress" aria-label={`${completedTracks} of 4 patterns complete`}>
              {BEAT_BEACON_TRACKS.map((item, index) => (
                <span key={item.title} className={`${index < completedTracks ? 'is-complete' : ''}${index === trackIndex && state.phase !== 'complete' ? ' is-current' : ''}`} />
              ))}
            </div>

            <div className={`beat-beacon-signal${activeStep === null ? '' : ' is-active'}${state.phase === 'countIn' ? ' is-counting' : ''}`} aria-hidden="true">
              {state.phase === 'countIn' ? (
                <><span className="beat-beacon-signal-kicker">GET READY</span><strong>{4 - countInBeat}</strong><span className="beat-beacon-signal-caption">COUNT IN</span></>
              ) : activeStep !== null ? (
                <><span className="beat-beacon-signal-kicker">HIT THE LIT PAD</span><strong>{padLabel(nextPad).toUpperCase()}</strong><span className="beat-beacon-signal-caption">BEAT {String(beatInTrack + 1).padStart(2, '0')}</span></>
              ) : state.phase === 'paused' ? (
                <><span className="beat-beacon-signal-kicker">SESSION HELD</span><strong>PAUSED</strong><span className="beat-beacon-signal-caption">RESUME WHEN READY</span></>
              ) : state.phase === 'complete' ? (
                <><span className="beat-beacon-signal-kicker">FOUR PATTERNS CLEARED</span><strong>{state.score} POINTS</strong><span className="beat-beacon-signal-caption">SET COMPLETE</span></>
              ) : state.phase === 'playing' ? (
                <><span className="beat-beacon-signal-kicker">FOLLOW THE PULSE</span><strong>STAY READY</strong><span className="beat-beacon-signal-caption">NEXT CUE</span></>
              ) : (
                <><span className="beat-beacon-signal-kicker">FOUR PADS · FOUR PATTERNS</span><strong>READY?</strong><span className="beat-beacon-signal-caption">Q · W · E · R</span></>
              )}
            </div>

            <div className="beat-beacon-beat-lane" aria-hidden="true">
              {track.pattern.map((pad, index) => {
                const absoluteStep = trackIndex * BEAT_BEACON_BEATS_PER_TRACK + index
                const judgement = state.judgements[absoluteStep]
                const active = state.phase === 'playing' && absoluteStep === activeStep
                return <span key={`${pad}-${index}`} className={`beat-beacon-beat beat-${pad}${judgement ? ` grade-${judgement}` : ''}${active ? ' is-active' : ''}`}><i /></span>
              })}
            </div>

            <div className="beat-beacon-pad-grid" role="group" aria-label="Four drum pads">
              {pads.map((pad) => (
                <button
                  key={pad.id}
                  type="button"
                  className={`beat-beacon-pad pad-${pad.id}${activeStep !== null && nextPad === pad.id ? ' is-lit' : ''}`}
                  onClick={() => hitPad(pad.id)}
                  disabled={state.phase !== 'playing'}
                  aria-label={`${pad.label} drum, ${pad.key} key`}
                  aria-pressed={activeStep !== null && nextPad === pad.id}
                >
                  <span className="beat-beacon-pad-mark" aria-hidden="true" />
                  <strong>{pad.label}</strong>
                  <kbd>{pad.key}</kbd>
                </button>
              ))}
            </div>

            <div className="beat-beacon-actions">
              {state.phase === 'ready' ? (
                <button className="beat-beacon-start" type="button" onClick={start}>Start the set <span aria-hidden="true">▶</span></button>
              ) : state.phase === 'countIn' || state.phase === 'playing' || state.phase === 'paused' ? (
                <button className="beat-beacon-pause" type="button" onClick={togglePause}>{state.phase === 'paused' ? 'Resume set' : 'Pause set'} <kbd>ESC</kbd></button>
              ) : (
                <button className="beat-beacon-start" type="button" onClick={start}>Play again <span aria-hidden="true">↻</span></button>
              )}
              <button className="beat-beacon-restart" type="button" onClick={restart}>Restart</button>
            </div>
            <div className="beat-beacon-console-footer">
              <span>Q · W · E · R / TOUCH</span><span>{completedBeats} / 32 BEATS</span>
            </div>
          </div>
          <p className="beat-beacon-status" role="status" aria-live="polite">{state.feedback}</p>
          <span className="sr-only" aria-live="polite">{cueDescription}</span>
        </div>
      </div>
    </section>
  )
}

