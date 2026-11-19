export type PatternPhase = 'ready' | 'showing' | 'input' | 'paused' | 'failed'
export type PatternResumePhase = 'showing' | 'input'

export interface PatternState {
  phase: PatternPhase
  sequence: number[]
  showIndex: number
  activeTile: number | null
  inputIndex: number
  completedRounds: number
  resumePhase: PatternResumePhase | null
  failedTile: number | null
  message: string
}

export type PatternAction =
  | { type: 'start'; tile: number }
  | { type: 'advance' }
  | { type: 'choose'; tile: number; nextTile: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }

const tileNames = ['top left', 'top right', 'bottom left', 'bottom right']

export function createPatternState(): PatternState {
  return {
    phase: 'ready',
    sequence: [],
    showIndex: 0,
    activeTile: null,
    inputIndex: 0,
    completedRounds: 0,
    resumePhase: null,
    failedTile: null,
    message: 'Start a round to see your first pattern.',
  }
}

export function patternReducer(state: PatternState, action: PatternAction): PatternState {
  switch (action.type) {
    case 'start':
      if (state.phase !== 'ready' && state.phase !== 'failed') return state
      return {
        ...createPatternState(),
        phase: 'showing',
        sequence: [action.tile],
        message: 'Watch the pattern. It will light one tile at a time.',
      }

    case 'advance':
      if (state.phase !== 'showing') return state
      if (state.activeTile === null) {
        const tile = state.sequence[state.showIndex]
        if (tile === undefined) return { ...state, phase: 'input', inputIndex: 0, message: `Your turn. Repeat the ${state.sequence.length}-tile pattern.` }
        return { ...state, activeTile: tile, message: `Tile ${tile + 1}, ${tileNames[tile]} lights.` }
      }
      if (state.showIndex === state.sequence.length - 1) {
        return { ...state, phase: 'input', activeTile: null, inputIndex: 0, message: `Your turn. Repeat the ${state.sequence.length}-tile pattern.` }
      }
      return { ...state, activeTile: null, showIndex: state.showIndex + 1, message: 'Watch the pattern.' }

    case 'choose':
      if (state.phase !== 'input') return state
      if (state.sequence[state.inputIndex] !== action.tile) {
        return {
          ...state,
          phase: 'failed',
          activeTile: null,
          failedTile: action.tile,
          message: `Pattern broken. You completed ${state.completedRounds} ${state.completedRounds === 1 ? 'round' : 'rounds'}. Play again when ready.`,
        }
      }
      if (state.inputIndex < state.sequence.length - 1) {
        const inputIndex = state.inputIndex + 1
        return { ...state, inputIndex, message: `Tile ${inputIndex} of ${state.sequence.length} is correct. Keep going.` }
      }
      {
        const sequence = [...state.sequence, action.nextTile]
        const completedRounds = state.completedRounds + 1
        return {
          ...state,
          phase: 'showing',
          sequence,
          showIndex: 0,
          activeTile: null,
          inputIndex: 0,
          completedRounds,
          failedTile: null,
          message: `Pattern complete. Round ${sequence.length} is next.`,
        }
      }

    case 'pause':
      if (state.phase !== 'showing' && state.phase !== 'input') return state
      return {
        ...state,
        phase: 'paused',
        resumePhase: state.phase,
        activeTile: null,
        message: 'Paused. Resume when you are ready.',
      }

    case 'resume':
      if (state.phase !== 'paused' || state.resumePhase === null) return state
      return {
        ...state,
        phase: state.resumePhase,
        resumePhase: null,
        activeTile: null,
        message: state.resumePhase === 'input' ? 'Your turn. Continue where you left off.' : 'Watch the pattern again.',
      }

    case 'reset':
      return createPatternState()
  }
}
