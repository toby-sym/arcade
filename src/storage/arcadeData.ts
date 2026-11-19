import type { PongDifficulty } from '../games/pong'
import type { DailyWordProgress } from '../games/dailyWord'
import { validConnectionsProgress, type ConnectionsProgress } from '../games/connections'
import { validSpellingBeeProgress, type SpellingBeeProgress } from '../games/spellingBee'
import { validStrandsProgress, type StrandsProgress } from '../games/strands'
import { validSudokuProgress, type SudokuProgress } from '../games/sudoku'
import { validMiniCrosswordProgress, type MiniCrosswordProgress } from '../games/miniCrossword'
import { validLetterBoxedProgress, type LetterBoxedProgress } from '../games/letterBoxed'
import { validDominoLogicProgress, type DominoLogicProgress } from '../games/dominoLogic'
import { validGlyphMatchProgress, type GlyphMatchProgress } from '../games/glyphMatch'
import { validVertexProgress, type VertexProgress } from '../games/vertex'
import { validTilesProgress, type TilesProgress } from '../games/tiles'

export const ARCADE_DATA_KEY = 'arcade.local-data.v1'

export interface ArcadeBests {
  snake: number | null
  reaction: number | null
  pattern: number | null
  breakout: number | null
  pong: number | null
  invaders: number | null
  asteroids: number | null
  missileCommand: number | null
  blockDrop: number | null
  wordPuzzle: number | null
  connections: number | null
  spellingBee: number | null
  strands: number | null
  sudoku: number | null
  miniCrossword: number | null
  letterBoxed: number | null
  dominoLogic: number | null
  glyphMatch: number | null
  vertex: number | null
  tiles: number | null
}

export interface ArcadeData {
  version: 1
  bests: ArcadeBests
  dailyPatternCompletedDate: string | null
  dailyWordGame: DailyWordProgress | null
  dailyConnectionsGame: ConnectionsProgress | null
  dailySpellingBeeGame: SpellingBeeProgress | null
  dailyStrandsGame: StrandsProgress | null
  dailySudokuGame: SudokuProgress | null
  dailyMiniCrosswordGame: MiniCrosswordProgress | null
  dailyLetterBoxedGame: LetterBoxedProgress | null
  dailyDominoLogicGame: DominoLogicProgress | null
  dailyGlyphMatchGame: GlyphMatchProgress | null
  dailyVertexGame: VertexProgress | null
  dailyTilesGame: TilesProgress | null
  preferences: {
    reduceMotion: boolean
    soundEffects: boolean
    pongDifficulty: PongDifficulty
  }
}

export function withImprovedBest(data: ArcadeData, game: keyof ArcadeBests, candidate: number): ArcadeData | null {
  if (!Number.isSafeInteger(candidate) || candidate < 0 || (game !== 'reaction' && game !== 'wordPuzzle' && game !== 'connections' && game !== 'strands' && game !== 'sudoku' && game !== 'miniCrossword' && game !== 'letterBoxed' && game !== 'dominoLogic' && game !== 'glyphMatch' && game !== 'vertex' && game !== 'tiles' && candidate === 0)) return null
  const previous = data.bests[game]
  const lowerIsBetter = game === 'reaction' || game === 'wordPuzzle' || game === 'connections' || game === 'strands' || game === 'sudoku' || game === 'miniCrossword' || game === 'letterBoxed' || game === 'dominoLogic' || game === 'glyphMatch' || game === 'vertex' || game === 'tiles'
  const improved = previous === null || (lowerIsBetter ? candidate < previous : candidate > previous)
  if (!improved) return null
  return { ...data, bests: { ...data.bests, [game]: candidate } }
}

export function withDailyPatternCompletion(data: ArcadeData, date: string): ArcadeData | null {
  if (!validUtcDateKey(date)) return null
  return { ...data, dailyPatternCompletedDate: date }
}

export function withDailyWordGame(data: ArcadeData, progress: DailyWordProgress): ArcadeData | null {
  if (!validDailyWordProgress(progress)) return null
  return { ...data, dailyWordGame: { date: progress.date, guesses: [...progress.guesses], phase: progress.phase } }
}

