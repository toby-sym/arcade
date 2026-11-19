import { lazy, Suspense, useEffect, useReducer, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import {
  BOARD_SIZE,
  createSnakeState,
  snakeReducer,
  type Direction,
  type Point,
} from './games/snake'
const ReactionGame = lazy(() => import('./games/ReactionGame').then(({ ReactionGame }) => ({ default: ReactionGame })))
const PatternGame = lazy(() => import('./games/PatternGame').then(({ PatternGame }) => ({ default: PatternGame })))
const BreakoutGame = lazy(() => import('./games/BreakoutGame').then(({ BreakoutGame }) => ({ default: BreakoutGame })))
const PongGame = lazy(() => import('./games/PongGame').then(({ PongGame }) => ({ default: PongGame })))
const InvadersGame = lazy(() => import('./games/InvadersGame').then(({ InvadersGame }) => ({ default: InvadersGame })))
const AsteroidsGame = lazy(() => import('./games/AsteroidsGame').then(({ AsteroidsGame }) => ({ default: AsteroidsGame })))
const MissileCommandGame = lazy(() => import('./games/MissileCommandGame').then(({ MissileCommandGame }) => ({ default: MissileCommandGame })))
const BlockDropGame = lazy(() => import('./games/BlockDropGame').then(({ BlockDropGame }) => ({ default: BlockDropGame })))
const DailyWordGame = lazy(() => import('./games/DailyWordGame').then(({ DailyWordGame }) => ({ default: DailyWordGame })))
import type { DailyWordProgress } from './games/dailyWord'
const ConnectionsGame = lazy(() => import('./games/ConnectionsGame').then(({ ConnectionsGame }) => ({ default: ConnectionsGame })))
import type { ConnectionsProgress } from './games/connections'
const SpellingBeeGame = lazy(() => import('./games/SpellingBeeGame').then(({ SpellingBeeGame }) => ({ default: SpellingBeeGame })))
import { createSpellingBeeState, type SpellingBeeProgress } from './games/spellingBee'
const StrandsGame = lazy(() => import('./games/StrandsGame').then(({ StrandsGame }) => ({ default: StrandsGame })))
import { createStrandsState, type StrandsProgress } from './games/strands'
const SudokuGame = lazy(() => import('./games/SudokuGame').then(({ SudokuGame }) => ({ default: SudokuGame })))
import { createSudokuState, type SudokuProgress } from './games/sudoku'
const MiniCrosswordGame = lazy(() => import('./games/MiniCrosswordGame').then(({ MiniCrosswordGame }) => ({ default: MiniCrosswordGame })))
import { createMiniCrosswordState, type MiniCrosswordProgress } from './games/miniCrossword'
const LetterBoxedGame = lazy(() => import('./games/LetterBoxedGame').then(({ LetterBoxedGame }) => ({ default: LetterBoxedGame })))
import { createLetterBoxedState, type LetterBoxedProgress } from './games/letterBoxed'
const DominoLogicGame = lazy(() => import('./games/DominoLogicGame').then(({ DominoLogicGame }) => ({ default: DominoLogicGame })))
import { createDominoLogicState, type DominoLogicProgress } from './games/dominoLogic'
const GlyphMatchGame = lazy(() => import('./games/GlyphMatchGame').then(({ GlyphMatchGame }) => ({ default: GlyphMatchGame })))
import { createGlyphMatchState, type GlyphMatchProgress } from './games/glyphMatch'
const VertexGame = lazy(() => import('./games/VertexGame').then(({ VertexGame }) => ({ default: VertexGame })))
import { createVertexState, type VertexProgress } from './games/vertex'
const TilesGame = lazy(() => import('./games/TilesGame').then(({ TilesGame }) => ({ default: TilesGame })))
import { createTilesState, type TilesProgress } from './games/tiles'
const PipsGame = lazy(() => import('./games/PipsGame').then(({ PipsGame }) => ({ default: PipsGame })))
import { createPipsState, type PipsProgress } from './games/pips'
const DailyCrosswordGame = lazy(() => import('./games/DailyCrosswordGame').then(({ DailyCrosswordGame }) => ({ default: DailyCrosswordGame })))
import { createDailyCrosswordState, type DailyCrosswordProgress } from './games/dailyCrossword'
const MinesweeperGame = lazy(() => import('./games/MinesweeperGame').then(({ MinesweeperGame }) => ({ default: MinesweeperGame })))
import type { MinesweeperProgress } from './games/minesweeper'
import { ArcadeAudioProvider, playArcadeSound, setArcadeAudioEnabled } from './audio/arcadeAudio'
import type { PongDifficulty } from './games/pong'
import { ARCADE_BACKUP_MAX_BYTES, clearArcadeBests, parseArcadeDataBackup, readArcadeData, withDailyConnectionsGame, withDailyCrosswordGame, withDailyDominoLogicGame, withDailyGlyphMatchGame, withDailyLetterBoxedGame, withDailyMiniCrosswordGame, withDailyMinesweeperGame, withDailyPipsGame, withDailyPatternCompletion, withDailySpellingBeeGame, withDailyStrandsGame, withDailySudokuGame, withDailyTilesGame, withDailyVertexGame, withDailyWordGame, withImprovedBest, writeArcadeData, type ArcadeBests, type ArcadeData } from './storage/arcadeData'

const version = import.meta.env.VITE_APP_VERSION || 'Development'
const versionLabel = version === 'Development' ? version : `v${version}`

type GameFloorCategory = 'arcade' | 'daily'
type GameFloorFilter = GameFloorCategory | 'all'

const GAME_FLOOR_ITEMS = [
  { id: 'snake', title: 'Snake', categories: ['arcade'], terms: 'classic action' },
  { id: 'reaction', title: 'Reaction', categories: ['arcade'], terms: 'reflex timing quick' },
  { id: 'pattern', title: 'Pattern Memory', categories: ['arcade', 'daily'], terms: 'remember sequence' },
  { id: 'breakout', title: 'Breakout', categories: ['arcade'], terms: 'brick paddle' },
  { id: 'pong', title: 'Pong', categories: ['arcade'], terms: 'paddle table tennis' },
  { id: 'invaders', title: 'Space Invaders', categories: ['arcade'], terms: 'shooter aliens' },
  { id: 'asteroids', title: 'Asteroids', categories: ['arcade'], terms: 'shooter rocks vector' },
  { id: 'missile', title: 'Missile Command', categories: ['arcade'], terms: 'defense aim' },
  { id: 'blockdrop', title: 'Block Drop', categories: ['arcade'], terms: 'falling blocks rows' },
  { id: 'wordgame', title: 'Word Guess', categories: ['daily'], terms: 'letters wordle' },
  { id: 'connections', title: 'Connections', categories: ['daily'], terms: 'groups categories' },
  { id: 'spellingbee', title: 'Spelling Bee', categories: ['daily'], terms: 'words letters hive' },
  { id: 'strands', title: 'Strands', categories: ['daily'], terms: 'word search theme' },
  { id: 'sudoku', title: 'Sudoku', categories: ['daily'], terms: 'numbers logic grid' },
  { id: 'minicrossword', title: 'Mini Crossword', categories: ['daily'], terms: 'clues words' },
  { id: 'letterboxed', title: 'Letter Boxed', categories: ['daily'], terms: 'word chain letters' },
  { id: 'dominologic', title: 'Domino Logic', categories: ['daily'], terms: 'domino sums numbers' },
  { id: 'glyphmatch', title: 'Glyph Match', categories: ['daily'], terms: 'memory pairs symbols' },
  { id: 'vertex', title: 'Vertex', categories: ['daily'], terms: 'loop lines triangle' },
  { id: 'tiles', title: 'Tiles', categories: ['daily'], terms: 'pattern match pairs' },
  { id: 'pips', title: 'Pips', categories: ['daily'], terms: 'domino regions numbers' },
  { id: 'dailycrossword', title: 'Daily Crossword', categories: ['daily'], terms: 'clues words grid' },
  { id: 'minesweeper', title: 'Minesweeper', categories: ['daily'], terms: 'minesweeper mines flags numbers logic' },
] satisfies Array<{ id: string; title: string; categories: GameFloorCategory[]; terms: string }>

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const directionKeys: Record<string, Direction> = {
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ArrowDown: 'down',
  s: 'down',
  S: 'down',
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
}

function App() {
  const [screen, setScreen] = useState<'home' | 'snake' | 'reaction' | 'pattern' | 'breakout' | 'pong' | 'invaders' | 'asteroids' | 'missile' | 'blockdrop' | 'wordgame' | 'connections' | 'spellingbee' | 'strands' | 'sudoku' | 'minicrossword' | 'letterboxed' | 'dominologic' | 'glyphmatch' | 'vertex' | 'tiles' | 'pips' | 'crossword' | 'minesweeper'>('home')
  const [snake, dispatch] = useReducer(snakeReducer, undefined, () => createSnakeState())
  const [arcadeData, setArcadeData] = useState(readArcadeData)
  const [storageNotice, setStorageNotice] = useState('')
  const [pendingBackupRestore, setPendingBackupRestore] = useState<ArcadeData | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const previousSnakeState = useRef({ score: snake.score, status: snake.status })

  const recordBest = (game: keyof ArcadeBests, candidate: number) => {
    const next = withImprovedBest(arcadeData, game, candidate)
    if (!next) return
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const setReduceMotion = (reduceMotion: boolean) => {
    const next = { ...arcadeData, preferences: { ...arcadeData.preferences, reduceMotion } }
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const setSoundEffects = (soundEffects: boolean) => {
    if (soundEffects) setArcadeAudioEnabled(true)
    else setArcadeAudioEnabled(false)
    const next = { ...arcadeData, preferences: { ...arcadeData.preferences, soundEffects } }
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const setPongDifficulty = (pongDifficulty: PongDifficulty) => {
    const next = { ...arcadeData, preferences: { ...arcadeData.preferences, pongDifficulty } }
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const clearRecords = () => {
    const next = clearArcadeBests(arcadeData)
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const downloadBackup = () => {
    try {
      const blob = new Blob([JSON.stringify(arcadeData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `arcade-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStorageNotice('Backup downloaded to your device.')
    } catch {
      setStorageNotice('This browser could not create an Arcade backup file.')
    }
  }

  const prepareBackupRestore = async (file: File) => {
    if (file.size > ARCADE_BACKUP_MAX_BYTES) {
      setPendingBackupRestore(null)
      setStorageNotice('That backup file is too large. Your current data was left unchanged.')
      return
    }

    try {
      const backup = parseArcadeDataBackup(await file.text())
      if (!backup) {
        setPendingBackupRestore(null)
        setStorageNotice('That file is not a valid Arcade backup. Your current data was left unchanged.')
        return
      }
      setPendingBackupRestore(backup)
      setStorageNotice('Backup checked. Confirm below to replace this browser’s saved Arcade data.')
    } catch {
      setPendingBackupRestore(null)
      setStorageNotice('Arcade could not read that file. Your current data was left unchanged.')
    }
  }

  const restoreBackup = () => {
    if (!pendingBackupRestore) return
    if (!writeArcadeData(pendingBackupRestore)) {
      setStorageNotice('This browser could not restore Arcade data.')
      return
    }
    setArcadeData(pendingBackupRestore)
    setPendingBackupRestore(null)
    setStorageNotice('Backup restored in this browser.')
  }

  const cancelBackupRestore = () => {
    setPendingBackupRestore(null)
    setStorageNotice('Restore canceled. Your saved data was not changed.')
  }

  const recordDailyCompletion = (date: string) => {
    const next = withDailyPatternCompletion(arcadeData, date)
    if (!next) return
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyWordGame = (progress: DailyWordProgress) => {
    const withProgress = withDailyWordGame(arcadeData, progress)
    if (!withProgress) return
    const next = progress.phase === 'won'
      ? withImprovedBest(withProgress, 'wordPuzzle', progress.guesses.length) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyConnectionsGame = (progress: ConnectionsProgress) => {
    const withProgress = withDailyConnectionsGame(arcadeData, progress)
    if (!withProgress) return
    const next = progress.phase === 'won'
      ? withImprovedBest(withProgress, 'connections', progress.mistakes) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailySpellingBeeGame = (progress: SpellingBeeProgress) => {
    const withProgress = withDailySpellingBeeGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createSpellingBeeState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'spellingBee', completed.score) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyStrandsGame = (progress: StrandsProgress) => {
    const withProgress = withDailyStrandsGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createStrandsState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'strands', completed.hintsUsed) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailySudokuGame = (progress: SudokuProgress) => {
    const withProgress = withDailySudokuGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createSudokuState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'sudoku', completed.hintsUsed) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyMiniCrosswordGame = (progress: MiniCrosswordProgress) => {
    const withProgress = withDailyMiniCrosswordGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createMiniCrosswordState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'miniCrossword', completed.hintsUsed) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyLetterBoxedGame = (progress: LetterBoxedProgress) => {
    const withProgress = withDailyLetterBoxedGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createLetterBoxedState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'letterBoxed', completed.words.length) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyDominoLogicGame = (progress: DominoLogicProgress) => {
    const withProgress = withDailyDominoLogicGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createDominoLogicState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'dominoLogic', completed.undos) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyGlyphMatchGame = (progress: GlyphMatchProgress) => {
    const withProgress = withDailyGlyphMatchGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createGlyphMatchState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'glyphMatch', completed.moves) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyVertexGame = (progress: VertexProgress) => {
    const withProgress = withDailyVertexGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createVertexState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'vertex', completed.moves) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyTilesGame = (progress: TilesProgress) => {
    const withProgress = withDailyTilesGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createTilesState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'tiles', completed.mistakes) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyPipsGame = (progress: PipsProgress) => {
    const withProgress = withDailyPipsGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createPipsState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'pips', completed.undos) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyCrosswordGame = (progress: DailyCrosswordProgress) => {
    const withProgress = withDailyCrosswordGame(arcadeData, progress)
    if (!withProgress) return
    const completed = createDailyCrosswordState(progress.date, progress)
    const next = completed.phase === 'complete'
      ? withImprovedBest(withProgress, 'crossword', completed.hintsUsed) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  const saveDailyMinesweeperGame = (progress: MinesweeperProgress) => {
    const withProgress = withDailyMinesweeperGame(arcadeData, progress)
    if (!withProgress) return
    const next = progress.phase === 'won'
      ? withImprovedBest(withProgress, 'minesweeper', progress.elapsedSeconds) ?? withProgress
      : withProgress
    setArcadeData(next)
    setStorageNotice(writeArcadeData(next) ? '' : 'This browser could not save Arcade data.')
  }

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(arcadeData.preferences.reduceMotion)
  }, [arcadeData.preferences.reduceMotion])

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine)
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const clearInstallPrompt = () => setInstallPrompt(null)

    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', clearInstallPrompt)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', clearInstallPrompt)
    }
  }, [])

  const installArcade = async () => {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
    } finally {
      setInstallPrompt(null)
    }
  }

  useEffect(() => {
    if (snake.score > 0) recordBest('snake', snake.score)
  }, [snake.score])

  useEffect(() => {
    const previous = previousSnakeState.current
    if (snake.status === 'over' && previous.status !== 'over') playArcadeSound('lose', arcadeData.preferences.soundEffects)
    else if (snake.status === 'won' && previous.status !== 'won') playArcadeSound('win', arcadeData.preferences.soundEffects)
    else if (snake.score > previous.score) playArcadeSound('score', arcadeData.preferences.soundEffects)
    previousSnakeState.current = { score: snake.score, status: snake.status }
  }, [snake.score, snake.status, arcadeData.preferences.soundEffects])

  useEffect(() => {
    if (snake.status !== 'playing') return
    const speed = Math.max(86, 158 - snake.score * 3)
    const timer = window.setInterval(() => {
      dispatch({ type: 'tick', foodRoll: Math.random() })
    }, speed)
    return () => window.clearInterval(timer)
  }, [snake.status, snake.score])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) dispatch({ type: 'pause' })
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  const openSnake = () => {
    dispatch({ type: 'restart', foodRoll: Math.random() })
    setScreen('snake')
  }
  const openReaction = () => setScreen('reaction')
  const openPattern = () => setScreen('pattern')
  const openBreakout = () => setScreen('breakout')
  const openPong = () => setScreen('pong')
  const openInvaders = () => setScreen('invaders')
  const openAsteroids = () => setScreen('asteroids')
  const openMissileCommand = () => setScreen('missile')
  const openBlockDrop = () => setScreen('blockdrop')
  const openWordGame = () => setScreen('wordgame')
  const openConnections = () => setScreen('connections')
  const openSpellingBee = () => setScreen('spellingbee')
  const openStrands = () => setScreen('strands')
  const openSudoku = () => setScreen('sudoku')
  const openMiniCrossword = () => setScreen('minicrossword')
  const openLetterBoxed = () => setScreen('letterboxed')
  const openDominoLogic = () => setScreen('dominologic')
  const openGlyphMatch = () => setScreen('glyphmatch')
  const openVertex = () => setScreen('vertex')
  const openTiles = () => setScreen('tiles')
  const openPips = () => setScreen('pips')
  const openCrossword = () => setScreen('crossword')
  const openMinesweeper = () => setScreen('minesweeper')

  const handleGameKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = directionKeys[event.key]
    if (direction) {
      event.preventDefault()
      dispatch({ type: 'turn', direction })
      return
    }

    if (event.key === 'Escape' && (snake.status === 'playing' || snake.status === 'paused')) {
      event.preventDefault()
      dispatch({ type: 'pause' })
    }
  }

  const restart = () => dispatch({ type: 'restart', foodRoll: Math.random() })
  const focusBoard = () => window.requestAnimationFrame(() => boardRef.current?.focus())
  const startGame = () => {
    dispatch({ type: 'start' })
    focusBoard()
  }
  const playAgain = () => {
    dispatch({ type: 'restart', foodRoll: Math.random() })
    dispatch({ type: 'start' })
    focusBoard()
  }

  return (
    <ArcadeAudioProvider enabled={arcadeData.preferences.soundEffects}>
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setScreen('home')} aria-label="Arcade home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
          <span>ARCADE</span>
        </button>
        <span className="topbar-note" role={isOnline ? undefined : 'status'}>
          {isOnline ? 'FREE PLAY · 1 PLAYER' : 'OFFLINE'}
        </span>
        <span className="version-label">{versionLabel}</span>
      </header>

      <main id="main" className="main-content">
        <Suspense fallback={<div className="game-loading" role="status">Loading game<span aria-hidden="true">…</span></div>}>
        {screen === 'home' ? (
          <Home
            onPlaySnake={openSnake}
            onPlayReaction={openReaction}
            onPlayPattern={openPattern}
            onPlayBreakout={openBreakout}
            onPlayPong={openPong}
            onPlayInvaders={openInvaders}
            onPlayAsteroids={openAsteroids}
            onPlayMissileCommand={openMissileCommand}
            onPlayBlockDrop={openBlockDrop}
            onPlayWordGame={openWordGame}
            onPlayConnections={openConnections}
            onPlaySpellingBee={openSpellingBee}
            onPlayStrands={openStrands}
            onPlaySudoku={openSudoku}
            onPlayMiniCrossword={openMiniCrossword}
            onPlayLetterBoxed={openLetterBoxed}
            onPlayDominoLogic={openDominoLogic}
            onPlayGlyphMatch={openGlyphMatch}
            onPlayVertex={openVertex}
            onPlayTiles={openTiles}
            onPlayPips={openPips}
            onPlayCrossword={openCrossword}
            onPlayMinesweeper={openMinesweeper}
            reduceMotion={arcadeData.preferences.reduceMotion}
            onReduceMotionChange={setReduceMotion}
            soundEffects={arcadeData.preferences.soundEffects}
            onSoundEffectsChange={setSoundEffects}
            hasRecords={Object.values(arcadeData.bests).some((record) => record !== null)}
            onClearRecords={clearRecords}
            onDownloadBackup={downloadBackup}
            onSelectBackupFile={prepareBackupRestore}
            backupRestorePending={pendingBackupRestore !== null}
            onRestoreBackup={restoreBackup}
            onCancelBackupRestore={cancelBackupRestore}
            storageNotice={storageNotice}
            installAvailable={installPrompt !== null}
            onInstall={installArcade}
          />
        ) : screen === 'reaction' ? (
          <ReactionGame
            onBack={() => setScreen('home')}
            bestTimeMs={arcadeData.bests.reaction}
            onRecordTime={(time) => recordBest('reaction', time)}
          />
        ) : screen === 'pattern' ? (
          <PatternGame
            onBack={() => setScreen('home')}
            bestRounds={arcadeData.bests.pattern}
            onRecordRounds={(rounds) => recordBest('pattern', rounds)}
            dailyCompletedDate={arcadeData.dailyPatternCompletedDate}
            onDailyComplete={recordDailyCompletion}
          />
        ) : screen === 'breakout' ? (
          <BreakoutGame
            onBack={() => setScreen('home')}
            bestScore={arcadeData.bests.breakout}
            onRecordScore={(score) => recordBest('breakout', score)}
          />
        ) : screen === 'pong' ? (
          <PongGame
            onBack={() => setScreen('home')}
            bestScore={arcadeData.bests.pong}
            onRecordScore={(score) => recordBest('pong', score)}
            difficulty={arcadeData.preferences.pongDifficulty}
            onDifficultyChange={setPongDifficulty}
          />
        ) : screen === 'invaders' ? (
          <InvadersGame
            onBack={() => setScreen('home')}
            bestScore={arcadeData.bests.invaders}
            onRecordScore={(score) => recordBest('invaders', score)}
          />
        ) : screen === 'asteroids' ? (
          <AsteroidsGame
            onBack={() => setScreen('home')}
            bestScore={arcadeData.bests.asteroids}
            onRecordScore={(score) => recordBest('asteroids', score)}
          />
        ) : screen === 'missile' ? (
          <MissileCommandGame
            onBack={() => setScreen('home')}
            bestScore={arcadeData.bests.missileCommand}
            onRecordScore={(score) => recordBest('missileCommand', score)}
          />
        ) : screen === 'blockdrop' ? (
          <BlockDropGame
            onBack={() => setScreen('home')}
            bestScore={arcadeData.bests.blockDrop}
            onRecordScore={(score) => recordBest('blockDrop', score)}
          />
        ) : screen === 'wordgame' ? (
          <DailyWordGame
            onBack={() => setScreen('home')}
            bestSolve={arcadeData.bests.wordPuzzle}
            progress={arcadeData.dailyWordGame}
            onSaveProgress={saveDailyWordGame}
          />
        ) : screen === 'connections' ? (
          <ConnectionsGame
            onBack={() => setScreen('home')}
            bestMistakes={arcadeData.bests.connections}
            progress={arcadeData.dailyConnectionsGame}
            onSaveProgress={saveDailyConnectionsGame}
          />
        ) : screen === 'spellingbee' ? (
          <SpellingBeeGame
            onBack={() => setScreen('home')}
            bestScore={arcadeData.bests.spellingBee}
            progress={arcadeData.dailySpellingBeeGame}
            onSaveProgress={saveDailySpellingBeeGame}
          />
        ) : screen === 'strands' ? (
          <StrandsGame
            onBack={() => setScreen('home')}
            bestHints={arcadeData.bests.strands}
            progress={arcadeData.dailyStrandsGame}
            onSaveProgress={saveDailyStrandsGame}
          />
        ) : screen === 'sudoku' ? (
          <SudokuGame
            onBack={() => setScreen('home')}
            bestHints={arcadeData.bests.sudoku}
            progress={arcadeData.dailySudokuGame}
            onSaveProgress={saveDailySudokuGame}
          />
        ) : screen === 'minicrossword' ? (
          <MiniCrosswordGame
            onBack={() => setScreen('home')}
            bestHints={arcadeData.bests.miniCrossword}
            progress={arcadeData.dailyMiniCrosswordGame}
            onSaveProgress={saveDailyMiniCrosswordGame}
          />
        ) : screen === 'letterboxed' ? (
          <LetterBoxedGame
            onBack={() => setScreen('home')}
            bestWords={arcadeData.bests.letterBoxed}
            progress={arcadeData.dailyLetterBoxedGame}
            onSaveProgress={saveDailyLetterBoxedGame}
          />
        ) : screen === 'dominologic' ? (
          <DominoLogicGame
            onBack={() => setScreen('home')}
            bestUndos={arcadeData.bests.dominoLogic}
            progress={arcadeData.dailyDominoLogicGame}
            onSaveProgress={saveDailyDominoLogicGame}
          />
        ) : screen === 'glyphmatch' ? (
          <GlyphMatchGame
            onBack={() => setScreen('home')}
            bestMoves={arcadeData.bests.glyphMatch}
            progress={arcadeData.dailyGlyphMatchGame}
            reduceMotion={arcadeData.preferences.reduceMotion}
            onSaveProgress={saveDailyGlyphMatchGame}
          />
        ) : screen === 'vertex' ? (
          <VertexGame
            onBack={() => setScreen('home')}
            bestMoves={arcadeData.bests.vertex}
            progress={arcadeData.dailyVertexGame}
            onSaveProgress={saveDailyVertexGame}
          />
        ) : screen === 'tiles' ? (
          <TilesGame
            onBack={() => setScreen('home')}
            bestMistakes={arcadeData.bests.tiles}
            progress={arcadeData.dailyTilesGame}
            onSaveProgress={saveDailyTilesGame}
          />
        ) : screen === 'pips' ? (
          <PipsGame
            onBack={() => setScreen('home')}
            bestUndos={arcadeData.bests.pips}
            progress={arcadeData.dailyPipsGame}
            onSaveProgress={saveDailyPipsGame}
          />
        ) : screen === 'crossword' ? (
          <DailyCrosswordGame
            onBack={() => setScreen('home')}
            bestHints={arcadeData.bests.crossword}
            progress={arcadeData.dailyCrosswordGame}
            onSaveProgress={saveDailyCrosswordGame}
          />
        ) : screen === 'minesweeper' ? (
          <MinesweeperGame
            onBack={() => setScreen('home')}
            bestSeconds={arcadeData.bests.minesweeper}
            progress={arcadeData.dailyMinesweeperGame}
            onSaveProgress={saveDailyMinesweeperGame}
          />
        ) : (
          <section className="snake-view" aria-labelledby="snake-title">
            <button className="back-link" type="button" onClick={() => setScreen('home')}>
              <span aria-hidden="true">←</span> All games
            </button>
          <div className="snake-layout" onKeyDown={handleGameKeyDown}>
              <div className="snake-copy">
                <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
                <h1 id="snake-title">Snake<span className="title-period" aria-hidden="true">.</span></h1>
                <p className="snake-lede">Guide the little green line. Eat the dots. Keep your head clear.</p>
                <div className="how-to-play">
                  <h2>How to play</h2>
                  <p>Steer with the arrow keys or WASD. On a phone, use the direction pad. Don’t hit the walls or your own tail.</p>
                </div>
                <div className="score-card" aria-label={`Score: ${snake.score}. ${arcadeData.bests.snake === null ? 'No personal best yet.' : `Local best: ${arcadeData.bests.snake} dots.`}`}>
                  <span className="score-caption">THIS RUN</span>
                  <strong className="score-value">{String(snake.score).padStart(2, '0')}</strong>
                  <span className="score-unit">dots collected</span>
                  <div className="local-best-readout">
                    <span className="score-caption">BEST IN THIS BROWSER</span>
                    <strong className="score-value">{arcadeData.bests.snake === null ? '—' : String(arcadeData.bests.snake).padStart(2, '0')}</strong>
                    <span className="score-unit">dots</span>
                  </div>
                </div>
                <div className="game-actions">
                  {snake.status === 'playing' ? (
                    <button className="button button-secondary" type="button" onClick={() => dispatch({ type: 'pause' })}>
                      Pause <span className="pause-mark" aria-hidden="true"><i /><i /></span>
                    </button>
                  ) : snake.status === 'paused' ? (
                    <button className="button button-primary" type="button" onClick={startGame}>
                      Resume <span aria-hidden="true">→</span>
                    </button>
                  ) : snake.status === 'ready' ? (
                    <button className="button button-primary" type="button" onClick={startGame}>
                      Start game <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button className="button button-primary" type="button" onClick={playAgain}>
                      Play again
                    </button>
                  )}
                  {snake.status !== 'ready' && (
                    <button className="button button-quiet" type="button" onClick={restart}>
                      Restart
                    </button>
                  )}
                </div>
                <p className="keyboard-hint">{snake.status === 'playing' ? 'Esc to pause' : 'Take your time.'}</p>
              </div>

              <div className="play-column">
                <div className="play-frame">
                  <div className="frame-topline">
                    <span>FIELD 01</span>
                    <span className="frame-light"><i /> {snake.status === 'playing' ? 'LIVE' : snake.status.toUpperCase()}</span>
                  </div>
                  <div
                    className={`game-board status-${snake.status}`}
                    ref={boardRef}
                    tabIndex={0}
                    role="group"
                    aria-label="Snake playfield"
                    aria-describedby="snake-live-instructions"
                    data-direction={snake.direction}
                  >
                    <div className="board-grid" aria-hidden="true">
                      {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
                        const x = index % BOARD_SIZE
                        const y = Math.floor(index / BOARD_SIZE)
                        const kind = cellKind({ x, y }, snake.snake, snake.food)
                        return <span className={`board-cell cell-${kind}`} key={index} />
                      })}
                    </div>
                    {snake.status !== 'playing' && (
                      <div className="board-overlay" aria-live="polite">
                        <span className={`overlay-symbol overlay-symbol-${snake.status}`} aria-hidden="true" />
                        <strong>{overlayTitle(snake.status)}</strong>
                        <span>{overlayCopy(snake.status, snake.score)}</span>
                      </div>
                    )}
                  </div>
                  <div className="frame-bottomline">
                    <span>ARROWS / WASD</span>
                    <span>18 × 18</span>
                  </div>
                </div>
                <div className="touch-controls" aria-label="Touch direction controls">
                  <span className="touch-label">STEER</span>
                  <div className="dpad">
                    <span className="dpad-spacer" aria-hidden="true" />
                    <DirectionButton direction="up" onTurn={(direction) => dispatch({ type: 'turn', direction })} />
                    <span className="dpad-spacer" aria-hidden="true" />
                    <DirectionButton direction="left" onTurn={(direction) => dispatch({ type: 'turn', direction })} />
                    <DirectionButton direction="down" onTurn={(direction) => dispatch({ type: 'turn', direction })} />
                    <DirectionButton direction="right" onTurn={(direction) => dispatch({ type: 'turn', direction })} />
                  </div>
                  <span id="snake-live-instructions" className="sr-only" aria-live="polite">
                    {snakeStatusText(snake.status, snake.score)}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}
        </Suspense>
      </main>

      <footer className="site-footer">
        <span>Made for the space between things.</span>
        <span>ARCADE&nbsp; / &nbsp;{versionLabel}</span>
      </footer>
    </div>
    </ArcadeAudioProvider>
  )
}

function Home({
  onPlaySnake,
  onPlayReaction,
  onPlayPattern,
  onPlayBreakout,
  onPlayPong,
  onPlayInvaders,
  onPlayAsteroids,
  onPlayMissileCommand,
  onPlayBlockDrop,
  onPlayWordGame,
  onPlayConnections,
  onPlaySpellingBee,
  onPlayStrands,
  onPlaySudoku,
  onPlayMiniCrossword,
  onPlayLetterBoxed,
  onPlayDominoLogic,
  onPlayGlyphMatch,
  onPlayVertex,
  onPlayTiles,
  onPlayPips,
  onPlayCrossword,
  onPlayMinesweeper,
  reduceMotion,
  onReduceMotionChange,
  soundEffects,
  onSoundEffectsChange,
  hasRecords,
  onClearRecords,
  onDownloadBackup,
  onSelectBackupFile,
  backupRestorePending,
  onRestoreBackup,
  onCancelBackupRestore,
  storageNotice,
  installAvailable,
  onInstall,
}: {
  onPlaySnake: () => void
  onPlayReaction: () => void
  onPlayPattern: () => void
  onPlayBreakout: () => void
  onPlayPong: () => void
  onPlayInvaders: () => void
  onPlayAsteroids: () => void
  onPlayMissileCommand: () => void
  onPlayBlockDrop: () => void
  onPlayWordGame: () => void
  onPlayConnections: () => void
  onPlaySpellingBee: () => void
  onPlayStrands: () => void
  onPlaySudoku: () => void
  onPlayMiniCrossword: () => void
  onPlayLetterBoxed: () => void
  onPlayDominoLogic: () => void
  onPlayGlyphMatch: () => void
  onPlayVertex: () => void
  onPlayTiles: () => void
  onPlayPips: () => void
  onPlayCrossword: () => void
  onPlayMinesweeper: () => void
  reduceMotion: boolean
  onReduceMotionChange: (reduceMotion: boolean) => void
  soundEffects: boolean
  onSoundEffectsChange: (enabled: boolean) => void
  hasRecords: boolean
  onClearRecords: () => void
  onDownloadBackup: () => void
  onSelectBackupFile: (file: File) => void
  backupRestorePending: boolean
  onRestoreBackup: () => void
  onCancelBackupRestore: () => void
  storageNotice: string
  installAvailable: boolean
  onInstall: () => void
}) {
  const [confirmClearRecords, setConfirmClearRecords] = useState(false)
  const backupFileInput = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [gameFilter, setGameFilter] = useState<GameFloorFilter>('all')
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleGames = GAME_FLOOR_ITEMS.filter((game) => {
    const matchesCategory = gameFilter === 'all' || game.categories.includes(gameFilter)
    const matchesQuery = !normalizedQuery || `${game.title} ${game.terms}`.toLocaleLowerCase().includes(normalizedQuery)
    return matchesCategory && matchesQuery
  })
  const visibleGameIds = new Set(visibleGames.map((game) => game.id))
  const hasActiveGameFilters = gameFilter !== 'all' || normalizedQuery.length > 0
  const handleBackupFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) onSelectBackupFile(file)
  }

  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> YOUR ARCADE, OPEN</p>
          <h1 id="home-title">A good game<br />changes the <em>pace.</em></h1>
          <p className="hero-lede">Small games for the moments between everything else. Pick a cabinet and play a round.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-sun" />
          <div className="hero-grid-mark"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
          <span className="hero-art-label">PRESS<br />PLAY</span>
          <span className="hero-art-index">A / 01</span>
        </div>
      </section>

      <section className="game-section" aria-labelledby="games-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE FLOOR</p>
            <h2 id="games-title">Choose your game</h2>
          </div>
          <span className="section-count" aria-live="polite">
            {hasActiveGameFilters ? `${visibleGames.length} ${visibleGames.length === 1 ? 'GAME' : 'GAMES'}` : `${GAME_FLOOR_ITEMS.length} PLAYABLE`}
          </span>
        </div>
        <div className="game-floor-tools">
          <label className="game-search-label" htmlFor="game-search">Find a game</label>
          <input
            id="game-search"
            className="game-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder="Search titles and game types"
            autoComplete="off"
          />
          <div className="game-filter-group" role="group" aria-label="Filter games by type">
            {([
              ['all', 'All games'],
              ['arcade', 'Arcade'],
              ['daily', 'Daily puzzles'],
            ] as const).map(([filter, label]) => (
              <button
                className="game-filter-button"
                type="button"
                key={filter}
                aria-pressed={gameFilter === filter}
                onClick={() => setGameFilter(filter)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="game-floor-status" role="status" aria-live="polite">
            {visibleGames.length === 0
              ? 'No games found. Try another search or filter.'
              : hasActiveGameFilters
              ? `Showing ${visibleGames.length} of ${GAME_FLOOR_ITEMS.length} games.`
              : `Showing all ${GAME_FLOOR_ITEMS.length} games.`}
          </p>
        </div>
        <div className="game-list">
          <article className="game-card game-card-snake" hidden={!visibleGameIds.has('snake')}>
            <div className="card-art snake-card-art" aria-hidden="true">
              <div className="snake-art-path"><i /><i /><i /><i /><i /><b /></div>
              <span className="card-art-index">01</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">01</span><span className="game-category">ARCADE CLASSIC</span></div>
              <h3>Snake</h3>
              <p>One more dot. One more turn. Don’t get tangled.</p>
              <div className="card-bottom">
                <span className="controls-label">ARROWS · WASD · TOUCH</span>
                <button className="play-card-button" type="button" onClick={onPlaySnake}>Play Snake <span className="arrow-mark" aria-hidden="true" /></button>
              </div>
            </div>
          </article>
          <article className="game-card game-card-reaction" hidden={!visibleGameIds.has('reaction')}>
            <div className="card-art reaction-card-art" aria-hidden="true">
              <span className="reaction-ring ring-one" /><span className="reaction-ring ring-two" /><span className="reaction-ring ring-three" />
              <span className="reaction-dot" />
              <span className="card-art-index">02</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">02</span><span className="game-category">QUICK REFLEXES</span></div>
              <h3>Reaction</h3>
              <p>Wait for the signal. Trust your timing.</p>
              <div className="card-bottom"><span className="controls-label">MOUSE · TOUCH · SPACE</span><button className="play-card-button" type="button" onClick={onPlayReaction}>Play Reaction <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-pattern" hidden={!visibleGameIds.has('pattern')}>
            <div className="card-art memory-card-art" aria-hidden="true">
              <span className="memory-tile tile-a" /><span className="memory-tile tile-b" /><span className="memory-tile tile-c" /><span className="memory-tile tile-d" />
              <span className="card-art-index">03</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">03</span><span className="game-category">PATTERN MEMORY</span></div>
              <h3>Remember</h3>
              <p>Practice a growing pattern or take on today's shared sequence.</p>
              <div className="card-bottom"><span className="controls-label">TOUCH · CLICK · KEY</span><button className="play-card-button" type="button" onClick={onPlayPattern}>Play Pattern <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-breakout" hidden={!visibleGameIds.has('breakout')}>
            <div className="card-art breakout-card-art" aria-hidden="true">
              <div className="breakout-card-bricks"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <span className="breakout-card-ball" />
              <span className="breakout-card-paddle" />
              <span className="card-art-index">04</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">04</span><span className="game-category">ARCADE CLASSIC</span></div>
              <h3>Breakout</h3>
              <p>Keep the ball in play and chip away at the wall.</p>
              <div className="card-bottom"><span className="controls-label">ARROWS · WASD · DRAG</span><button className="play-card-button" type="button" onClick={onPlayBreakout}>Play Breakout <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-pong" hidden={!visibleGameIds.has('pong')}>
            <div className="card-art pong-card-art" aria-hidden="true">
              <span className="pong-card-line" />
              <span className="pong-card-paddle pong-card-player" />
              <span className="pong-card-paddle pong-card-computer" />
              <span className="pong-card-ball" />
              <span className="card-art-index">05</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">05</span><span className="game-category">HEAD TO HEAD</span></div>
              <h3>Pong</h3>
              <p>Rally the computer. First to five takes the match.</p>
              <div className="card-bottom"><span className="controls-label">ARROWS · W S · DRAG</span><button className="play-card-button" type="button" onClick={onPlayPong}>Play Pong <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-invaders" hidden={!visibleGameIds.has('invaders')}>
            <div className="card-art invaders-card-art" aria-hidden="true">
              <span className="invaders-card-alien alien-one" /><span className="invaders-card-alien alien-two" /><span className="invaders-card-alien alien-three" />
              <span className="invaders-card-shot" /><span className="invaders-card-ship" />
              <span className="card-art-index">06</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">06</span><span className="game-category">ARCADE SHOOTER</span></div>
              <h3>Space Invaders</h3>
              <p>Hold the line and clear the formation before it reaches your ship.</p>
              <div className="card-bottom"><span className="controls-label">ARROWS · A D · SPACE</span><button className="play-card-button" type="button" onClick={onPlayInvaders}>Play Invaders <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-asteroids" hidden={!visibleGameIds.has('asteroids')}>
            <div className="card-art asteroids-card-art" aria-hidden="true">
              <span className="asteroids-card-rock rock-one" /><span className="asteroids-card-rock rock-two" /><span className="asteroids-card-rock rock-three" />
              <span className="asteroids-card-ship" /><span className="asteroids-card-shot" />
              <span className="card-art-index">07</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">07</span><span className="game-category">VECTOR SHOOTER</span></div>
              <h3>Asteroids</h3>
              <p>Rotate, thrust, and break up the field before the rocks catch your ship.</p>
              <div className="card-bottom"><span className="controls-label">ARROWS · A D · SPACE</span><button className="play-card-button" type="button" onClick={onPlayAsteroids}>Play Asteroids <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-missile" hidden={!visibleGameIds.has('missile')}>
            <div className="card-art missile-card-art" aria-hidden="true">
              <span className="missile-card-trail trail-one" /><span className="missile-card-trail trail-two" />
              <span className="missile-card-blast" /><span className="missile-card-city city-one" /><span className="missile-card-city city-two" /><span className="missile-card-city city-three" />
              <span className="card-art-index">08</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">08</span><span className="game-category">DEFENSE COMMAND</span></div>
              <h3>Missile Command</h3>
              <p>Intercept incoming missiles and keep the cities standing.</p>
              <div className="card-bottom"><span className="controls-label">AIM · ARROWS · CLICK</span><button className="play-card-button" type="button" onClick={onPlayMissileCommand}>Play Missile Command <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-blockdrop" hidden={!visibleGameIds.has('blockdrop')}>
            <div className="card-art blockdrop-card-art" aria-hidden="true">
              <span className="blockdrop-card-piece piece-line"><i /><i /><i /><i /></span>
              <span className="blockdrop-card-piece piece-tee"><i /><i /><i /><i /></span>
              <span className="blockdrop-card-piece piece-square"><i /><i /><i /><i /></span>
              <span className="card-art-index">09</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">09</span><span className="game-category">PUZZLE CLASSIC</span></div>
              <h3>Block Drop</h3>
              <p>Fit the falling pieces, clear rows, and keep the stack from reaching the top.</p>
              <div className="card-bottom"><span className="controls-label">ARROWS · X · SPACE · C</span><button className="play-card-button" type="button" onClick={onPlayBlockDrop}>Play Block Drop <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-wordgame" hidden={!visibleGameIds.has('wordgame')}>
            <div className="card-art wordgame-card-art" aria-hidden="true">
              <span className="wordgame-card-row"><i>W</i><i>O</i><i>R</i><i>D</i><i>S</i></span>
              <span className="wordgame-card-row card-row-two"><i>G</i><i>U</i><i>E</i><i>S</i><i>S</i></span>
              <span className="card-art-index">10</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">10</span><span className="game-category">DAILY WORD</span></div>
              <h3>Word Guess</h3>
              <p>Find a five-letter word in six guesses. A new shared puzzle arrives daily.</p>
              <div className="card-bottom"><span className="controls-label">LETTER KEYS · ENTER</span><button className="play-card-button" type="button" onClick={onPlayWordGame}>Play Word Guess <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-connections" hidden={!visibleGameIds.has('connections')}>
            <div className="card-art connections-card-art" aria-hidden="true">
              <span className="connections-card-grid"><i>LINK</i><i>WORD</i><i>SET</i><i>IDEA</i></span>
              <span className="card-art-index">11</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">11</span><span className="game-category">DAILY GROUPING</span></div>
              <h3>Connections</h3>
              <p>Sort sixteen words into four hidden groups. A new shared board arrives daily.</p>
              <div className="card-bottom"><span className="controls-label">TOUCH · CLICK · KEYBOARD</span><button className="play-card-button" type="button" onClick={onPlayConnections}>Play Connections <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-spellingbee" hidden={!visibleGameIds.has('spellingbee')}>
            <div className="card-art spelling-bee-card-art" aria-hidden="true">
              <span className="bee-card-hive"><i className="bee-card-hex hex-one" /><i className="bee-card-hex hex-two" /><i className="bee-card-hex hex-three" /><i className="bee-card-hex hex-four" /><i className="bee-card-hex hex-five" /><i className="bee-card-hex hex-six" /></span>
              <span className="card-art-index">12</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">12</span><span className="game-category">DAILY WORDS</span></div>
              <h3>Spelling Bee</h3>
              <p>Build words from seven letters. Use the centre letter and find a pangram.</p>
              <div className="card-bottom"><span className="controls-label">LETTER KEYS · ENTER</span><button className="play-card-button" type="button" onClick={onPlaySpellingBee}>Play Spelling Bee <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-strands" hidden={!visibleGameIds.has('strands')}>
            <div className="card-art strands-card-art" aria-hidden="true">
              <span className="strands-card-grid"><i>S</i><i>E</i><i>A</i><i>R</i><i>C</i><i>H</i><i>G</i><i>R</i><i>I</i><i>D</i><i>W</i><i>O</i><i>R</i><i>D</i><i>S</i><i>T</i></span>
              <span className="card-art-index">13</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">13</span><span className="game-category">DAILY WORD SEARCH</span></div>
              <h3>Strands</h3>
              <p>Trace five theme words and a spanning word through a daily letter field.</p>
              <div className="card-bottom"><span className="controls-label">TOUCH · CLICK · KEYBOARD</span><button className="play-card-button" type="button" onClick={onPlayStrands}>Play Strands <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-sudoku" hidden={!visibleGameIds.has('sudoku')}>
            <div className="card-art sudoku-card-art" aria-hidden="true">
              <span className="sudoku-card-grid"><i>4</i><i>·</i><i>8</i><i>·</i><i>2</i><i>·</i><i>·</i><i>7</i><i>1</i><i>·</i><i>6</i><i>·</i><i>3</i><i>·</i><i>5</i><i>·</i></span>
              <span className="card-art-index">14</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">14</span><span className="game-category">DAILY NUMBER GRID</span></div>
              <h3>Sudoku</h3>
              <p>Fill the nine-by-nine grid. Keep each number unique in its row, column, and box.</p>
              <div className="card-bottom"><span className="controls-label">KEYBOARD · TOUCH PAD</span><button className="play-card-button" type="button" onClick={onPlaySudoku}>Play Sudoku <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-minicrossword" hidden={!visibleGameIds.has('minicrossword')}>
            <div className="card-art minicrossword-card-art" aria-hidden="true">
              <span className="minicrossword-card-grid"><i>A</i><i>C</i><i>T</i><b /><b /><i>R</i><i>A</i><i>I</i><i>S</i><i>E</i><i>E</i><i>M</i><i>B</i><i>E</i><i>D</i><i>A</i><i>P</i><i>I</i><i>N</i><i>G</i><b /><b /><i>A</i><i>T</i><i>E</i></span>
              <span className="card-art-index">15</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">15</span><span className="game-category">DAILY WORD GRID</span></div>
              <h3>Mini Crossword</h3>
              <p>Five short clues across and down. Every crossing counts.</p>
              <div className="card-bottom"><span className="controls-label">LETTER KEYS · TOUCH PAD</span><button className="play-card-button" type="button" onClick={onPlayMiniCrossword}>Play Mini Crossword <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-letterboxed" hidden={!visibleGameIds.has('letterboxed')}>
            <div className="card-art letterboxed-card-art" aria-hidden="true">
              <span className="letterboxed-card-sides"><b>R N L</b><b>A E B</b><b>O I T</b><b>C W S</b></span>
              <span className="card-art-index">16</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">16</span><span className="game-category">DAILY WORD CHAIN</span></div>
              <h3>Letter Boxed</h3>
              <p>Link words across four sides. Cover every letter to solve the box.</p>
              <div className="card-bottom"><span className="controls-label">LETTER KEYS · TOUCH</span><button className="play-card-button" type="button" onClick={onPlayLetterBoxed}>Play Letter Boxed <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-domino" hidden={!visibleGameIds.has('dominologic')}>
            <div className="card-art domino-card-art" aria-hidden="true">
              <span className="domino-card-grid"><i>2</i><i>5</i><i>3</i><i>4</i><i>6</i><i>1</i><i>2</i><i>5</i><i>4</i><i>3</i><i>1</i><i>6</i></span>
              <span className="card-art-index">17</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">17</span><span className="game-category">DAILY SUM GRID</span></div>
              <h3>Domino Logic</h3>
              <p>Fit six tiles so every row and column hits its daily target.</p>
              <div className="card-bottom"><span className="controls-label">TAP · ROTATE · FLIP</span><button className="play-card-button" type="button" onClick={onPlayDominoLogic}>Play Domino Logic <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-glyphmatch" hidden={!visibleGameIds.has('glyphmatch')}>
            <div className="card-art glyphmatch-card-art" aria-hidden="true">
              <span className="glyphmatch-card-grid"><i>✦</i><i>☾</i><i>◆</i><i>▲</i><i>●</i><i>✿</i><i>⬟</i><i>⌁</i><i>⌁</i><i>⬟</i><i>✿</i><i>●</i><i>▲</i><i>◆</i><i>☾</i><i>✦</i></span>
              <span className="card-art-index">18</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">18</span><span className="game-category">DAILY PAIRS</span></div>
              <h3>Glyph Match</h3>
              <p>Turn over tiles, remember the symbols, and find today’s eight pairs.</p>
              <div className="card-bottom"><span className="controls-label">TOUCH · CLICK · ARROWS</span><button className="play-card-button" type="button" onClick={onPlayGlyphMatch}>Play Glyph Match <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-vertex" hidden={!visibleGameIds.has('vertex')}>
            <div className="card-art vertex-card-art" aria-hidden="true">
              <span className="vertex-card-web"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
              <span className="vertex-card-loop" />
              <span className="card-art-index">19</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">19</span><span className="game-category">DAILY LOOP</span></div>
              <h3>Vertex</h3>
              <p>Read the clues, connect the lines, and close one loop around the triangle grid.</p>
              <div className="card-bottom"><span className="controls-label">CLICK · TOUCH · KEYBOARD</span><button className="play-card-button" type="button" onClick={onPlayVertex}>Play Vertex <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-tiles" hidden={!visibleGameIds.has('tiles')}>
            <div className="card-art tiles-card-art" aria-hidden="true">
              <span className="tiles-card-patterns"><i>✦</i><i>☾</i><i>◆</i><i>▲</i><i>●</i><i>✿</i><i>⬟</i><i>⌁</i><i>■</i><i>✧</i></span>
              <span className="tiles-card-index card-art-index">20</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">20</span><span className="game-category">DAILY PATTERNS</span></div>
              <h3>Tiles</h3>
              <p>Match visible patterns from the open edges inward. Clear every pair to finish the board.</p>
              <div className="card-bottom"><span className="controls-label">TOUCH · CLICK · KEYBOARD</span><button className="play-card-button" type="button" onClick={onPlayTiles}>Play Tiles <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-pips" hidden={!visibleGameIds.has('pips')}>
            <div className="card-art pips-card-art" aria-hidden="true">
              <span className="pips-card-grid"><i>2</i><i>5</i><i>1</i><i>6</i><i>4</i><i>3</i><i>0</i><i>5</i><i>6</i><i>2</i><i>3</i><i>1</i></span>
              <span className="card-art-index">21</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">21</span><span className="game-category">DAILY DOMINO RULES</span></div>
              <h3>Pips</h3>
              <p>Place six dominoes to satisfy the different rules in each colored region.</p>
              <div className="card-bottom"><span className="controls-label">TOUCH · ROTATE · FLIP</span><button className="play-card-button" type="button" onClick={onPlayPips}>Play Pips <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-daily-crossword" hidden={!visibleGameIds.has('dailycrossword')}>
            <div className="card-art daily-crossword-card-art" aria-hidden="true">
              <span className="daily-crossword-card-grid">{Array.from({ length: 49 }, (_, index) => {
                const blocked = Math.floor(index / 7) === 3 || index % 7 === 3
                return <i className={blocked ? 'daily-crossword-card-block' : ''} key={index}>{blocked ? '' : ['A', 'R', 'E', 'T', 'O', 'Y', 'S', 'I', 'P'][index % 9]}</i>
              })}</span>
              <span className="card-art-index">22</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">22</span><span className="game-category">DAILY CROSSWORD</span></div>
              <h3>Daily Crossword</h3>
              <p>Take on a roomier seven-by-seven grid with twenty-four original crossing clues.</p>
              <div className="card-bottom"><span className="controls-label">LETTER KEYS · TOUCH PAD</span><button className="play-card-button" type="button" onClick={onPlayCrossword}>Play Daily Crossword <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
          <article className="game-card game-card-minesweeper" hidden={!visibleGameIds.has('minesweeper')}>
            <div className="card-art minesweeper-card-art" aria-hidden="true">
              <span className="minesweeper-card-grid"><i>1</i><i>2</i><i>1</i><i>·</i><i>3</i><i>⚑</i><i>1</i><i>●</i><i>1</i></span>
              <span className="card-art-index">23</span>
            </div>
            <div className="card-info">
              <div className="card-heading-line"><span className="game-number">23</span><span className="game-category">DAILY CLASSIC</span></div>
              <h3>Minesweeper</h3>
              <p>Read the numbers, mark the mines, and clear today's shared field.</p>
              <div className="card-bottom"><span className="controls-label">TOUCH · F · ARROWS</span><button className="play-card-button" type="button" onClick={onPlayMinesweeper}>Play Minesweeper <span className="arrow-mark" aria-hidden="true" /></button></div>
            </div>
          </article>
        </div>
      </section>
      <section className="home-preferences" aria-labelledby="preferences-title">
        <div>
          <h2 id="preferences-title">Preferences</h2>
        </div>
        <label className="motion-setting">
          <input type="checkbox" checked={reduceMotion} onChange={(event) => onReduceMotionChange(event.currentTarget.checked)} />
          <span><strong>Reduce motion</strong><small>Animations are reduced. Your system setting also applies.</small></span>
        </label>
        <label className="sound-setting">
          <input type="checkbox" checked={soundEffects} onChange={(event) => onSoundEffectsChange(event.currentTarget.checked)} />
          <span><strong>Arcade sounds</strong><small>Short beeps are made in your browser. Off by default.</small></span>
        </label>
        <div className="install-setting">
          <span><strong>Offline play</strong><small>After your first visit, the games are ready without a connection.</small></span>
          {installAvailable && <button className="install-button" type="button" onClick={onInstall}>Install Arcade</button>}
        </div>
        <div className="records-setting">
          <div>
            <strong>Personal bests</strong>
            <small>Saved in this browser. They do not sync.</small>
          </div>
          {hasRecords ? (
            <button
              className="clear-records-button"
              type="button"
              aria-expanded={confirmClearRecords}
              aria-controls="clear-records-confirmation"
              onClick={() => setConfirmClearRecords((open) => !open)}
            >
              Clear records
            </button>
          ) : <small className="records-clear-note">No saved records.</small>}
          {confirmClearRecords && hasRecords && (
            <div
              id="clear-records-confirmation"
              className="clear-records-confirmation"
              role="group"
              aria-labelledby="clear-records-question"
              onKeyDown={(event) => { if (event.key === 'Escape') setConfirmClearRecords(false) }}
            >
              <p id="clear-records-question">Clear all personal bests saved in this browser? This cannot be undone. Your preferences and today's daily completion will stay saved.</p>
              <div>
                <button className="button button-quiet" type="button" onClick={() => setConfirmClearRecords(false)}>Keep records</button>
                <button className="button button-danger" type="button" onClick={() => { onClearRecords(); setConfirmClearRecords(false) }}>Clear all records</button>
              </div>
            </div>
          )}
        </div>
        <div className="backup-setting">
          <div>
            <strong>Local data backup</strong>
            <small>Download your records, preferences, and daily puzzle progress as a JSON file. Restoring a backup replaces this browser’s saved Arcade data after confirmation.</small>
          </div>
          <div className="backup-actions">
            <button className="backup-action-button" type="button" onClick={onDownloadBackup}>Download backup</button>
            <button className="backup-action-button" type="button" onClick={() => backupFileInput.current?.click()}>Choose backup file</button>
            <input
              ref={backupFileInput}
              type="file"
              hidden
              accept=".json,application/json"
              aria-label="Choose Arcade backup file"
              onChange={handleBackupFileChange}
            />
          </div>
          {backupRestorePending && (
            <div
              id="backup-restore-confirmation"
              className="backup-restore-confirmation"
              role="group"
              aria-labelledby="backup-restore-question"
              onKeyDown={(event) => { if (event.key === 'Escape') onCancelBackupRestore() }}
            >
              <p id="backup-restore-question">Replace this browser’s saved records, daily progress, and preferences with the selected backup?</p>
              <div>
                <button className="button button-quiet" type="button" onClick={onCancelBackupRestore}>Cancel restore</button>
                <button className="button button-primary" type="button" onClick={onRestoreBackup}>Restore backup</button>
              </div>
            </div>
          )}
        </div>
        <p className="local-data-note">No accounts or public leaderboards. Scores, preferences, and daily progress stay in this browser and do not sync. You can download a backup file when you choose.</p>
        <p className="storage-notice" role="status" aria-live="polite">{storageNotice}</p>
      </section>
    </>
  )
}

function DirectionButton({ direction, onTurn }: { direction: Direction; onTurn: (direction: Direction) => void }) {
  const arrows: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' }
  return (
    <button
      className={`dpad-button dpad-${direction}`}
      type="button"
      aria-label={`Move ${direction}`}
      onClick={() => onTurn(direction)}
    >
      {arrows[direction]}
    </button>
  )
}

function cellKind(point: Point, snake: Point[], food: Point | null) {
  if (snake[0] && snake[0].x === point.x && snake[0].y === point.y) return 'head'
  if (snake.some((segment) => segment.x === point.x && segment.y === point.y)) return 'snake'
  if (food && food.x === point.x && food.y === point.y) return 'food'
  return 'empty'
}

function overlayTitle(status: string) {
  if (status === 'paused') return 'Taking a breather.'
  if (status === 'over') return 'That’s a wrap.'
  if (status === 'won') return 'A perfect run.'
  return 'Ready when you are.'
}

function overlayCopy(status: string, score: number) {
  if (status === 'paused') return 'Press resume when you’re ready.'
  if (status === 'over') return `${score} ${score === 1 ? 'dot' : 'dots'} collected. Fancy another?`
  if (status === 'won') return 'You filled the whole field.'
  return 'Collect a dot. Find your rhythm.'
}

function snakeStatusText(status: string, score: number) {
  if (status === 'playing') return `Snake is playing. Score ${score}. Use arrow keys or WASD to steer. Press Escape to pause.`
  if (status === 'paused') return `Snake is paused. Score ${score}. Resume when ready.`
  if (status === 'over') return `Game over. Score ${score}. Play again to restart.`
  if (status === 'won') return 'You filled the whole field. Play again to start a new game.'
  return 'Snake is ready. Use arrow keys or WASD to steer after starting.'
}

export default App
