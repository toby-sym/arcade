import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import {
  BOARD_SIZE,
  createSnakeState,
  snakeReducer,
  type Direction,
  type Point,
} from './games/snake'
import { ReactionGame } from './games/ReactionGame'
import { PatternGame } from './games/PatternGame'
import { BreakoutGame } from './games/BreakoutGame'
import { PongGame } from './games/PongGame'
import { InvadersGame } from './games/InvadersGame'
import { AsteroidsGame } from './games/AsteroidsGame'
import { ArcadeAudioProvider, playArcadeSound, setArcadeAudioEnabled } from './audio/arcadeAudio'
import type { PongDifficulty } from './games/pong'
import { clearArcadeBests, readArcadeData, withDailyPatternCompletion, withImprovedBest, writeArcadeData, type ArcadeBests } from './storage/arcadeData'

const version = import.meta.env.VITE_APP_VERSION || 'Development'
const versionLabel = version === 'Development' ? version : `v${version}`

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
  const [screen, setScreen] = useState<'home' | 'snake' | 'reaction' | 'pattern' | 'breakout' | 'pong' | 'invaders' | 'asteroids'>('home')
  const [snake, dispatch] = useReducer(snakeReducer, undefined, () => createSnakeState())
  const [arcadeData, setArcadeData] = useState(readArcadeData)
  const [storageNotice, setStorageNotice] = useState('')
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

  const recordDailyCompletion = (date: string) => {
    const next = withDailyPatternCompletion(arcadeData, date)
    if (!next) return
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
        {screen === 'home' ? (
          <Home
            onPlaySnake={openSnake}
            onPlayReaction={openReaction}
            onPlayPattern={openPattern}
            onPlayBreakout={openBreakout}
            onPlayPong={openPong}
            onPlayInvaders={openInvaders}
            onPlayAsteroids={openAsteroids}
            reduceMotion={arcadeData.preferences.reduceMotion}
            onReduceMotionChange={setReduceMotion}
            soundEffects={arcadeData.preferences.soundEffects}
            onSoundEffectsChange={setSoundEffects}
            hasRecords={Object.values(arcadeData.bests).some((record) => record !== null)}
            onClearRecords={clearRecords}
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
  reduceMotion,
  onReduceMotionChange,
  soundEffects,
  onSoundEffectsChange,
  hasRecords,
  onClearRecords,
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
  reduceMotion: boolean
  onReduceMotionChange: (reduceMotion: boolean) => void
  soundEffects: boolean
  onSoundEffectsChange: (enabled: boolean) => void
  hasRecords: boolean
  onClearRecords: () => void
  storageNotice: string
  installAvailable: boolean
  onInstall: () => void
}) {
  const [confirmClearRecords, setConfirmClearRecords] = useState(false)

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
          <span className="section-count">07 PLAYABLE</span>
        </div>
        <div className="game-list">
          <article className="game-card game-card-snake">
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
          <article className="game-card game-card-reaction">
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
          <article className="game-card game-card-pattern">
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
          <article className="game-card game-card-breakout">
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
          <article className="game-card game-card-pong">
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
          <article className="game-card game-card-invaders">
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
          <article className="game-card game-card-asteroids">
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
        <p className="local-data-note">No accounts or public leaderboards. Personal bests and these preferences stay in this browser and do not sync.</p>
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