export function withDailyConnectionsGame(data: ArcadeData, progress: ConnectionsProgress): ArcadeData | null {
  if (!validConnectionsProgress(progress)) return null
  return {
    ...data,
    dailyConnectionsGame: {
      date: progress.date,
      solvedGroupIds: [...progress.solvedGroupIds],
      selectedWords: [...progress.selectedWords],
      mistakes: progress.mistakes,
      phase: progress.phase,
    },
  }
}

export function withDailySpellingBeeGame(data: ArcadeData, progress: SpellingBeeProgress): ArcadeData | null {
  if (!validSpellingBeeProgress(progress)) return null
  return { ...data, dailySpellingBeeGame: { date: progress.date, foundWords: [...progress.foundWords], phase: progress.phase } }
}

export function withDailyStrandsGame(data: ArcadeData, progress: StrandsProgress): ArcadeData | null {
  if (!validStrandsProgress(progress)) return null
  return { ...data, dailyStrandsGame: { date: progress.date, foundWords: [...progress.foundWords], hintsUsed: progress.hintsUsed, hintedCells: [...progress.hintedCells] } }
}

export function withDailySudokuGame(data: ArcadeData, progress: SudokuProgress): ArcadeData | null {
  if (!validSudokuProgress(progress)) return null
  return {
    ...data,
    dailySudokuGame: {
      date: progress.date,
      board: [...progress.board],
      hintsUsed: progress.hintsUsed,
      hintedCells: [...progress.hintedCells],
    },
  }
}

export function withDailyMiniCrosswordGame(data: ArcadeData, progress: MiniCrosswordProgress): ArcadeData | null {
  if (!validMiniCrosswordProgress(progress)) return null
  return {
    ...data,
    dailyMiniCrosswordGame: {
      date: progress.date,
      board: [...progress.board],
      hintsUsed: progress.hintsUsed,
      hintedCells: [...progress.hintedCells],
    },
  }
}

export function withDailyLetterBoxedGame(data: ArcadeData, progress: LetterBoxedProgress): ArcadeData | null {
  if (!validLetterBoxedProgress(progress)) return null
  return { ...data, dailyLetterBoxedGame: { date: progress.date, words: [...progress.words] } }
}

export function withDailyDominoLogicGame(data: ArcadeData, progress: DominoLogicProgress): ArcadeData | null {
  if (!validDominoLogicProgress(progress)) return null
  return {
    ...data,
    dailyDominoLogicGame: {
      date: progress.date,
      placements: progress.placements.map((placement) => ({ ...placement })),
      undos: progress.undos,
    },
  }
}

export function withDailyGlyphMatchGame(data: ArcadeData, progress: GlyphMatchProgress): ArcadeData | null {
  if (!validGlyphMatchProgress(progress)) return null
  return { ...data, dailyGlyphMatchGame: { date: progress.date, matchedIndices: [...progress.matchedIndices], moves: progress.moves } }
}

export function withDailyVertexGame(data: ArcadeData, progress: VertexProgress): ArcadeData | null {
  if (!validVertexProgress(progress)) return null
  return { ...data, dailyVertexGame: { date: progress.date, selectedEdges: [...progress.selectedEdges], moves: progress.moves } }
}

export function withDailyTilesGame(data: ArcadeData, progress: TilesProgress): ArcadeData | null {
  if (!validTilesProgress(progress)) return null
  return { ...data, dailyTilesGame: { date: progress.date, clearedIndices: [...progress.clearedIndices], moves: progress.moves, mistakes: progress.mistakes } }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function emptyArcadeData(): ArcadeData {
  return {
    version: 1,
    bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null, letterBoxed: null, dominoLogic: null, glyphMatch: null, vertex: null, tiles: null },
    dailyPatternCompletedDate: null,
    dailyWordGame: null,
    dailyConnectionsGame: null,
    dailySpellingBeeGame: null,
    dailyStrandsGame: null,
    dailySudokuGame: null,
    dailyMiniCrosswordGame: null,
    dailyLetterBoxedGame: null,
    dailyDominoLogicGame: null,
    dailyGlyphMatchGame: null,
    dailyVertexGame: null,
    dailyTilesGame: null,
    preferences: { reduceMotion: false, soundEffects: false, pongDifficulty: 'steady' },
  }
}

export function clearArcadeBests(data: ArcadeData): ArcadeData {
  return { ...data, bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null, letterBoxed: null, dominoLogic: null, glyphMatch: null, vertex: null, tiles: null } }
}

