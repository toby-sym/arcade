import { describe, expect, it } from 'vitest'
import { ARCADE_DATA_KEY, clearArcadeBests, emptyArcadeData, readArcadeData, withDailyConnectionsGame, withDailyMiniCrosswordGame, withDailyPatternCompletion, withDailySpellingBeeGame, withDailyStrandsGame, withDailySudokuGame, withDailyWordGame, withImprovedBest, writeArcadeData } from './arcadeData'

class MemoryStorage {
  key: string | null = null
  value: string | null = null
  getItem(key: string) { return this.key === key ? this.value : null }
  setItem(key: string, value: string) { this.key = key; this.value = value }
}

describe('browser-local Arcade data', () => {
  it('returns an empty starting point without saved data', () => {
    expect(readArcadeData(new MemoryStorage())).toEqual(emptyArcadeData())
  })

  it('round-trips local bests and the motion preference', () => {
    const storage = new MemoryStorage()
    const saved = {
      version: 1 as const,
      dailyPatternCompletedDate: '2026-11-19',
      dailyWordGame: { date: '2026-11-19', guesses: ['CRANE'], phase: 'playing' as const },
      dailyConnectionsGame: null,
      dailySpellingBeeGame: null,
      dailyStrandsGame: null,
      dailySudokuGame: null,
      dailyMiniCrosswordGame: null,
      bests: { snake: 12, reaction: 238, pattern: 4, breakout: 120, pong: 3, invaders: 90, asteroids: 220, missileCommand: 340, blockDrop: 420, wordPuzzle: 4, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null },
      preferences: { reduceMotion: true, soundEffects: true, pongDifficulty: 'quick' as const },
    }

    expect(writeArcadeData(saved, storage)).toBe(true)
    expect(storage.key).toBe(ARCADE_DATA_KEY)
    expect(readArcadeData(storage)).toEqual(saved)
  })

  it('keeps the highest scores and the fastest reaction time', () => {
    const initial = emptyArcadeData()
    const snakeRecord = withImprovedBest(initial, 'snake', 8)
    const reactionRecord = withImprovedBest(snakeRecord!, 'reaction', 240)

    expect(withImprovedBest(reactionRecord!, 'snake', 7)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'reaction', 245)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'pattern', 0)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'reaction', 235)?.bests.reaction).toBe(235)
    expect(withImprovedBest(reactionRecord!, 'pattern', 3)?.bests.pattern).toBe(3)
    expect(withImprovedBest(reactionRecord!, 'breakout', 120)?.bests.breakout).toBe(120)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, breakout: 120 } }, 'breakout', 100)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'pong', 3)?.bests.pong).toBe(3)
    expect(withImprovedBest(reactionRecord!, 'invaders', 80)?.bests.invaders).toBe(80)
    expect(withImprovedBest(reactionRecord!, 'asteroids', 220)?.bests.asteroids).toBe(220)
    expect(withImprovedBest(reactionRecord!, 'missileCommand', 340)?.bests.missileCommand).toBe(340)
    expect(withImprovedBest(reactionRecord!, 'blockDrop', 420)?.bests.blockDrop).toBe(420)
    expect(withImprovedBest(reactionRecord!, 'wordPuzzle', 4)?.bests.wordPuzzle).toBe(4)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, wordPuzzle: 3 } }, 'wordPuzzle', 4)).toBeNull()
  })

  it('clears all records without changing the saved preferences or original data', () => {
    const initial = {
      version: 1 as const,
      dailyPatternCompletedDate: '2026-11-19',
      dailyWordGame: { date: '2026-11-19', guesses: ['CRANE'], phase: 'playing' as const },
      dailyConnectionsGame: { date: '2026-11-19', solvedGroupIds: ['bicycle'], selectedWords: ['PEDAL'], mistakes: 1, phase: 'playing' as const },
      dailySpellingBeeGame: { date: '2026-11-19', foundWords: ['ANGER'], phase: 'playing' as const },
      dailyStrandsGame: { date: '2026-11-19', foundWords: ['TRACE'], hintsUsed: 1, hintedCells: [1] },
      dailySudokuGame: { date: '2026-11-19', board: Array(81).fill(''), hintsUsed: 1, hintedCells: [4] },
      dailyMiniCrosswordGame: { date: '2026-11-19', board: Array(25).fill(''), hintsUsed: 1, hintedCells: [4] },
      bests: { snake: 12, reaction: 238, pattern: 4, breakout: 120, pong: 3, invaders: 90, asteroids: 220, missileCommand: 340, blockDrop: 420, wordPuzzle: 4, connections: 2, spellingBee: 100, strands: 2, sudoku: 3, miniCrossword: 4 },
      preferences: { reduceMotion: true, soundEffects: true, pongDifficulty: 'quick' as const },
    }
    expect(clearArcadeBests(initial)).toEqual({
      version: 1,
      dailyPatternCompletedDate: '2026-11-19',
      dailyWordGame: { date: '2026-11-19', guesses: ['CRANE'], phase: 'playing' },
      dailyConnectionsGame: { date: '2026-11-19', solvedGroupIds: ['bicycle'], selectedWords: ['PEDAL'], mistakes: 1, phase: 'playing' },
      dailySpellingBeeGame: { date: '2026-11-19', foundWords: ['ANGER'], phase: 'playing' },
      dailyStrandsGame: { date: '2026-11-19', foundWords: ['TRACE'], hintsUsed: 1, hintedCells: [1] },
      dailySudokuGame: { date: '2026-11-19', board: Array(81).fill(''), hintsUsed: 1, hintedCells: [4] },
      dailyMiniCrosswordGame: { date: '2026-11-19', board: Array(25).fill(''), hintsUsed: 1, hintedCells: [4] },
      bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null },
      preferences: { reduceMotion: true, soundEffects: true, pongDifficulty: 'quick' },
    })
    expect(initial.bests.snake).toBe(12)
  })

  it('reads back saved fields and discards malformed records', () => {
    const storage = new MemoryStorage()
    storage.key = ARCADE_DATA_KEY
    storage.value = JSON.stringify({
      version: 1,
      dailyPatternCompletedDate: 'not-a-date',
      dailyWordGame: { date: 'not-a-date', guesses: [], phase: 'playing' },
      dailyConnectionsGame: { date: '2026-11-19', solvedGroupIds: [], selectedWords: ['NOPE'], mistakes: 9, phase: 'playing' },
      dailySpellingBeeGame: { date: '2026-11-19', foundWords: ['NOT-A-WORD'], phase: 'playing' },
      bests: { snake: 9, reaction: -40, pattern: 2.5, breakout: 1.2, pong: -1, invaders: -5, asteroids: -10, missileCommand: -25, blockDrop: -40 },
      preferences: { reduceMotion: true, soundEffects: 'yes', pongDifficulty: 'too-fast' },
    })

    expect(readArcadeData(storage)).toEqual({
      version: 1,
      dailyPatternCompletedDate: null,
      dailyWordGame: null,
      dailyConnectionsGame: null,
      dailySpellingBeeGame: null,
      dailyStrandsGame: null,
      dailySudokuGame: null,
      dailyMiniCrosswordGame: null,
      bests: { snake: 9, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null },
      preferences: { reduceMotion: true, soundEffects: false, pongDifficulty: 'steady' },
    })

    storage.value = JSON.stringify({ version: 1, preferences: { reduceMotion: true, pongDifficulty: 'quick' } })
    expect(readArcadeData(storage).preferences).toEqual({ reduceMotion: true, soundEffects: false, pongDifficulty: 'quick' })
  })

  it('records only valid calendar dates for the shared daily challenge', () => {
    const initial = emptyArcadeData()
    expect(withDailyPatternCompletion(initial, '2026-11-19')?.dailyPatternCompletedDate).toBe('2026-11-19')
    expect(withDailyPatternCompletion(initial, '2026-02-31')).toBeNull()
    expect(initial.dailyPatternCompletedDate).toBeNull()
  })

  it('saves one daily word result locally and rejects malformed progress', () => {
    const initial = emptyArcadeData()
    const saved = withDailyWordGame(initial, { date: '2026-11-19', guesses: ['CRANE'], phase: 'playing' })

    expect(saved?.dailyWordGame).toEqual({ date: '2026-11-19', guesses: ['CRANE'], phase: 'playing' })
    expect(withDailyWordGame(initial, { date: '2026-02-30', guesses: [], phase: 'playing' })).toBeNull()
    expect(withDailyWordGame(initial, { date: '2026-11-19', guesses: ['NOPE'], phase: 'playing' })).toBeNull()
    expect(initial.dailyWordGame).toBeNull()
  })

  it('saves daily Connections progress and keeps the best fewest mistakes', () => {
    const initial = emptyArcadeData()
    const progress = { date: '2026-11-19', solvedGroupIds: ['bicycle'], selectedWords: ['PEDAL'], mistakes: 1, phase: 'playing' as const }
    const saved = withDailyConnectionsGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'connections', 0)

    expect(saved?.dailyConnectionsGame).toEqual(progress)
    expect(firstBest?.bests.connections).toBe(0)
    expect(withImprovedBest(firstBest!, 'connections', 1)).toBeNull()
    expect(withDailyConnectionsGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyConnectionsGame(initial, { ...progress, selectedWords: ['NOT-A-WORD'] })).toBeNull()
  })

  it('saves daily Spelling Bee progress and keeps the highest score', () => {
    const initial = emptyArcadeData()
    const progress = { date: '2026-11-19', foundWords: ['ANGER', 'ORANGES'], phase: 'playing' as const }
    const saved = withDailySpellingBeeGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'spellingBee', 15)

    expect(saved?.dailySpellingBeeGame).toEqual(progress)
    expect(firstBest?.bests.spellingBee).toBe(15)
    expect(withImprovedBest(firstBest!, 'spellingBee', 14)).toBeNull()
    expect(withDailySpellingBeeGame(initial, { date: '2026-02-30', foundWords: [], phase: 'playing' })).toBeNull()
    expect(withDailySpellingBeeGame(initial, { date: '2026-11-19', foundWords: ['NOT-A-WORD'], phase: 'playing' })).toBeNull()
  })

  it('saves daily Strands progress and keeps the fewest hints', () => {
    const initial = emptyArcadeData()
    const progress = { date: '2026-11-19', foundWords: ['TRACE'], hintsUsed: 1, hintedCells: [7] }
    const saved = withDailyStrandsGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'strands', 0)

    expect(saved?.dailyStrandsGame).toEqual(progress)
    expect(firstBest?.bests.strands).toBe(0)
    expect(withImprovedBest(firstBest!, 'strands', 1)).toBeNull()
    expect(withDailyStrandsGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyStrandsGame(initial, { ...progress, foundWords: ['NOT-A-WORD'] })).toBeNull()
    expect(withDailyStrandsGame(initial, { ...progress, hintedCells: [48] })).toBeNull()
  })

  it('saves a daily Sudoku board and keeps the fewest hints', () => {
    const initial = emptyArcadeData()
    const progress = { date: '2026-11-19', board: Array(81).fill(''), hintsUsed: 2, hintedCells: [4, 13] }
    const saved = withDailySudokuGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'sudoku', 0)

    expect(saved?.dailySudokuGame).toEqual(progress)
    expect(firstBest?.bests.sudoku).toBe(0)
    expect(withImprovedBest(firstBest!, 'sudoku', 1)).toBeNull()
    expect(withDailySudokuGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailySudokuGame(initial, { ...progress, board: ['bad'] })).toBeNull()
  })

  it('saves a daily mini crossword and keeps the fewest hints', () => {
    const initial = emptyArcadeData()
    const progress = { date: '2026-11-19', board: Array(25).fill(''), hintsUsed: 1, hintedCells: [6] }
    const saved = withDailyMiniCrosswordGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'miniCrossword', 0)

    expect(saved?.dailyMiniCrosswordGame).toEqual(progress)
    expect(firstBest?.bests.miniCrossword).toBe(0)
    expect(withImprovedBest(firstBest!, 'miniCrossword', 1)).toBeNull()
    expect(withDailyMiniCrosswordGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyMiniCrosswordGame(initial, { ...progress, board: ['bad'] })).toBeNull()
  })

  it('uses defaults for unknown versions, corrupt JSON, and unavailable storage', () => {
    const storage = new MemoryStorage()
    storage.key = ARCADE_DATA_KEY
    storage.value = '{broken'
    expect(readArcadeData(storage)).toEqual(emptyArcadeData())
    storage.value = JSON.stringify({ version: 2, bests: { snake: 100 } })
    expect(readArcadeData(storage)).toEqual(emptyArcadeData())

    const unavailable = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
    }
    expect(readArcadeData(unavailable)).toEqual(emptyArcadeData())
    expect(writeArcadeData(emptyArcadeData(), unavailable)).toBe(false)
  })
})
