import { describe, expect, it } from 'vitest'
import { ARCADE_BACKUP_MAX_BYTES, ARCADE_DATA_KEY, MAX_FAVOURITE_GAMES, clearArcadeBests, emptyArcadeData, parseArcadeDataBackup, readArcadeData, withDailyCipherCircuitGame, withDailyColorConduitGame, withDailyGravityLoomGame, withDailyTideglassGame, withDailyTallyMarketGame, withDailyPixelMosaicGame, withDailyConnectionsGame, withDailyCrosswordGame, withDailyDominoLogicGame, withDailyGlyphMatchGame, withDailyLetterBoxedGame, withDailyMiniCrosswordGame, withDailyMinesweeperGame, withDailyPipsGame, withDailyPatternCompletion, withDailySpellingBeeGame, withDailyStrandsGame, withDailySudokuGame, withDailyTilesGame, withDailyVertexGame, withDailyWordGame, withFavouriteGameIds, withImprovedBest, writeArcadeData } from './arcadeData'
import { cipherCircuitProgress, cipherCircuitReducer, createCipherCircuitState } from '../games/cipherCircuit'
import { createGlyphMatchPuzzle } from '../games/glyphMatch'
import { createVertexPuzzle } from '../games/vertex'
import { createTilesPuzzle } from '../games/tiles'
import { createPipsPuzzle } from '../games/pips'
import { createDailyCrosswordPuzzle } from '../games/dailyCrossword'
import { createMinesweeperState, toMinesweeperProgress } from '../games/minesweeper'
import { colorConduitProgress, colorConduitReducer, createColorConduitState } from '../games/colorConduit'
import { createGravityLoomState, gravityLoomProgress, gravityLoomReducer, solveGravityLoomPuzzle } from '../games/gravityLoom'
import { createTideglassState, solveTideglassPuzzle, tideglassProgress, tideglassReducer, tideglassPuzzleForDate } from '../games/tideglass'
import { createTallyMarketState, tallyMarketProgress } from '../games/tallyMarket'

