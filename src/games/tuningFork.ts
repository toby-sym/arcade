export type TuningForkInterval = 'up-step' | 'up-leap' | 'down-step' | 'down-leap'
export type TuningForkPhase = 'ready' | 'playing' | 'paused' | 'complete'

export interface TuningForkPrompt {
  anchorHz: number
  semitones: number
  interval: TuningForkInterval
}

export interface TuningForkState {
  phase: TuningForkPhase
  roundIndex: number
  answers: boolean[]
  score: number
  feedback: string
}

export const TUNING_FORK_PROMPTS: readonly TuningForkPrompt[] = [
  { anchorHz: 220, semitones: 2, interval: 'up-step' },
  { anchorHz: 294, semitones: -5, interval: 'down-leap' },
  { anchorHz: 247, semitones: 5, interval: 'up-leap' },
  { anchorHz: 330, semitones: -2, interval: 'down-step' },
  { anchorHz: 262, semitones: -5, interval: 'down-leap' },
  { anchorHz: 349, semitones: 5, interval: 'up-leap' },
  { anchorHz: 294, semitones: -2, interval: 'down-step' },
  { anchorHz: 392, semitones: 2, interval: 'up-step' },
]
export const TUNING_FORK_MAX_SCORE = TUNING_FORK_PROMPTS.length * 100

const intervalCopy: Record<TuningForkInterval, string> = {
  'up-step': 'up a step',
  'up-leap': 'up a leap',
  'down-step': 'down a step',
  'down-leap': 'down a leap',
}

export function tuningForkIntervalCopy(interval: TuningForkInterval): string {
  return intervalCopy[interval]
}

export function tuningForkTargetHz(prompt: TuningForkPrompt): number {
  return prompt.anchorHz * 2 ** (prompt.semitones / 12)
}

export function createTuningForkState(): TuningForkState {
  return { phase: 'ready', roundIndex: 0, answers: [], score: 0, feedback: 'Ready to tune in.' }
}

export function startTuningFork(_state: TuningForkState): TuningForkState {
  return { ...createTuningForkState(), phase: 'playing', feedback: 'Listen to the pair, then pick its direction and size.' }
}

export function pauseTuningFork(state: TuningForkState): TuningForkState {
  return state.phase === 'playing' ? { ...state, phase: 'paused', feedback: 'Paused. Resume when you are ready.' } : state
}

export function resumeTuningFork(state: TuningForkState): TuningForkState {
  return state.phase === 'paused' ? { ...state, phase: 'playing', feedback: 'Listen to the pair, then pick its direction and size.' } : state
}

export function answerTuningFork(state: TuningForkState, answer: TuningForkInterval): TuningForkState {
  if (state.phase !== 'playing') return state
  const prompt = TUNING_FORK_PROMPTS[state.roundIndex]
  if (!prompt) return state
  const correct = answer === prompt.interval
  const answers = [...state.answers, correct]
  const complete = state.roundIndex + 1 >= TUNING_FORK_PROMPTS.length
  const score = state.score + (correct ? 100 : 0)
  return {
    phase: complete ? 'complete' : 'playing',
    roundIndex: complete ? state.roundIndex : state.roundIndex + 1,
    answers,
    score,
    feedback: correct
      ? complete ? `Set complete. ${score} points.` : 'Right interval · +100'
      : complete ? `Set complete. ${score} points.` : `Not quite. That pair moved ${intervalCopy[prompt.interval]}.`,
  }
}

