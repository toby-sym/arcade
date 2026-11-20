export type BeatBeaconPad = 'kick' | 'snare' | 'hat' | 'tom'
export type BeatBeaconGrade = 'perfect' | 'good' | 'close' | 'wrong' | 'miss'
export type BeatBeaconPhase = 'ready' | 'countIn' | 'playing' | 'paused' | 'complete'

export interface BeatBeaconTrack {
  title: string
  bpm: number
  pattern: readonly BeatBeaconPad[]
}

export interface BeatBeaconState {
  phase: BeatBeaconPhase
  startedAtMs: number | null
  pausedAtMs: number | null
  judgements: Array<BeatBeaconGrade | null>
  score: number
  feedback: string
}

export const BEAT_BEACON_BEATS_PER_TRACK = 8
export const BEAT_BEACON_TRACKS: readonly BeatBeaconTrack[] = [
  { title: 'After Hours', bpm: 84, pattern: ['kick', 'hat', 'snare', 'hat', 'kick', 'hat', 'snare', 'tom'] },
  { title: 'Crosswalk', bpm: 92, pattern: ['kick', 'hat', 'hat', 'snare', 'kick', 'hat', 'tom', 'snare'] },
  { title: 'Fruit Machine', bpm: 100, pattern: ['kick', 'snare', 'hat', 'hat', 'tom', 'hat', 'snare', 'hat'] },
  { title: 'Last Train', bpm: 108, pattern: ['kick', 'hat', 'snare', 'tom', 'kick', 'snare', 'hat', 'tom'] },
]
export const BEAT_BEACON_TOTAL_BEATS = BEAT_BEACON_BEATS_PER_TRACK * BEAT_BEACON_TRACKS.length
export const BEAT_BEACON_COUNT_IN_MS = 2_400
export const BEAT_BEACON_TIMING_WINDOW_MS = 180
export const BEAT_BEACON_MAX_SCORE = BEAT_BEACON_TOTAL_BEATS * 100

const GRADE_POINTS: Record<BeatBeaconGrade, number> = {
  perfect: 100,
  good: 70,
  close: 35,
  wrong: 0,
  miss: 0,
}

export function createBeatBeaconState(): BeatBeaconState {
  return { phase: 'ready', startedAtMs: null, pausedAtMs: null, judgements: Array.from({ length: BEAT_BEACON_TOTAL_BEATS }, () => null), score: 0, feedback: 'Ready when you are.' }
}

export function startBeatBeacon(_state: BeatBeaconState, nowMs: number): BeatBeaconState {
  if (!Number.isFinite(nowMs)) return createBeatBeaconState()
  return { ...createBeatBeaconState(), phase: 'countIn', startedAtMs: nowMs, feedback: 'Four beats to get ready.' }
}

export function pauseBeatBeacon(state: BeatBeaconState, nowMs: number): BeatBeaconState {
  if ((state.phase !== 'countIn' && state.phase !== 'playing') || !Number.isFinite(nowMs)) return state
  return { ...state, phase: 'paused', pausedAtMs: nowMs, feedback: 'Paused. Resume when you are ready.' }
}

export function resumeBeatBeacon(state: BeatBeaconState, nowMs: number): BeatBeaconState {
  if (state.phase !== 'paused' || state.pausedAtMs === null || state.startedAtMs === null || !Number.isFinite(nowMs)) return state
  const pauseDuration = Math.max(0, nowMs - state.pausedAtMs)
  return {
    ...state,
    phase: state.startedAtMs + pauseDuration + BEAT_BEACON_COUNT_IN_MS - BEAT_BEACON_TIMING_WINDOW_MS <= nowMs ? 'playing' : 'countIn',
    startedAtMs: state.startedAtMs + pauseDuration,
    pausedAtMs: null,
    feedback: 'Back on the count.'
  }
}