export function readArcadeData(storage?: StorageLike): ArcadeData {
  try {
    const target = storage ?? getBrowserStorage()
    if (!target) return emptyArcadeData()
    const raw = target.getItem(ARCADE_DATA_KEY)
    if (!raw) return emptyArcadeData()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1) return emptyArcadeData()

    const bests = isRecord(parsed.bests) ? parsed.bests : {}
    const preferences = isRecord(parsed.preferences) ? parsed.preferences : {}
    return {
      version: 1,
      dailyPatternCompletedDate: validUtcDateKey(parsed.dailyPatternCompletedDate) ? parsed.dailyPatternCompletedDate : null,
      dailyWordGame: validDailyWordProgress(parsed.dailyWordGame) ? parsed.dailyWordGame : null,
      dailyConnectionsGame: validConnectionsProgress(parsed.dailyConnectionsGame) ? parsed.dailyConnectionsGame : null,
      dailySpellingBeeGame: validSpellingBeeProgress(parsed.dailySpellingBeeGame) ? parsed.dailySpellingBeeGame : null,
      dailyStrandsGame: validStrandsProgress(parsed.dailyStrandsGame) ? parsed.dailyStrandsGame : null,
      dailySudokuGame: validSudokuProgress(parsed.dailySudokuGame) ? parsed.dailySudokuGame : null,
      dailyMiniCrosswordGame: validMiniCrosswordProgress(parsed.dailyMiniCrosswordGame) ? parsed.dailyMiniCrosswordGame : null,
      dailyLetterBoxedGame: validLetterBoxedProgress(parsed.dailyLetterBoxedGame) ? parsed.dailyLetterBoxedGame : null,
      dailyDominoLogicGame: validDominoLogicProgress(parsed.dailyDominoLogicGame) ? parsed.dailyDominoLogicGame : null,
      dailyGlyphMatchGame: validGlyphMatchProgress(parsed.dailyGlyphMatchGame) ? parsed.dailyGlyphMatchGame : null,
      dailyVertexGame: validVertexProgress(parsed.dailyVertexGame) ? parsed.dailyVertexGame : null,
      dailyTilesGame: validTilesProgress(parsed.dailyTilesGame) ? parsed.dailyTilesGame : null,
      bests: {
        snake: validRecord(bests.snake),
        reaction: validRecord(bests.reaction),
        pattern: validRecord(bests.pattern),
        breakout: validRecord(bests.breakout),
        pong: validRecord(bests.pong),
        invaders: validRecord(bests.invaders),
        asteroids: validRecord(bests.asteroids),
        missileCommand: validRecord(bests.missileCommand),
        blockDrop: validRecord(bests.blockDrop),
        wordPuzzle: validRecord(bests.wordPuzzle),
        connections: validRecord(bests.connections),
        spellingBee: validRecord(bests.spellingBee),
        strands: validRecord(bests.strands),
        sudoku: validRecord(bests.sudoku),
        miniCrossword: validRecord(bests.miniCrossword),
        letterBoxed: validRecord(bests.letterBoxed),
        dominoLogic: validRecord(bests.dominoLogic),
        glyphMatch: validRecord(bests.glyphMatch),
        vertex: validRecord(bests.vertex),
        tiles: validRecord(bests.tiles),
      },
      preferences: { reduceMotion: preferences.reduceMotion === true, soundEffects: preferences.soundEffects === true, pongDifficulty: validPongDifficulty(preferences.pongDifficulty) },
    }
  } catch {
    return emptyArcadeData()
  }
}

export function writeArcadeData(data: ArcadeData, storage?: StorageLike): boolean {
  try {
    const target = storage ?? getBrowserStorage()
    if (!target) return false
    target.setItem(ARCADE_DATA_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validRecord(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function validUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(timestamp.getTime()) && timestamp.toISOString().slice(0, 10) === value
}

function validDailyWordProgress(value: unknown): value is DailyWordProgress {
  return isRecord(value)
    && validUtcDateKey(value.date)
    && Array.isArray(value.guesses)
    && value.guesses.length <= 6
    && value.guesses.every((guess) => typeof guess === 'string' && /^[A-Z]{5}$/.test(guess))
    && (value.phase === 'playing' || value.phase === 'won' || value.phase === 'lost')
}

function validPongDifficulty(value: unknown): PongDifficulty {
  return value === 'calm' || value === 'steady' || value === 'quick' ? value : 'steady'
}
