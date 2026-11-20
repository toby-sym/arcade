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
import { validPipsProgress, type PipsProgress } from '../games/pips'
import { validDailyCrosswordProgress, type DailyCrosswordProgress } from '../games/dailyCrossword'
import { isMinesweeperProgress, type MinesweeperProgress } from '../games/minesweeper'
import { validCipherCircuitProgress, type CipherCircuitProgress } from '../games/cipherCircuit'
import { validColorConduitProgress, type ColorConduitProgress } from '../games/colorConduit'
import { isGravityLoomProgress, type GravityLoomProgress } from '../games/gravityLoom'
import { validTideglassProgress, type TideglassProgress } from '../games/tideglass'

export const ARCADE_DATA_KEY = 'arcade.local-data.v1'
export const ARCADE_BACKUP_MAX_BYTES = 1_000_000

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
  pips: number | null
  crossword: number | null
  minesweeper: number | null
  mazeDash: number | null
  skylineSkip: number | null
  cipherCircuit: number | null
  orbitCourier: number | null
  colorConduit: number | null
  switchyard: number | null
  prismDash: number | null
  gravityLoom: number | null
  tideglass: number | null
  skyhook: number | null
  pocketPinball: number | null
  neonRally: number | null
  moonshot: number | null
  beatBeacon: number | null
  tuningFork: number | null
  magnetron: number | null
  keystone: number | null
  beamworks: number | null
  rackRun: number | null
  pinParade: number | null
  deckhand: number | null
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
  dailyPipsGame: PipsProgress | null
  dailyCrosswordGame: DailyCrosswordProgress | null
  dailyMinesweeperGame: MinesweeperProgress | null
  dailyCipherCircuitGame: CipherCircuitProgress | null
  dailyColorConduitGame: ColorConduitProgress | null
  dailyGravityLoomGame: GravityLoomProgress | null
  dailyTideglassGame: TideglassProgress | null
  preferences: {
    reduceMotion: boolean
    soundEffects: boolean
    pongDifficulty: PongDifficulty
  }
}

