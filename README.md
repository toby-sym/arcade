# Arcade

A personal browser arcade with a neon-lit cabinet feel. Snake, Reaction, Pattern Memory, Breakout, Pong, Space Invaders, Asteroids, Missile Command, Block Drop, Word Guess, Connections, Spelling Bee, Strands, and Sudoku are ready for free play.

## Local development

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Vite prints the local URL after startup. Choose any of the fourteen games from the game floor.

## Snake controls

- **Arrow keys** or **WASD** to steer.
- **Direction pad** for touch screens.
- **Pause** in the game panel or press **Escape** while the playfield is focused.
- **Restart** to begin a new run.

Collect dots without hitting the walls or your tail. The game pauses when the browser tab is hidden. Motion effects honor the system reduced-motion preference.

## Reaction controls

- Press **Start a round**, then wait for the red panel to turn green.
- Tap or click the panel, or press **Space**, as soon as it turns green.
- Pressing before the signal ends the round. **Restart** resets the current attempt.
- If the browser tab is hidden during a round, the attempt resets.

Each reaction time is measured locally with a high-resolution browser timer. Only the best time is kept in this browser; attempts are not sent or saved.

## Pattern Memory controls

- Select **Start practice** to watch a growing pattern, then repeat it. Each completed round adds a tile.
- Select **Daily challenge** for the same fixed eight-tile pattern on a given UTC date. A new pattern appears each day. Completing it marks that UTC date complete in this browser; you can still replay it.
- Tap or click the tiles in the same order. A mistake ends that attempt; you can retry.
- Keyboard users can Tab to a tile and press **Enter** or **Space**.
- **Pause** holds the sequence or your input position. A hidden browser tab pauses the game; **Resume** continues it. **Restart** resets the current mode.

## Breakout controls

- Select **Start game** or press **Space** to launch the ball. After losing a life, press **Launch ball** or **Space** to serve again.
- Move the paddle with the **left and right arrow keys** or **A and D** while the playfield is focused. Hold a direction to keep moving; release it to stop.
- On touch screens, drag across the field to steer the paddle.
- **Pause** in the game panel or press **Escape** while the playfield is focused. The game also pauses when the browser tab is hidden.
- Clear all bricks to finish the run. **Restart** begins with three lives and a fresh wall.

## Pong controls

- Select **Start match** or press **Space** to serve. After either player scores, press **Serve** or **Space** to continue.
- Move your paddle with the **up and down arrow keys** or **W and S** while the playfield is focused. Hold a direction to keep moving; release it to stop.
- On touch screens, drag up or down across the field to move the paddle.
- Choose **Calm**, **Steady**, or **Quick** computer pace before the match. The choice is saved in this browser and can be changed for the next match.
- **Pause** in the game panel or press **Escape** while the playfield is focused. The match also pauses when the browser tab is hidden.
- Reach five points before the computer to win. Your highest points in a match are saved as a local personal best.

## Space Invaders controls

- Select **Start game**, then move with the **left and right arrow keys** or **A and D** while the playfield is focused. Hold a direction to keep moving.
- Press **Space** to fire. On touch screens, tap the direction buttons and **Fire** below the field.
- **Pause** in the game panel or press **Escape** while the playfield is focused. The game pauses when the browser tab is hidden; **Restart** begins with three ships and a fresh formation.
- Clear the formation before it reaches your ship. Your highest score is saved as a local personal best.

## Asteroids controls

- Select **Start game**. Rotate with the **left and right arrow keys** or **A and D**; hold **up** or **W** to thrust and hold **Space** to fire.
- On touch screens, hold the rotate, thrust, and fire buttons below the field.
- The field wraps at each edge. Break large rocks into smaller ones, clear each wave, and dodge rocks while your ship respawns.
- **Pause** in the game panel or press **Escape** while the playfield is focused. A hidden browser tab pauses the game; **Restart** begins again with three ships.
- Your highest score is saved as a local personal best.

## Missile Command controls

- Select **Start game**, or click or tap the playfield to start firing at that spot. Later taps launch interceptors at their target.
- Keyboard users can move the target with the **arrow keys** or **WASD**, then press **Space**. Touch users can tap the field or move the aim with the direction buttons and select **Fire at target**.
- Each silo has limited ammunition. Interceptors create a growing blast that can clear a group of missiles. Reloads arrive between waves.
- **Pause** in the game panel or press **Escape** while the playfield is focused. A hidden browser tab pauses the game; **Restart** begins with six cities and full silos.
- Your highest score is saved as a local personal best.

## Block Drop controls

- Select **Start game**. Use the **left and right arrow keys** to move a piece, **up** or **X** to rotate clockwise, and **Z** to rotate counterclockwise.
- Hold **down** to soft drop, press **Space** to drop the piece immediately, and press **C** or **Shift** to hold a piece once before the next lock.
- On touch screens, use the buttons under the board to move, rotate, hold, soft drop, and drop a piece.
- Fill a row to clear it. The fall speeds up every ten rows. **Pause** in the game panel or press **Escape** while the board is focused; a hidden browser tab pauses the game. **Restart** begins with an empty board.
- Your highest score is saved as a local personal best.

## Word Guess controls