export function beatBeaconStepTimeMs(stepIndex: number): number {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= BEAT_BEACON_TOTAL_BEATS) return Number.NaN
  let timeMs = BEAT_BEACON_COUNT_IN_MS
  const trackIndex = Math.floor(stepIndex / BEAT_BEACON_BEATS_PER_TRACK)
  for (let index = 0; index < trackIndex; index += 1) {
    timeMs += BEAT_BEACON_BEATS_PER_TRACK * (60_000 / BEAT_BEACON_TRACKS[index]!.bpm)
  }
  const track = BEAT_BEACON_TRACKS[trackIndex]!
  return timeMs + (stepIndex % BEAT_BEACON_BEATS_PER_TRACK) * (60_000 / track.bpm)
}

export function beatBeaconCurrentStep(state: BeatBeaconState): number | null {
  if (state.phase !== 'playing') return null
  const index = state.judgements.findIndex((judgement) => judgement === null)
  return index === -1 ? null : index
}

export function tickBeatBeacon(state: BeatBeaconState, nowMs: number): BeatBeaconState {
  if ((state.phase !== 'countIn' && state.phase !== 'playing') || state.startedAtMs === null || !Number.isFinite(nowMs)) return state
  const startedAtMs = state.startedAtMs
  const judgements = [...state.judgements]
  let missed = 0
  for (let index = 0; index < judgements.length; index += 1) {
    const judgement = judgements[index]
    if (judgement === null && nowMs - startedAtMs > beatBeaconStepTimeMs(index) + BEAT_BEACON_TIMING_WINDOW_MS) {
      judgements[index] = 'miss'
      missed += 1
    }
  }
  const complete = judgements.every((judgement) => judgement !== null)
  const phase: BeatBeaconPhase = complete
    ? 'complete'
    : nowMs - state.startedAtMs >= BEAT_BEACON_COUNT_IN_MS - BEAT_BEACON_TIMING_WINDOW_MS
      ? 'playing'
      : 'countIn'
  return {
    ...state,
    phase,
    judgements,
    feedback: complete ? `Set complete. ${state.score} points.` : missed > 0 ? 'Missed a beat. Catch the next cue.' : state.feedback,
  }
}

export function hitBeatBeacon(state: BeatBeaconState, pad: BeatBeaconPad, nowMs: number): BeatBeaconState {
  const advanced = tickBeatBeacon(state, nowMs)
  if (advanced.phase !== 'playing' || advanced.startedAtMs === null) {
    if (advanced.phase === 'countIn') return { ...advanced, feedback: 'Stay with the count-in.' }
    return advanced
  }

  const stepIndex = advanced.judgements.findIndex((judgement) => judgement === null)
  if (stepIndex === -1) return advanced
  const offsetMs = nowMs - (advanced.startedAtMs + beatBeaconStepTimeMs(stepIndex))
  if (offsetMs < -BEAT_BEACON_TIMING_WINDOW_MS) return { ...advanced, feedback: 'Too soon. Listen for the cue.' }
  if (offsetMs > BEAT_BEACON_TIMING_WINDOW_MS) return { ...advanced, feedback: 'Late. Catch the next cue.' }

  const trackIndex = Math.floor(stepIndex / BEAT_BEACON_BEATS_PER_TRACK)
  const expectedPad = BEAT_BEACON_TRACKS[trackIndex]!.pattern[stepIndex % BEAT_BEACON_BEATS_PER_TRACK]!
  if (pad !== expectedPad) {
    const judgements = [...advanced.judgements]
    judgements[stepIndex] = 'wrong'
    const complete = judgements.every((judgement) => judgement !== null)
    return {
      ...advanced,
      phase: complete ? 'complete' : 'playing',
      judgements,
      feedback: complete ? `Set complete. ${advanced.score} points.` : 'Wrong pad. Follow the lit cue.',
    }
  }

  const distance = Math.abs(offsetMs)
  const grade: BeatBeaconGrade = distance <= 45 ? 'perfect' : distance <= 105 ? 'good' : 'close'
  const score = advanced.score + GRADE_POINTS[grade]
  const judgements = [...advanced.judgements]
  judgements[stepIndex] = grade
  const complete = judgements.every((judgement) => judgement !== null)
  return {
    ...advanced,
    phase: complete ? 'complete' : 'playing',
    judgements,
    score,
    feedback: complete ? `Set complete. ${score} points.` : `${grade === 'perfect' ? 'Perfect' : grade === 'good' ? 'Good' : 'Close'} · +${GRADE_POINTS[grade]}`,
  }
}