export function withImprovedBest(data: ArcadeData, game: keyof ArcadeBests, candidate: number): ArcadeData | null {
  if (!Number.isSafeInteger(candidate) || candidate < 0 || (game !== 'reaction' && game !== 'wordPuzzle' && game !== 'connections' && game !== 'strands' && game !== 'sudoku' && game !== 'miniCrossword' && game !== 'letterBoxed' && game !== 'dominoLogic' && game !== 'glyphMatch' && game !== 'vertex' && game !== 'tiles' && game !== 'pips' && game !== 'crossword' && game !== 'minesweeper' && game !== 'cipherCircuit' && game !== 'colorConduit' && game !== 'gravityLoom' && game !== 'tideglass' && game !== 'neonRally' && game !== 'moonshot' && game !== 'beatBeacon' && game !== 'tuningFork' && game !== 'magnetron' && game !== 'keystone' && game !== 'beamworks' && game !== 'pinParade' && candidate === 0)) return null
  const previous = data.bests[game]
  const lowerIsBetter = game === 'reaction' || game === 'wordPuzzle' || game === 'connections' || game === 'strands' || game === 'sudoku' || game === 'miniCrossword' || game === 'letterBoxed' || game === 'dominoLogic' || game === 'glyphMatch' || game === 'vertex' || game === 'tiles' || game === 'pips' || game === 'crossword' || game === 'minesweeper' || game === 'cipherCircuit' || game === 'colorConduit' || game === 'gravityLoom' || game === 'tideglass' || game === 'neonRally' || game === 'moonshot' || game === 'magnetron' || game === 'keystone' || game === 'beamworks' || game === 'rackRun' || game === 'deckhand'
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

export function withDailyPipsGame(data: ArcadeData, progress: PipsProgress): ArcadeData | null {
  if (!validPipsProgress(progress)) return null
  return { ...data, dailyPipsGame: { date: progress.date, placements: progress.placements.map((placement) => ({ ...placement })), undos: progress.undos } }
}

export function withDailyCrosswordGame(data: ArcadeData, progress: DailyCrosswordProgress): ArcadeData | null {
  if (!validDailyCrosswordProgress(progress)) return null
  return {
    ...data,
    dailyCrosswordGame: {
      date: progress.date,
      board: [...progress.board],
      hintsUsed: progress.hintsUsed,
      hintedCells: [...progress.hintedCells],
    },
  }
}

export function withDailyMinesweeperGame(data: ArcadeData, progress: MinesweeperProgress): ArcadeData | null {
  if (!isMinesweeperProgress(progress)) return null
  return { ...data, dailyMinesweeperGame: { ...progress, revealed: [...progress.revealed], flagged: [...progress.flagged] } }
}

export function withDailyCipherCircuitGame(data: ArcadeData, progress: CipherCircuitProgress): ArcadeData | null {
  if (!validCipherCircuitProgress(progress)) return null
  return {
    ...data,
    dailyCipherCircuitGame: {
      date: progress.date,
      guesses: progress.guesses.map((guess) => [...guess]),
      activeGuess: [...progress.activeGuess],
      phase: progress.phase,
    },
  }
}

export function withDailyColorConduitGame(data: ArcadeData, progress: ColorConduitProgress): ArcadeData | null {
  if (!validColorConduitProgress(progress)) return null
  return {
    ...data,
    dailyColorConduitGame: {
      date: progress.date,
      paths: progress.paths.map((path) => [...path]),
      activeSignal: progress.activeSignal,
      moves: progress.moves,
      mistakes: progress.mistakes,
      elapsedSeconds: progress.elapsedSeconds,
    },
  }
}

export function withDailyGravityLoomGame(data: ArcadeData, progress: GravityLoomProgress | null): ArcadeData | null {
  if (progress === null) return { ...data, dailyGravityLoomGame: null }
  if (!isGravityLoomProgress(progress)) return null
  return {
    ...data,
    dailyGravityLoomGame: {
      date: progress.date,
      stageIndex: progress.stageIndex,
      completedStageMoves: [...progress.completedStageMoves],
      currentMoves: [...progress.currentMoves],
      phase: progress.phase,
    },
  }
}

export function withDailyTideglassGame(data: ArcadeData, progress: TideglassProgress | null): ArcadeData | null {
  if (progress === null) return { ...data, dailyTideglassGame: null }
  if (!validTideglassProgress(progress)) return null
  return {
    ...data,
    dailyTideglassGame: {
      date: progress.date,
      actions: progress.actions.map((action) => ({ ...action })),
      phase: progress.phase,
    },
  }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function emptyArcadeData(): ArcadeData {
  return {
    version: 1,
    bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null, letterBoxed: null, dominoLogic: null, glyphMatch: null, vertex: null, tiles: null, pips: null, crossword: null, minesweeper: null, mazeDash: null, skylineSkip: null, cipherCircuit: null, orbitCourier: null, colorConduit: null, switchyard: null, prismDash: null, gravityLoom: null, tideglass: null, skyhook: null, pocketPinball: null, neonRally: null, moonshot: null, beatBeacon: null, tuningFork: null, magnetron: null, keystone: null, beamworks: null, rackRun: null, pinParade: null, deckhand: null },
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
    dailyPipsGame: null,
    dailyCrosswordGame: null,
    dailyMinesweeperGame: null,
    dailyCipherCircuitGame: null,
    dailyColorConduitGame: null,
    dailyGravityLoomGame: null,
    dailyTideglassGame: null,
    preferences: { reduceMotion: false, soundEffects: false, pongDifficulty: 'steady' },
  }
}

export function clearArcadeBests(data: ArcadeData): ArcadeData {
  return { ...data, bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null, letterBoxed: null, dominoLogic: null, glyphMatch: null, vertex: null, tiles: null, pips: null, crossword: null, minesweeper: null, mazeDash: null, skylineSkip: null, cipherCircuit: null, orbitCourier: null, colorConduit: null, switchyard: null, prismDash: null, gravityLoom: null, tideglass: null, skyhook: null, pocketPinball: null, neonRally: null, moonshot: null, beatBeacon: null, tuningFork: null, magnetron: null, keystone: null, beamworks: null, rackRun: null, pinParade: null, deckhand: null } }
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
      dailyPipsGame: validPipsProgress(parsed.dailyPipsGame) ? parsed.dailyPipsGame : null,
      dailyCrosswordGame: validDailyCrosswordProgress(parsed.dailyCrosswordGame) ? parsed.dailyCrosswordGame : null,
      dailyMinesweeperGame: isMinesweeperProgress(parsed.dailyMinesweeperGame) ? parsed.dailyMinesweeperGame : null,
      dailyCipherCircuitGame: validCipherCircuitProgress(parsed.dailyCipherCircuitGame) ? parsed.dailyCipherCircuitGame : null,
      dailyColorConduitGame: validColorConduitProgress(parsed.dailyColorConduitGame) ? parsed.dailyColorConduitGame : null,
      dailyGravityLoomGame: isGravityLoomProgress(parsed.dailyGravityLoomGame) ? parsed.dailyGravityLoomGame : null,
      dailyTideglassGame: validTideglassProgress(parsed.dailyTideglassGame) ? parsed.dailyTideglassGame : null,
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
        pips: validRecord(bests.pips),
        crossword: validRecord(bests.crossword),
        minesweeper: validRecord(bests.minesweeper),
        mazeDash: validRecord(bests.mazeDash),
        skylineSkip: validRecord(bests.skylineSkip),
        cipherCircuit: validRecord(bests.cipherCircuit),
        orbitCourier: validRecord(bests.orbitCourier),
        colorConduit: validRecord(bests.colorConduit),
        switchyard: validRecord(bests.switchyard),
        prismDash: validRecord(bests.prismDash),
        gravityLoom: validRecord(bests.gravityLoom),
        tideglass: validRecord(bests.tideglass),
        skyhook: validRecord(bests.skyhook),
        pocketPinball: validRecord(bests.pocketPinball),
        neonRally: validRecord(bests.neonRally),
        moonshot: validRecord(bests.moonshot),
        beatBeacon: validRecord(bests.beatBeacon),
        tuningFork: validRecord(bests.tuningFork),
        magnetron: validRecord(bests.magnetron),
        keystone: validRecord(bests.keystone),
        beamworks: validRecord(bests.beamworks),
        rackRun: validRecord(bests.rackRun),
        pinParade: validRecord(bests.pinParade),
        deckhand: validRecord(bests.deckhand),
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

export function parseArcadeDataBackup(contents: string): ArcadeData | null {
  if (contents.length > ARCADE_BACKUP_MAX_BYTES || new Blob([contents]).size > ARCADE_BACKUP_MAX_BYTES) return null

  try {
    const parsed: unknown = JSON.parse(contents)
    if (!isRecord(parsed) || parsed.version !== 1) return null
    const { bests, preferences } = parsed
    if (!isRecord(bests) || !isRecord(preferences)) return null

    const empty = emptyArcadeData()
    if (!Object.keys(empty).filter((key) => key !== 'dailyMinesweeperGame' && key !== 'dailyCipherCircuitGame' && key !== 'dailyColorConduitGame' && key !== 'dailyGravityLoomGame' && key !== 'dailyTideglassGame').every((key) => key in parsed)) return null
    if (!Object.keys(empty.bests).filter((key) => key !== 'minesweeper' && key !== 'mazeDash' && key !== 'skylineSkip' && key !== 'cipherCircuit' && key !== 'orbitCourier' && key !== 'colorConduit' && key !== 'switchyard' && key !== 'prismDash' && key !== 'gravityLoom' && key !== 'tideglass' && key !== 'skyhook' && key !== 'pocketPinball' && key !== 'neonRally' && key !== 'moonshot' && key !== 'beatBeacon' && key !== 'tuningFork' && key !== 'magnetron' && key !== 'keystone' && key !== 'beamworks' && key !== 'rackRun' && key !== 'pinParade' && key !== 'deckhand').every((key) => {
      const record = bests[key]
      return record === null || (typeof record === 'number' && Number.isSafeInteger(record) && record >= 0)
    })) return null

    if (typeof preferences.reduceMotion !== 'boolean'
      || typeof preferences.soundEffects !== 'boolean'
      || (preferences.pongDifficulty !== 'calm' && preferences.pongDifficulty !== 'steady' && preferences.pongDifficulty !== 'quick')) return null

    const dailyFieldsAreValid = (parsed.dailyPatternCompletedDate === null || validUtcDateKey(parsed.dailyPatternCompletedDate))
      && (parsed.dailyWordGame === null || validDailyWordProgress(parsed.dailyWordGame))
      && (parsed.dailyConnectionsGame === null || validConnectionsProgress(parsed.dailyConnectionsGame))
      && (parsed.dailySpellingBeeGame === null || validSpellingBeeProgress(parsed.dailySpellingBeeGame))
      && (parsed.dailyStrandsGame === null || validStrandsProgress(parsed.dailyStrandsGame))
      && (parsed.dailySudokuGame === null || validSudokuProgress(parsed.dailySudokuGame))
      && (parsed.dailyMiniCrosswordGame === null || validMiniCrosswordProgress(parsed.dailyMiniCrosswordGame))
      && (parsed.dailyLetterBoxedGame === null || validLetterBoxedProgress(parsed.dailyLetterBoxedGame))
      && (parsed.dailyDominoLogicGame === null || validDominoLogicProgress(parsed.dailyDominoLogicGame))
      && (parsed.dailyGlyphMatchGame === null || validGlyphMatchProgress(parsed.dailyGlyphMatchGame))
      && (parsed.dailyVertexGame === null || validVertexProgress(parsed.dailyVertexGame))
      && (parsed.dailyTilesGame === null || validTilesProgress(parsed.dailyTilesGame))
      && (parsed.dailyPipsGame === null || validPipsProgress(parsed.dailyPipsGame))
      && (parsed.dailyCrosswordGame === null || validDailyCrosswordProgress(parsed.dailyCrosswordGame))
      && (parsed.dailyMinesweeperGame === undefined || parsed.dailyMinesweeperGame === null || isMinesweeperProgress(parsed.dailyMinesweeperGame))
      && (parsed.dailyCipherCircuitGame === undefined || parsed.dailyCipherCircuitGame === null || validCipherCircuitProgress(parsed.dailyCipherCircuitGame))
      && (parsed.dailyColorConduitGame === undefined || parsed.dailyColorConduitGame === null || validColorConduitProgress(parsed.dailyColorConduitGame))
      && (parsed.dailyGravityLoomGame === undefined || parsed.dailyGravityLoomGame === null || isGravityLoomProgress(parsed.dailyGravityLoomGame))
      && (parsed.dailyTideglassGame === undefined || parsed.dailyTideglassGame === null || validTideglassProgress(parsed.dailyTideglassGame))
    if (!dailyFieldsAreValid) return null

    return readArcadeData({ getItem: () => contents, setItem: () => {} })
  } catch {
    return null
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