const emptyCrosswordBoard = () => Array.from({ length: 25 }, (_, index) => [3, 4, 20, 21].includes(index) ? '#' : '')
const todayGlyphs = createGlyphMatchPuzzle('2026-11-19').glyphs
const savedGlyphProgress = { date: '2026-11-19', matchedIndices: [0, todayGlyphs.findIndex((glyph, index) => index > 0 && glyph === todayGlyphs[0])], moves: 1 }

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

  it('accepts complete valid backups and rejects malformed or incomplete files', () => {
    const backup = emptyArcadeData()
    backup.bests.snake = 24
    backup.preferences.soundEffects = true
    backup.preferences.favouriteGameIds = ['snake', 'keytrace']
    backup.dailyWordGame = { date: '2026-11-19', guesses: ['CRANE'], phase: 'playing' }

    expect(parseArcadeDataBackup(JSON.stringify(backup))).toEqual(backup)
    const legacyPreferences = { reduceMotion: false, soundEffects: true, pongDifficulty: 'steady' }
    expect(parseArcadeDataBackup(JSON.stringify({ ...backup, preferences: legacyPreferences }))?.preferences.favouriteGameIds).toEqual([])
    expect(parseArcadeDataBackup(JSON.stringify({ ...backup, preferences: { ...backup.preferences, favouriteGameIds: ['snake', 'snake'] } }))).toBeNull()
    expect(parseArcadeDataBackup(JSON.stringify({ ...backup, preferences: { ...backup.preferences, favouriteGameIds: Array.from({ length: MAX_FAVOURITE_GAMES + 1 }, (_, index) => `game${index}`) } }))).toBeNull()
    expect(parseArcadeDataBackup('{bad json')).toBeNull()
    expect(parseArcadeDataBackup(JSON.stringify({ ...backup, version: 2 }))).toBeNull()
    expect(parseArcadeDataBackup(JSON.stringify({ ...backup, bests: { ...backup.bests, snake: -1 } }))).toBeNull()
    expect(parseArcadeDataBackup(JSON.stringify({ ...backup, dailyWordGame: { ...backup.dailyWordGame, guesses: ['NOPE'] } }))).toBeNull()

    const missingDailyField = { ...backup } as Record<string, unknown>
    delete missingDailyField.dailyPipsGame
    expect(parseArcadeDataBackup(JSON.stringify(missingDailyField))).toBeNull()

    const previousVersionBackup = { ...backup, bests: { ...backup.bests } } as Record<string, unknown>
    delete previousVersionBackup.dailyMinesweeperGame
    delete previousVersionBackup.dailyCipherCircuitGame
    delete previousVersionBackup.dailyColorConduitGame
    delete previousVersionBackup.dailyGravityLoomGame
    delete previousVersionBackup.dailyTideglassGame
    delete previousVersionBackup.dailyTallyMarketGame
    delete (previousVersionBackup.bests as Record<string, unknown>).minesweeper
    delete (previousVersionBackup.bests as Record<string, unknown>).mazeDash
    delete (previousVersionBackup.bests as Record<string, unknown>).skylineSkip
    delete (previousVersionBackup.bests as Record<string, unknown>).cipherCircuit
    delete (previousVersionBackup.bests as Record<string, unknown>).orbitCourier
    delete (previousVersionBackup.bests as Record<string, unknown>).colorConduit
    delete (previousVersionBackup.bests as Record<string, unknown>).switchyard
    delete (previousVersionBackup.bests as Record<string, unknown>).prismDash
    delete (previousVersionBackup.bests as Record<string, unknown>).gravityLoom
    delete (previousVersionBackup.bests as Record<string, unknown>).tideglass
    delete (previousVersionBackup.bests as Record<string, unknown>).skyhook
    delete (previousVersionBackup.bests as Record<string, unknown>).pocketPinball
    delete (previousVersionBackup.bests as Record<string, unknown>).neonRally
    delete (previousVersionBackup.bests as Record<string, unknown>).moonshot
    delete (previousVersionBackup.bests as Record<string, unknown>).beatBeacon
    delete (previousVersionBackup.bests as Record<string, unknown>).tuningFork
    delete (previousVersionBackup.bests as Record<string, unknown>).magnetron
    delete (previousVersionBackup.bests as Record<string, unknown>).keystone
    delete (previousVersionBackup.bests as Record<string, unknown>).beamworks
    delete (previousVersionBackup.bests as Record<string, unknown>).rackRun
    delete (previousVersionBackup.bests as Record<string, unknown>).pinParade
    delete (previousVersionBackup.bests as Record<string, unknown>).deckhand
    delete (previousVersionBackup.bests as Record<string, unknown>).latchkey
    delete (previousVersionBackup.bests as Record<string, unknown>).fathom
    delete (previousVersionBackup.bests as Record<string, unknown>).fourfold
    delete (previousVersionBackup.bests as Record<string, unknown>).pegline
    delete (previousVersionBackup.bests as Record<string, unknown>).tallyMarket
    delete (previousVersionBackup.bests as Record<string, unknown>).keytrace
    const parsedPreviousVersion = parseArcadeDataBackup(JSON.stringify(previousVersionBackup))
    expect(parsedPreviousVersion?.dailyMinesweeperGame).toBeNull()
    expect(parsedPreviousVersion?.bests.minesweeper).toBeNull()
    expect(parsedPreviousVersion?.bests.mazeDash).toBeNull()
    expect(parsedPreviousVersion?.bests.skylineSkip).toBeNull()
    expect(parsedPreviousVersion?.dailyCipherCircuitGame).toBeNull()
    expect(parsedPreviousVersion?.bests.cipherCircuit).toBeNull()
    expect(parsedPreviousVersion?.bests.orbitCourier).toBeNull()
    expect(parsedPreviousVersion?.dailyColorConduitGame).toBeNull()
    expect(parsedPreviousVersion?.dailyGravityLoomGame).toBeNull()
    expect(parsedPreviousVersion?.bests.colorConduit).toBeNull()
    expect(parsedPreviousVersion?.bests.switchyard).toBeNull()
    expect(parsedPreviousVersion?.bests.prismDash).toBeNull()
    expect(parsedPreviousVersion?.bests.gravityLoom).toBeNull()
    expect(parsedPreviousVersion?.dailyTideglassGame).toBeNull()
    expect(parsedPreviousVersion?.dailyTallyMarketGame).toBeNull()
    expect(parsedPreviousVersion?.bests.tideglass).toBeNull()
    expect(parsedPreviousVersion?.bests.skyhook).toBeNull()
    expect(parsedPreviousVersion?.bests.pocketPinball).toBeNull()
    expect(parsedPreviousVersion?.bests.neonRally).toBeNull()
    expect(parsedPreviousVersion?.bests.moonshot).toBeNull()
    expect(parsedPreviousVersion?.bests.beatBeacon).toBeNull()
    expect(parsedPreviousVersion?.bests.tuningFork).toBeNull()
    expect(parsedPreviousVersion?.bests.magnetron).toBeNull()
    expect(parsedPreviousVersion?.bests.keystone).toBeNull()
    expect(parsedPreviousVersion?.bests.beamworks).toBeNull()
    expect(parsedPreviousVersion?.bests.rackRun).toBeNull()
    expect(parsedPreviousVersion?.bests.pinParade).toBeNull()
    expect(parsedPreviousVersion?.bests.deckhand).toBeNull()
    expect(parsedPreviousVersion?.bests.latchkey).toBeNull()
    expect(parsedPreviousVersion?.bests.fathom).toBeNull()
    expect(parsedPreviousVersion?.bests.fourfold).toBeNull()
    expect(parsedPreviousVersion?.bests.pegline).toBeNull()
    expect(parsedPreviousVersion?.bests.tallyMarket).toBeNull()
    expect(parsedPreviousVersion?.bests.keytrace).toBeNull()
    expect(parseArcadeDataBackup(' '.repeat(ARCADE_BACKUP_MAX_BYTES + 1))).toBeNull()
  })

  it('keeps favourite game ids unique, capped, and intact when clearing records', () => {
    const initial = emptyArcadeData()
    const favourites = withFavouriteGameIds(initial, ['snake', 'snake', 'tallymarket', 'not-a-game'])
    expect(favourites.preferences.favouriteGameIds).toEqual(['snake', 'tallymarket'])
    expect(clearArcadeBests(favourites).preferences.favouriteGameIds).toEqual(['snake', 'tallymarket'])

    const maximum = withFavouriteGameIds(initial, Array.from({ length: MAX_FAVOURITE_GAMES + 2 }, (_, index) => `game${index}`))
    expect(maximum.preferences.favouriteGameIds).toHaveLength(MAX_FAVOURITE_GAMES)
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
      dailyLetterBoxedGame: null,
      dailyDominoLogicGame: null,
      dailyGlyphMatchGame: null,
      dailyVertexGame: null,
      dailyTilesGame: null,
      dailyPipsGame: null,
      dailyCrosswordGame: null,
      dailyMinesweeperGame: toMinesweeperProgress(createMinesweeperState('2026-11-19')),
      dailyCipherCircuitGame: null,
      dailyColorConduitGame: null,
      dailyGravityLoomGame: null,
      dailyTideglassGame: null,
      dailyTallyMarketGame: null,
      dailyPixelMosaicGame: null,
      bests: { snake: 12, reaction: 238, pattern: 4, breakout: 120, pong: 3, invaders: 90, asteroids: 220, missileCommand: 340, blockDrop: 420, wordPuzzle: 4, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null, letterBoxed: null, dominoLogic: null, glyphMatch: null, vertex: null, tiles: null, pips: null, crossword: null, minesweeper: null, mazeDash: null, skylineSkip: null, cipherCircuit: null, orbitCourier: null, colorConduit: null, switchyard: null, prismDash: null, gravityLoom: null, tideglass: null, skyhook: null, pocketPinball: null, neonRally: null, moonshot: null, beatBeacon: null, tuningFork: null, magnetron: null, keystone: null, beamworks: null, rackRun: null, pinParade: null, deckhand: null, latchkey: null, fathom: null, fourfold: null, pegline: null, tallyMarket: null, keytrace: null, pixelMosaic: null },
      preferences: { reduceMotion: true, soundEffects: true, pongDifficulty: 'quick' as const, favouriteGameIds: ['snake', 'tallymarket'] },
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
    expect(withImprovedBest(reactionRecord!, 'keytrace', 12_400)?.bests.keytrace).toBe(12_400)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, keytrace: 12_400 } }, 'keytrace', 12_500)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, keytrace: 12_400 } }, 'keytrace', 12_300)?.bests.keytrace).toBe(12_300)
    expect(withImprovedBest(reactionRecord!, 'breakout', 120)?.bests.breakout).toBe(120)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, breakout: 120 } }, 'breakout', 100)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'pong', 3)?.bests.pong).toBe(3)
    expect(withImprovedBest(reactionRecord!, 'invaders', 80)?.bests.invaders).toBe(80)
    expect(withImprovedBest(reactionRecord!, 'asteroids', 220)?.bests.asteroids).toBe(220)
    expect(withImprovedBest(reactionRecord!, 'missileCommand', 340)?.bests.missileCommand).toBe(340)
    expect(withImprovedBest(reactionRecord!, 'blockDrop', 420)?.bests.blockDrop).toBe(420)
    expect(withImprovedBest(reactionRecord!, 'mazeDash', 200)?.bests.mazeDash).toBe(200)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, mazeDash: 200 } }, 'mazeDash', 150)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'skylineSkip', 280)?.bests.skylineSkip).toBe(280)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, skylineSkip: 280 } }, 'skylineSkip', 260)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'cipherCircuit', 3)?.bests.cipherCircuit).toBe(3)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, cipherCircuit: 3 } }, 'cipherCircuit', 4)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'orbitCourier', 2200)?.bests.orbitCourier).toBe(2200)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, orbitCourier: 2200 } }, 'orbitCourier', 2100)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'wordPuzzle', 4)?.bests.wordPuzzle).toBe(4)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, wordPuzzle: 3 } }, 'wordPuzzle', 4)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'switchyard', 1450)?.bests.switchyard).toBe(1450)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, switchyard: 1450 } }, 'switchyard', 1200)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'prismDash', 3450)?.bests.prismDash).toBe(3450)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, prismDash: 3450 } }, 'prismDash', 3300)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'gravityLoom', 24)?.bests.gravityLoom).toBe(24)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, gravityLoom: 24 } }, 'gravityLoom', 25)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'tideglass', 24)?.bests.tideglass).toBe(24)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, tideglass: 24 } }, 'tideglass', 25)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'skyhook', 2400)?.bests.skyhook).toBe(2400)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, skyhook: 2400 } }, 'skyhook', 2300)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'pocketPinball', 4800)?.bests.pocketPinball).toBe(4800)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, pocketPinball: 4800 } }, 'pocketPinball', 4700)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'neonRally', 96_540)?.bests.neonRally).toBe(96_540)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, neonRally: 96_540 } }, 'neonRally', 96_541)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, neonRally: 96_540 } }, 'neonRally', 96_539)?.bests.neonRally).toBe(96_539)
    expect(withImprovedBest(reactionRecord!, 'moonshot', 25)?.bests.moonshot).toBe(25)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, moonshot: 25 } }, 'moonshot', 26)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, moonshot: 25 } }, 'moonshot', 24)?.bests.moonshot).toBe(24)
    expect(withImprovedBest(reactionRecord!, 'beatBeacon', 2_450)?.bests.beatBeacon).toBe(2_450)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, beatBeacon: 2_450 } }, 'beatBeacon', 2_449)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, beatBeacon: 2_450 } }, 'beatBeacon', 2_451)?.bests.beatBeacon).toBe(2_451)
    expect(withImprovedBest(reactionRecord!, 'tuningFork', 600)?.bests.tuningFork).toBe(600)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, tuningFork: 600 } }, 'tuningFork', 599)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, tuningFork: 600 } }, 'tuningFork', 700)?.bests.tuningFork).toBe(700)
    expect(withImprovedBest(reactionRecord!, 'magnetron', 64_200)?.bests.magnetron).toBe(64_200)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, magnetron: 64_200 } }, 'magnetron', 65_000)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, magnetron: 64_200 } }, 'magnetron', 63_900)?.bests.magnetron).toBe(63_900)
    expect(withImprovedBest(reactionRecord!, 'keystone', 67)?.bests.keystone).toBe(67)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, keystone: 67 } }, 'keystone', 70)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, keystone: 67 } }, 'keystone', 64)?.bests.keystone).toBe(64)
    expect(withImprovedBest(reactionRecord!, 'beamworks', 7)?.bests.beamworks).toBe(7)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, beamworks: 7 } }, 'beamworks', 8)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, beamworks: 7 } }, 'beamworks', 6)?.bests.beamworks).toBe(6)
    expect(withImprovedBest(reactionRecord!, 'rackRun', 8)?.bests.rackRun).toBe(8)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, rackRun: 8 } }, 'rackRun', 9)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, rackRun: 8 } }, 'rackRun', 7)?.bests.rackRun).toBe(7)
    expect(withImprovedBest(reactionRecord!, 'pinParade', 0)?.bests.pinParade).toBe(0)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, pinParade: 280 } }, 'pinParade', 281)?.bests.pinParade).toBe(281)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, pinParade: 280 } }, 'pinParade', 279)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'deckhand', 95)?.bests.deckhand).toBe(95)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, deckhand: 95 } }, 'deckhand', 100)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, deckhand: 95 } }, 'deckhand', 90)?.bests.deckhand).toBe(90)
    expect(withImprovedBest(reactionRecord!, 'latchkey', 80)?.bests.latchkey).toBe(80)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, latchkey: 80 } }, 'latchkey', 90)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'fathom', 16)?.bests.fathom).toBe(16)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, fathom: 16 } }, 'fathom', 20)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'fourfold', 2)?.bests.fourfold).toBe(2)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, fourfold: 2 } }, 'fourfold', 1)).toBeNull()
    expect(withImprovedBest(reactionRecord!, 'pegline', 23)?.bests.pegline).toBe(23)
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, pegline: 23 } }, 'pegline', 24)).toBeNull()
    expect(withImprovedBest({ ...reactionRecord!, bests: { ...reactionRecord!.bests, pegline: 23 } }, 'pegline', 22)?.bests.pegline).toBe(22)
  })

  it('saves the daily Gravity Loom route and its fewest-tilt record locally', () => {
    const initial = emptyArcadeData()
    let state = gravityLoomReducer(createGravityLoomState('2026-11-19'), { type: 'start' })
    const solution = solveGravityLoomPuzzle(state.puzzles[0]!)!
    state = gravityLoomReducer(state, { type: 'tilt', direction: solution[0]! })
    const progress = gravityLoomProgress(state)!
    const saved = withDailyGravityLoomGame(initial, progress)
    const withBest = withImprovedBest(saved!, 'gravityLoom', 24)
    const storage = new MemoryStorage()

    expect(saved?.dailyGravityLoomGame).toEqual(progress)
    expect(withImprovedBest(withBest!, 'gravityLoom', 25)).toBeNull()
    expect(withDailyGravityLoomGame(saved!, null)?.dailyGravityLoomGame).toBeNull()
    expect(withDailyGravityLoomGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(writeArcadeData(withBest!, storage)).toBe(true)
    expect(readArcadeData(storage)).toEqual(withBest)
    expect(parseArcadeDataBackup(JSON.stringify(withBest))).toEqual(withBest)
  })

  it('saves the daily Tideglass route and its fewest-move record locally', () => {
    const initial = emptyArcadeData()
    const date = '2026-11-19'
    const route = solveTideglassPuzzle(tideglassPuzzleForDate(date))!
    let state = tideglassReducer(createTideglassState(date), { type: 'start' })
    const first = route[0]!
    if (first.type === 'sluice') state = tideglassReducer(state, { type: 'toggle-sluice', index: first.index })
    else {
      state = tideglassReducer(state, { type: 'select', buoy: first.buoy })
      state = tideglassReducer(state, { type: 'move', direction: first.direction })
    }
    const progress = tideglassProgress(state)!
    const saved = withDailyTideglassGame(initial, progress)
    const withBest = withImprovedBest(saved!, 'tideglass', 24)
    const storage = new MemoryStorage()

    expect(saved?.dailyTideglassGame).toEqual(progress)
    expect(withImprovedBest(withBest!, 'tideglass', 25)).toBeNull()
    expect(withImprovedBest(withBest!, 'tideglass', 23)?.bests.tideglass).toBe(23)
    expect(withDailyTideglassGame(saved!, null)?.dailyTideglassGame).toBeNull()
    expect(withDailyTideglassGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(writeArcadeData(withBest!, storage)).toBe(true)
    expect(readArcadeData(storage)).toEqual(withBest)
    expect(parseArcadeDataBackup(JSON.stringify(withBest))).toEqual(withBest)
  })

  it('saves Cipher Circuit progress and its fewest-pulse record locally', () => {
    const initial = emptyArcadeData()
    let state = createCipherCircuitState('2026-11-19')
    state = cipherCircuitReducer(state, { type: 'select', signal: 2 })
    const progress = cipherCircuitProgress(state)
    const saved = withDailyCipherCircuitGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'cipherCircuit', 3)
    const storage = new MemoryStorage()

    expect(saved?.dailyCipherCircuitGame).toEqual(progress)
    expect(firstBest?.bests.cipherCircuit).toBe(3)
    expect(withImprovedBest(firstBest!, 'cipherCircuit', 4)).toBeNull()
    expect(withDailyCipherCircuitGame(initial, { ...progress, date: '2026-02-31' })).toBeNull()
    expect(writeArcadeData(saved!, storage)).toBe(true)
    expect(readArcadeData(storage).dailyCipherCircuitGame).toEqual(progress)
  })

  it('saves Color Conduit routes locally and keeps the fastest completion time', () => {
    let state = createColorConduitState('2026-11-19')
    state = colorConduitReducer(state, { type: 'start' })
    const route = state.puzzle.routes[0]!
    state = colorConduitReducer(state, { type: 'select', signal: route.signal })
    state = colorConduitReducer(state, { type: 'cell', index: route.start })
    const progress = colorConduitProgress(state)
    const saved = withDailyColorConduitGame(emptyArcadeData(), progress)
    const firstBest = withImprovedBest(saved!, 'colorConduit', 82)
    const storage = new MemoryStorage()

    expect(saved?.dailyColorConduitGame).toEqual(progress)
    expect(withImprovedBest(firstBest!, 'colorConduit', 75)?.bests.colorConduit).toBe(75)
    expect(withImprovedBest(firstBest!, 'colorConduit', 90)).toBeNull()
    expect(withDailyColorConduitGame(emptyArcadeData(), { ...progress, date: '2026-02-30' })).toBeNull()
    expect(writeArcadeData(saved!, storage)).toBe(true)
    expect(readArcadeData(storage).dailyColorConduitGame).toEqual(progress)
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
      dailyMiniCrosswordGame: { date: '2026-11-19', board: emptyCrosswordBoard(), hintsUsed: 1, hintedCells: [6] },
      dailyLetterBoxedGame: { date: '2026-11-19', words: ['CRANE'] },
      dailyDominoLogicGame: { date: '2026-11-19', placements: [{ dominoId: 0, firstCell: 0, orientation: 'horizontal' as const, flipped: false }], undos: 1 },
      dailyGlyphMatchGame: savedGlyphProgress,
      dailyVertexGame: { date: '2026-11-19', selectedEdges: [], moves: 0 },
      dailyTilesGame: { date: '2026-11-19', clearedIndices: [], moves: 0, mistakes: 0 },
      dailyPipsGame: null,
      dailyCrosswordGame: null,
      dailyMinesweeperGame: toMinesweeperProgress(createMinesweeperState('2026-11-19')),
      dailyCipherCircuitGame: null,
      dailyColorConduitGame: null,
      dailyGravityLoomGame: null,
      dailyTideglassGame: null,
      dailyTallyMarketGame: null,
      dailyPixelMosaicGame: null,
      bests: { snake: 12, reaction: 238, pattern: 4, breakout: 120, pong: 3, invaders: 90, asteroids: 220, missileCommand: 340, blockDrop: 420, wordPuzzle: 4, connections: 2, spellingBee: 100, strands: 2, sudoku: 3, miniCrossword: 4, letterBoxed: null, dominoLogic: null, glyphMatch: null, vertex: null, tiles: null, pips: null, crossword: null, minesweeper: 61, mazeDash: null, skylineSkip: null, cipherCircuit: null, orbitCourier: null, colorConduit: null, switchyard: null, prismDash: null, gravityLoom: null, tideglass: null, skyhook: null, pocketPinball: null, neonRally: null, moonshot: null, beatBeacon: null, tuningFork: null, magnetron: null, keystone: null, beamworks: null, rackRun: null, pinParade: null, deckhand: null, latchkey: null, fathom: null, fourfold: null, pegline: null, tallyMarket: null, keytrace: null, pixelMosaic: null },
      preferences: { reduceMotion: true, soundEffects: true, pongDifficulty: 'quick' as const, favouriteGameIds: ['snake', 'tallymarket'] },
    }
    expect(clearArcadeBests(initial)).toEqual({
      version: 1,
      dailyPatternCompletedDate: '2026-11-19',
      dailyWordGame: { date: '2026-11-19', guesses: ['CRANE'], phase: 'playing' },
      dailyConnectionsGame: { date: '2026-11-19', solvedGroupIds: ['bicycle'], selectedWords: ['PEDAL'], mistakes: 1, phase: 'playing' },
      dailySpellingBeeGame: { date: '2026-11-19', foundWords: ['ANGER'], phase: 'playing' },
      dailyStrandsGame: { date: '2026-11-19', foundWords: ['TRACE'], hintsUsed: 1, hintedCells: [1] },
      dailySudokuGame: { date: '2026-11-19', board: Array(81).fill(''), hintsUsed: 1, hintedCells: [4] },
      dailyMiniCrosswordGame: { date: '2026-11-19', board: emptyCrosswordBoard(), hintsUsed: 1, hintedCells: [6] },
      dailyLetterBoxedGame: { date: '2026-11-19', words: ['CRANE'] },
      dailyDominoLogicGame: { date: '2026-11-19', placements: [{ dominoId: 0, firstCell: 0, orientation: 'horizontal', flipped: false }], undos: 1 },
      dailyGlyphMatchGame: savedGlyphProgress,
      dailyVertexGame: { date: '2026-11-19', selectedEdges: [], moves: 0 },
      dailyTilesGame: { date: '2026-11-19', clearedIndices: [], moves: 0, mistakes: 0 },
      dailyPipsGame: null,
      dailyCrosswordGame: null,
      dailyMinesweeperGame: toMinesweeperProgress(createMinesweeperState('2026-11-19')),
      dailyCipherCircuitGame: null,
      dailyColorConduitGame: null,
      dailyGravityLoomGame: null,
      dailyTideglassGame: null,
      dailyTallyMarketGame: null,
      dailyPixelMosaicGame: null,
      bests: { snake: null, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null, letterBoxed: null, dominoLogic: null, glyphMatch: null, vertex: null, tiles: null, pips: null, crossword: null, minesweeper: null, mazeDash: null, skylineSkip: null, cipherCircuit: null, orbitCourier: null, colorConduit: null, switchyard: null, prismDash: null, gravityLoom: null, tideglass: null, skyhook: null, pocketPinball: null, neonRally: null, moonshot: null, beatBeacon: null, tuningFork: null, magnetron: null, keystone: null, beamworks: null, rackRun: null, pinParade: null, deckhand: null, latchkey: null, fathom: null, fourfold: null, pegline: null, tallyMarket: null, keytrace: null, pixelMosaic: null },
      preferences: { reduceMotion: true, soundEffects: true, pongDifficulty: 'quick', favouriteGameIds: ['snake', 'tallymarket'] },
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
      dailyTallyMarketGame: null,
      dailyPixelMosaicGame: null,
      bests: { snake: 9, reaction: null, pattern: null, breakout: null, pong: null, invaders: null, asteroids: null, missileCommand: null, blockDrop: null, wordPuzzle: null, connections: null, spellingBee: null, strands: null, sudoku: null, miniCrossword: null, letterBoxed: null, dominoLogic: null, glyphMatch: null, vertex: null, tiles: null, pips: null, crossword: null, minesweeper: null, mazeDash: null, skylineSkip: null, cipherCircuit: null, orbitCourier: null, colorConduit: null, switchyard: null, prismDash: null, gravityLoom: null, tideglass: null, skyhook: null, pocketPinball: null, neonRally: null, moonshot: null, beatBeacon: null, tuningFork: null, magnetron: null, keystone: null, beamworks: null, rackRun: null, pinParade: null, deckhand: null, latchkey: null, fathom: null, fourfold: null, pegline: null, tallyMarket: null, keytrace: null, pixelMosaic: null },
      preferences: { reduceMotion: true, soundEffects: false, pongDifficulty: 'steady', favouriteGameIds: [] },
    })

    storage.value = JSON.stringify({ version: 1, preferences: { reduceMotion: true, pongDifficulty: 'quick' } })
    expect(readArcadeData(storage).preferences).toEqual({ reduceMotion: true, soundEffects: false, pongDifficulty: 'quick', favouriteGameIds: [] })
  })

  it('records only valid calendar dates for the shared daily challenge', () => {
    const initial = emptyArcadeData()
    expect(withDailyPatternCompletion(initial, '2026-11-19')?.dailyPatternCompletedDate).toBe('2026-11-19')
    expect(withDailyPatternCompletion(initial, '2026-02-31')).toBeNull()
    expect(initial.dailyPatternCompletedDate).toBeNull()
  })

  it('round-trips daily Tally Market progress and validates basket placements', () => {
    const initial = emptyArcadeData()
    const state = createTallyMarketState('2026-11-20')
    const progress = { ...tallyMarketProgress(state), actions: 1 }
    const saved = withDailyTallyMarketGame(initial, progress)
    expect(saved?.dailyTallyMarketGame).toEqual(progress)
    expect(withDailyTallyMarketGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyTallyMarketGame(initial, { ...progress, actions: -1 })).toBeNull()
    expect(withDailyTallyMarketGame(saved!, null)?.dailyTallyMarketGame).toBeNull()
    expect(parseArcadeDataBackup(JSON.stringify(saved))).toEqual(saved)
    expect(withImprovedBest(initial, 'tallyMarket', 12)?.bests.tallyMarket).toBe(12)
    expect(withImprovedBest({ ...initial, bests: { ...initial.bests, tallyMarket: 12 } }, 'tallyMarket', 13)).toBeNull()
    expect(readArcadeData({ getItem: () => JSON.stringify(saved), setItem: () => {} }).dailyTallyMarketGame).toEqual(progress)
  })

  it('round-trips Pixel Mosaic progress and keeps the fastest browser clear', () => {
    const progress = { date: '2026-11-20', cells: Array(64).fill('unknown') as Array<'unknown' | 'filled' | 'empty'>, mistakes: 0, elapsedMs: 12_345, phase: 'playing' as const }
    const saved = withDailyPixelMosaicGame(emptyArcadeData(), progress)
    expect(saved?.dailyPixelMosaicGame).toEqual(progress)
    expect(withDailyPixelMosaicGame(saved!, { ...progress, elapsedMs: -1 })).toBeNull()
    expect(withDailyPixelMosaicGame(saved!, null)?.dailyPixelMosaicGame).toBeNull()
    const best = withImprovedBest(saved!, 'pixelMosaic', 12_345)
    expect(best?.bests.pixelMosaic).toBe(12_345)
    expect(withImprovedBest(best!, 'pixelMosaic', 12_500)).toBeNull()
    expect(withImprovedBest(best!, 'pixelMosaic', 12_300)?.bests.pixelMosaic).toBe(12_300)
    expect(parseArcadeDataBackup(JSON.stringify(saved))).toEqual(saved)
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
    const progress = { date: '2026-11-19', board: emptyCrosswordBoard(), hintsUsed: 1, hintedCells: [6] }
    const saved = withDailyMiniCrosswordGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'miniCrossword', 0)

    expect(saved?.dailyMiniCrosswordGame).toEqual(progress)
    expect(firstBest?.bests.miniCrossword).toBe(0)
    expect(withImprovedBest(firstBest!, 'miniCrossword', 1)).toBeNull()
    expect(withDailyMiniCrosswordGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyMiniCrosswordGame(initial, { ...progress, board: ['bad'] })).toBeNull()
  })

  it('saves a daily Letter Boxed chain and keeps the fewest words', () => {
    const initial = emptyArcadeData()
    const progress = { date: '2026-11-19', words: ['CRANE', 'ELBOW'] }
    const saved = withDailyLetterBoxedGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'letterBoxed', 3)

    expect(saved?.dailyLetterBoxedGame).toEqual(progress)
    expect(firstBest?.bests.letterBoxed).toBe(3)
    expect(withImprovedBest(firstBest!, 'letterBoxed', 4)).toBeNull()
    expect(withDailyLetterBoxedGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyLetterBoxedGame(initial, { ...progress, words: ['not a word'] })).toBeNull()
  })

  it('saves daily Domino Logic placements and keeps the fewest undos', () => {
    const initial = emptyArcadeData()
    const progress = {
      date: '2026-11-19',
      placements: [{ dominoId: 0, firstCell: 0, orientation: 'horizontal' as const, flipped: false }],
      undos: 2,
    }
    const saved = withDailyDominoLogicGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'dominoLogic', 0)

    expect(saved?.dailyDominoLogicGame).toEqual(progress)
    expect(firstBest?.bests.dominoLogic).toBe(0)
    expect(withImprovedBest(firstBest!, 'dominoLogic', 1)).toBeNull()
    expect(withDailyDominoLogicGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyDominoLogicGame(initial, { ...progress, placements: [...progress.placements, { dominoId: 0, firstCell: 2, orientation: 'horizontal', flipped: false }] })).toBeNull()
  })

  it('saves daily Glyph Match progress and keeps the fewest turns', () => {
    const initial = emptyArcadeData()
    const glyphs = createGlyphMatchPuzzle('2026-11-19').glyphs
    const firstIndex = 0
    const secondIndex = glyphs.findIndex((glyph, index) => index > firstIndex && glyph === glyphs[firstIndex])
    const progress = { date: '2026-11-19', matchedIndices: [firstIndex, secondIndex], moves: 2 }
    const saved = withDailyGlyphMatchGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'glyphMatch', 2)

    expect(saved?.dailyGlyphMatchGame).toEqual(progress)
    expect(firstBest?.bests.glyphMatch).toBe(2)
    expect(withImprovedBest(firstBest!, 'glyphMatch', 3)).toBeNull()
    expect(withDailyGlyphMatchGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyGlyphMatchGame(initial, { ...progress, matchedIndices: [firstIndex] })).toBeNull()
  })

  it('saves daily Vertex edge progress and keeps the fewest moves', () => {
    const initial = emptyArcadeData()
    const puzzle = createVertexPuzzle('2026-11-19')
    const progress = { date: puzzle.date, selectedEdges: puzzle.solutionEdges.slice(0, 4), moves: 6 }
    const saved = withDailyVertexGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'vertex', 12)

    expect(saved?.dailyVertexGame).toEqual(progress)
    expect(firstBest?.bests.vertex).toBe(12)
    expect(withImprovedBest(firstBest!, 'vertex', 15)).toBeNull()
    expect(withDailyVertexGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyVertexGame(initial, { ...progress, selectedEdges: ['not-an-edge'] })).toBeNull()
  })

  it('saves daily Tiles progress and keeps the fewest mistakes', () => {
    const initial = emptyArcadeData()
    const puzzle = createTilesPuzzle('2026-11-19')
    const progress = { date: puzzle.date, clearedIndices: puzzle.solutionPairs[0]!, moves: 2, mistakes: 1 }
    const saved = withDailyTilesGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'tiles', 0)

    expect(saved?.dailyTilesGame).toEqual(progress)
    expect(firstBest?.bests.tiles).toBe(0)
    expect(withImprovedBest(firstBest!, 'tiles', 1)).toBeNull()
    expect(withDailyTilesGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyTilesGame(initial, { ...progress, clearedIndices: [0] })).toBeNull()
  })

  it('saves daily Pips placements and keeps the fewest undos', () => {
    const initial = emptyArcadeData()
    const puzzle = createPipsPuzzle('2026-11-19')
    const progress = { date: puzzle.date, placements: puzzle.solution.slice(0, 2), undos: 2 }
    const saved = withDailyPipsGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'pips', 2)

    expect(saved?.dailyPipsGame).toEqual(progress)
    expect(firstBest?.bests.pips).toBe(2)
    expect(withImprovedBest(firstBest!, 'pips', 3)).toBeNull()
    expect(withImprovedBest(firstBest!, 'pips', 0)?.bests.pips).toBe(0)
    expect(withDailyPipsGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyPipsGame(initial, { ...progress, placements: [progress.placements[0]!, progress.placements[0]!] })).toBeNull()
  })

  it('saves daily Crossword entries and keeps the fewest hints', () => {
    const initial = emptyArcadeData()
    const puzzle = createDailyCrosswordPuzzle('2026-11-19')
    const board = puzzle.solution.map((letter) => letter === '#' ? '#' : '')
    const progress = { date: puzzle.date, board, hintsUsed: 0, hintedCells: [] as number[] }
    const saved = withDailyCrosswordGame(initial, progress)
    const firstBest = withImprovedBest(saved!, 'crossword', 2)

    expect(saved?.dailyCrosswordGame).toEqual(progress)
    expect(firstBest?.bests.crossword).toBe(2)
    expect(withImprovedBest(firstBest!, 'crossword', 3)).toBeNull()
    expect(withImprovedBest(firstBest!, 'crossword', 0)?.bests.crossword).toBe(0)
    expect(withDailyCrosswordGame(initial, { ...progress, date: '2026-02-30' })).toBeNull()
    expect(withDailyCrosswordGame(initial, { ...progress, board: ['bad'] })).toBeNull()
  })

  it('saves daily Minesweeper progress and keeps the fastest local solve', () => {
    const initial = emptyArcadeData()
    const progress = toMinesweeperProgress(createMinesweeperState('2026-11-19'))
    const saved = withDailyMinesweeperGame(initial, { ...progress, elapsedSeconds: 42 })
    const best = withImprovedBest(saved!, 'minesweeper', 42)

    expect(saved?.dailyMinesweeperGame?.elapsedSeconds).toBe(42)
    expect(best?.bests.minesweeper).toBe(42)
    expect(withImprovedBest(best!, 'minesweeper', 45)).toBeNull()
    expect(withDailyMinesweeperGame(initial, { ...progress, flagged: [99] })).toBeNull()
    expect(initial.dailyMinesweeperGame).toBeNull()
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