- Open **Word Guess** to play the daily five-letter puzzle. Type with a physical keyboard or use the on-screen keys; press **Enter** to submit and **Backspace** to edit.
- Green marks a letter in the right place. Gold marks a letter elsewhere in the answer. Repeated letters only receive a mark while the answer has an unmatched copy.
- Solve the word in six guesses. The same answer is used for the whole UTC date; the puzzle changes at midnight UTC. Your submitted guesses stay saved in this browser if you leave and return.
- The lowest number of guesses used for a solve is saved as a local personal best. The daily word and guesses are generated in the app; no external game service is used.

## Connections controls

- Open **Connections** for the daily sixteen-word board. Select four words that share an idea, then press **Submit set**. Use **Deselect all** to clear your choice or **Shuffle** to rearrange the remaining words.
- Find four groups before making four mistakes. A “one away” message means three selected words belong to the same group. Found groups remain visible while you finish the board; the answers are shown after the last mistake.
- The puzzle and initial word order are the same for everyone on a UTC date. Your selected words, found groups, and mistakes are saved in this browser when you leave and return.
- Your fewest mistakes on a completed board is saved as a local personal best. Puzzle sets are built into Arcade and do not use an external game service.

## Spelling Bee controls

- Open **Spelling Bee** for the daily seven-letter hive. Type with a physical keyboard or tap the letter cells; press **Enter** to submit, **Backspace** to delete a letter, and **Shuffle** to rearrange the outer letters.
- Make words of at least four letters, use the centre letter in every word, and reuse letters as needed. A word using all seven letters earns a pangram bonus.
- The same hive and local word list are used for the whole UTC date. Found words stay saved in this browser if you leave and return. Find every word to complete the board.
- The highest score for a completed hive is saved as a local personal best. Hives and word lists are bundled with Arcade; no external game service is used.

## Strands controls

- Open **Strands** for the daily six-row letter field. Tap, click, or focus adjacent letters in order to trace five theme words and the spanning word. Diagonal neighbors count.
- Use **Undo** to remove the last letter, **Clear path** to start over, or **Hint** to reveal a letter from an unsolved word.
- The spanning word reaches both sides of the field. The same puzzle and found words are saved in this browser for the UTC date.
- The fewest hints for a completed board is saved as a local personal best. Puzzles are bundled with Arcade; no external game service is used.

## Sudoku controls

- Open **Sudoku** for a new nine-by-nine grid each UTC day. Select a square, then enter **1–9** with the keyboard or number pad. Arrow keys move the selection; **Backspace** or **Delete** clears an editable square.
- Rows, columns, and 3×3 boxes must each contain 1–9 once. Duplicate entries are highlighted. **Hint** fills one empty square; **Clear entries** restores the original grid.
- Your current grid and hints stay saved in this browser. The fewest hints on a completed grid is saved as a local personal best. Puzzles are generated in the app without an external game service.

## Local records and preferences

Arcade saves the highest scores for Snake, Asteroids, Space Invaders, Missile Command, Block Drop, Breakout, and a completed Spelling Bee hive; Pong's highest points in a match; the fewest guesses for a Word Guess solve; the fewest mistakes for a completed Connections board; the fewest hints for completed Strands and Sudoku grids; the fastest Reaction time; the most Pattern Memory practice rounds completed; and the latest daily Pattern Memory completion date in browser storage. Word Guess, Connections, Spelling Bee, Strands, and Sudoku save their current daily progress there too. The **Reduce motion**, **Arcade sounds**, and Pong opponent pace preferences are saved there as well. Arcade sounds are short synthesized beeps made locally in the browser and are off by default. These records and preferences stay on this browser and do not sync or leave the app. Use **Clear records** under Preferences to remove all personal bests from this browser; daily progress and preferences stay saved. The system reduced-motion setting is always respected.

## Install and offline play

On supported browsers, select **Install Arcade** under Preferences when the browser offers installation, or use its **Add to Home Screen** option. The first visit needs an internet connection. Arcade then caches its app shell and game assets on this device so the games can be opened offline; updates are applied automatically when a connection is available. The app does not send records, preferences, or game data to a server.

The development server does not register a service worker. To check offline play locally, build the production app and serve it with `npm run preview`, or run the production container.

## Checks

```sh
npm run check
```

This runs TypeScript checks, game logic, interface, and local-storage tests, release-promotion integration checks, a dependency audit, and a production build.

## Container

```sh
docker build --tag arcade .
docker run --rm -p 8080:8080 arcade
```

The production container serves the built app as a non-root user on `0.0.0.0:8080`, has a `/health` endpoint, and falls back to `index.html` for client-side routes. `APP_VERSION` can be supplied as a Docker build argument. Release builds use the automatically recorded semantic version; local builds display `Development`.

If a build environment uses a custom TLS certificate for npm traffic, the Dockerfile accepts it as a temporary BuildKit secret: `docker build --secret id=build_ca,src="$NODE_EXTRA_CA_CERTS" --tag arcade .`. The certificate is used only while installing packages and is not copied into the image.

## Releases and deployment

Pushes to feature branches and pull requests run the app and container checks. A successful push to `main` promotes it to `release`: the workflow merges the latest `main`, calculates the next semantic version from existing tags (first release `0.1.0`, otherwise patch by default), writes the version, and pushes the versioned commit and tag atomically. It then publishes a GitHub Release. A `Release-Bump: minor` or `Release-Bump: major` commit trailer can request a larger bump; a manual workflow run from `main` also offers those choices.

Coolify deploys from the `release` branch through the existing push webhook. Arcade needs no database, account service, external game service, analytics, or client-side secrets. Cloudflare Tunnel and Coolify settings are managed outside this repository.
