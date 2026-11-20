# Arcade

A personal browser arcade with a neon-lit cabinet feel. Snake, Reaction, Pattern Memory, Breakout, Pong, Space Invaders, Asteroids, Missile Command, Block Drop, Word Guess, Connections, Spelling Bee, Strands, Sudoku, Mini Crossword, Daily Crossword, Letter Boxed, Domino Logic, Glyph Match, Vertex, Tiles, Pips, Minesweeper, Maze Dash, Skyline Skip, Cipher Circuit, Orbit Courier, Color Conduit, Switchyard, Prism Dash, Gravity Loom, Tideglass, Skyhook, Pocket Pinball, Neon Rally, Moonshot Mini Golf, Beat Beacon, Tuning Fork, Magnetron, Keystone, Beamworks, Rack Run, Pin Parade, and Deckhand are ready for free play.

See the [game roadmap](docs/game-roadmap.md) for the shipped catalogue and original game ideas queued next.

## Local development

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Vite prints the local URL after startup. Choose any of the forty-three games from the game floor.

Use **Find a game** to search titles and game types, or filter the floor to **Arcade** games or **Daily puzzles**. The search and filters work together; choose **All games** to clear the category filter.

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
- Hold the **left** or **right arrow keys** or **A** and **D** to move; movement follows the time held. Press **Space** to fire. On touch screens, hold a direction button to move and tap **Fire** below the field.
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
- Hold an **arrow key** or **WASD** direction to move the target smoothly, then press **Space** to fire. Touch users can tap the field or hold a direction button to move the aim, then select **Fire at target**.
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

## Mini Crossword controls

- Open **Mini Crossword** for the daily five-by-five grid with black squares and independent Across and Down answers. Select a square or clue, then type **A–Z** or use the on-screen letter pad. **Arrow keys** move through open squares and **Enter** switches between Across and Down.
- Fill all five Across and five Down clues. **Backspace** erases, **Hint** reveals and locks one square, and **Clear entries** restarts the daily board.
- The same puzzle is shared for a UTC date. Your entries and hints stay saved in this browser. The fewest hints for a completed grid is saved as a local personal best. Puzzles are bundled with Arcade; no external game service is used.

## Daily Crossword controls

- Open **Daily Crossword** for a roomier seven-by-seven grid with twelve clues across and twelve down. Select a square or clue, then type **A–Z** or use the on-screen letter pad. **Arrow keys** move through open squares; **Enter** switches between Across and Down.
- **Backspace** erases, **Hint** reveals and locks one square, and **Clear entries** resets the same daily board.
- The same puzzle is shared for a UTC date. Your entries and hints stay saved in this browser. The fewest hints for a completed grid is saved as a local personal best. Puzzles are bundled with Arcade; no external game service is used.

## Minesweeper controls

- Open **Minesweeper** for the same nine-by-nine field with ten mines for everyone on a UTC date. The center opening is safe; a new field arrives at midnight UTC.
- Press **Start field**, then reveal squares with a tap or click. Each number tells how many mines touch that square. Reveal every safe square to win.
- Turn on **Flag mode** before tapping a covered square, right-click with a mouse, or focus a square and press **F** to mark a mine. When the surrounding flags match a revealed number, tap that number or press **C** to reveal its covered neighbors. Arrow keys move between squares; **Enter** or **Space** reveals or chords the focused square.
- **Pause** stops the clock. Your open squares, flags, and time stay saved in this browser if you leave and return. **Restart daily field** begins the same puzzle again.
- The fastest solve is saved as a local personal best. Boards are generated by Arcade; no external game service is used.

## Maze Dash controls

- Hold the **arrow keys** or **WASD** to move; on a phone, tap the direction pad to move one tile. Sentries move after every other step.
- Collect every gem, then reach the exit in the lower-right corner. A sentry collision costs one of your three lives. **Pause**, **Resume**, and **Restart maze** are available at any time; **Escape** pauses and **R** restarts.
- Your highest score is a local personal best saved in this browser.

## Skyline Skip controls

- Run with the **left and right arrow keys** or **A and D**; press **Space**, **Up**, or **W** to jump. Hold the direction buttons and tap **Jump** on a phone.
- Keep momentum over gaps, land on the next roof, and leap over signal spikes. Collect shards for points and reach each beacon to set a checkpoint. A fall or spike costs one of three lives.
- **Pause** in the game panel or press **Escape** while the course is focused. A hidden browser tab pauses the run; **Restart run** begins at the first rooftop.
- Reach the beacon at the far end to finish. Your highest score is saved locally in this browser and does not sync.

## Cipher Circuit controls

- Open **Cipher Circuit** for the daily four-signal code. The same key is used for everyone on the UTC date; a new pattern arrives at midnight UTC.
- Choose four signals from the palette by touch, click, or keys **1–6**. Press **Enter** or **Send pulse** to check a row. **Backspace** removes the latest signal; **Clear row** empties the current pulse.
- **Locked** means the signal and socket are correct. **Rerouted** means the signal belongs in another socket. Repeated signals are possible, and each signal can only contribute to feedback once. Solve the key in eight pulses.
- Your rows and unfinished input stay saved in this browser. The fewest pulses for a solve is saved as a local personal best; progress and records do not sync.

## Orbit Courier controls

- Pilot with **Left / Right** or **A / D** to turn. Hold **Up / W** to thrust and **Down / S** to brake drift. The field wraps at its edges, so plan your approach around the route rather than fighting your momentum.
- Carry three packages to their gold station rings. Enter a ring and slow below **76 units per second**, then press **Space** or **Dock cargo**. Debris strikes use one of three hull points and return you to the last dock.
- On a phone, hold the turn, thrust, and brake buttons, then tap **Dock cargo**. **Escape** pauses the flight; **R** restarts the route.
- A smoother dock earns more points, with time and remaining hull bonuses for a complete route. Your highest score is saved locally in this browser and does not sync.

## Color Conduit controls

- Open **Color Conduit** for the same four-signal board on a UTC date. Choose a signal from the palette or press **1–4**, then connect its two matching terminals through adjacent squares. Signals cannot share or cross a square; every one of the 36 squares must be powered.
- Click or tap squares to route them, or drag across the board. Focus the grid and use **Arrow keys** to move the cursor, then **Enter** to add a square. **U** or **Backspace** undoes one square, **C** clears the selected route, and **Escape** pauses or resumes.
- Your routes are saved as you play. The fastest completed time is a local personal best saved in this browser and does not sync. Daily boards are generated by Arcade without an external service.

## Switchyard controls

- Open **Switchyard** for the same freight timetable on a UTC date. Each car shows its depot; press **1–3**, use the arrow keys, or tap a switch button to set the route before the car reaches the junction.
- A matching route delivers the cargo, builds your streak, and adds points. Three missed depots end the shift; safely route fifteen cars to finish. The timetable grows faster as your deliveries climb.
- **Space** starts or resumes, **Escape** pauses, and **R** restarts the run. The best score is saved locally in this browser and does not sync.

## Prism Dash controls

- Open **Prism Dash** for the same three-lane course on a UTC date. Each checkpoint places a shard and a gate in different lanes; catch the shard for points or move to the open lane to stay safe.
- Shift one lane with **Left / Right** or **A / D**. Press **1–3** or tap a lane button to move directly. Three gate hits end the run; clear all 24 checkpoints to reach the finish.
- **Space** starts or resumes, **Escape** pauses, and **R** restarts the course. The highest run score is saved locally in this browser and does not sync.

## Gravity Loom controls

- Open **Gravity Loom** for the same four chamber route on a UTC date. Tilt north, east, south, or west; the spark rolls until a wall stops it. A portal carries it to its pair and the spark keeps rolling in that direction. Guide it into each receiver to light the next chamber.
- Use the **Arrow keys**, **W A S D**, or the four touch controls. Each tilt counts, even if the spark cannot move. The route is complete when all four receivers are lit.
- **Space** starts or resumes, **Escape** pauses, and **R** restarts today's route. Your fewest-tilt solve is saved locally in this browser and does not sync.

## Tideglass controls

- Open **Tideglass** for a daily harbor with three colored buoys and matching berths. Select a buoy, then move it one water cell with the **Arrow keys**, **W A S D**, or the four touch controls. Press **1–3** to select a buoy from the focused board.
- Tap or click a sluice tile to open or close that channel. Breakwaters and other buoys block movement; a buoy moors when it reaches its matching berth. A sluice cannot close while a buoy occupies it.
- Each legal current step and sluice change counts toward your route. The displayed par is the shortest possible route. **Space** starts or resumes, **Escape** pauses, and **R** restarts today's harbor.
- Your fewest-move solve is saved locally in this browser and does not sync. Daily harbors are generated by Arcade and work offline.

## Skyhook controls

- Open **Skyhook** for a daily flight course. Hold **Left / Right** or **A / D** to pump a tether swing. **Up / W** reels the cable in while attached and thrusts in flight; **Down / S** pays cable out or brakes drift.
- Press **Space** to release the tether. Press it again inside a new anchor's catch ring to latch on; when an anchor is already close, it transfers the tether while keeping the capsule's momentum. Collect all three beacons in order, then enter the gold dock ring.
- On touch screens, hold the four flight buttons below the field and use **Grapple / release** to manage the tether. **Escape** or **Pause flight** holds the course; **R** or **Restart course** resets it. Shard collisions and the field edge use one of three hull points; damage returns you to the last anchor briefly protected.
- The same course is used for the UTC date. Your best flight score stays in this browser and does not sync.

## Pocket Pinball controls

- Select **Start game**, then **Launch ball** or press **Space**. Hold **Left / A** and **Right / D** for the matching flippers; the flippers move continuously for as long as each key or touch button is held.
- Pop bumpers score 75–150 points. Light each of the three upper targets for 250 points; a lower slingshot kicks the ball back up the table.
- Press **Shift / N** or select **Nudge table** for a timed save. Each nudge costs 100 points and has a short cooldown. Three balls are available per game; a drain sends the next ball to the shooter lane.
- **Pause table** or **Escape** holds the game; **Restart table** or **R** starts over. Your highest score stays in this browser and does not sync.

## Letter Boxed controls

- Open **Letter Boxed** for a daily box of twelve letters arranged on four sides. Type **A–Z** or tap the side letters to make a word, then select **Enter word** or press **Enter**.
- Words must use letters from the box, switch sides between every pair of letters, and contain at least three letters. Each next word starts with the previous word's last letter. Cover all twelve letters to complete the box; the bundled dictionary is used offline.
- Your daily chain and fewest-word solve stay in this browser. A new box arrives each UTC day.

## Domino Logic controls

- Open **Domino Logic** for the daily three-by-four sum grid. Select a domino, then select an empty cell for its left or top half. Use **Rotate** or press **R** to change direction; use **Flip** or press **F** to swap its ends.
- Place all six dominoes so every row and column reaches its target. **Undo** or **Backspace** removes the last tile; **Restart** clears the grid while keeping the same daily puzzle.
- The same puzzle is shared for a UTC date. Your placements and fewest undos stay in this browser and do not sync.

## Glyph Match controls

- Open **Glyph Match** for the daily sixteen-tile board. Select two tiles by touch, click, or keyboard to turn them over; matched pairs stay face up. Use arrow keys to move between tiles and **Enter** or **Space** to select.
- A mismatch turns back after a short pause. **Restart board** resets the current daily puzzle without changing its glyph layout.
- Your matched pairs, turn count, and fewest-turn solve stay in this browser and do not sync. The board changes each UTC day.

## Vertex controls

- Open **Vertex** for the daily triangular loop puzzle. Each point shows how many lines should meet there; connect the edges to form one continuous loop.
- Click or tap a line to add or remove it. Keyboard users can **Tab** to a line and press **Enter** or **Space**. **Restart board** clears the current lines without changing the puzzle.
- Your line selections, move count, and fewest-move solve stay in this browser and do not sync. The puzzle changes each UTC day.

## Tiles controls

- Open **Tiles** for the daily four-by-five pattern board. Match two identical visible patterns to clear a pair. A tile is free when its left or right side is open; cleared neighbors expose new tiles.
- Click, tap, or focus a free tile and press **Enter** or **Space**. **Restart board** restores the same daily layout.
- Your cleared pairs, mistakes, and best solve stay in this browser and do not sync. Boards change each UTC day.

## Pips controls

- Open **Pips** for the daily three-by-four domino board. Select a domino, then select an empty board cell. Use **Rotate** or press **R** to change direction; use **Flip** or press **F** to swap its ends.
- Fill each colored region to match its rule: exact total, all equal, all different, under a target, or over a target. **Undo** or **Backspace** returns the last domino to the tray; **Restart** clears the placements for the same puzzle.
- Your placements and fewest undos stay in this browser and do not sync. The puzzle changes each UTC day.

## Neon Rally controls

- Race three laps around the North Loop and pass every lit gate in order. A missed gate stays active until you cross it.
- Hold **Up / W** to accelerate, **Down / S** to brake, and **Left / Right** or **A / D** to steer. Ease off before the bends; the grass slows the car.
- On a phone, hold the four touch controls. **Escape** pauses, and **R** restarts the race.
- The fastest three-lap time stays saved in this browser and does not sync.

## Moonshot Mini Golf controls

- Finish the five original lunar holes in as few strokes as you can. The tour is par 18; walls rebound the ball and craters slow it down.
- Pull back from the ball and release to aim and set shot power. You can also aim with **Left / Right** or **A / D**, change power with **Up / Down** or **W / S**, then shoot with **Space** or **Enter**.
- On touch screens, drag from the ball or use the aim buttons and power slider. **Return to tee** resets the current hole and adds one penalty stroke.
- Escape pauses. **R** restarts the tour. Your fewest strokes stay saved in this browser and do not sync.

## Beat Beacon controls

- Select **Start the set** and follow the four-beat count-in. The pad that lights is the beat cue; hit that pad as close to the pulse as you can.
- Use **Q**, **W**, **E**, and **R** for Kick, Snare, Hi-hat, and Tom, or tap the four pads. The four original eight-beat patterns get quicker each round.
- A hit within 45 ms earns **Perfect**, within 105 ms earns **Good**, and within 180 ms earns **Close**. Wrong pads and missed beats score zero.
- **Pause set** or **Escape** pauses the set; the browser also pauses it when the tab is hidden. **Restart** begins a fresh four-pattern set.
- The highest timing score is saved as a local personal best. Optional synthesized beat cues use Arcade sounds; the cues are also shown visually.

## Tuning Fork controls

- Select **Start listening**. Each pair plays two locally synthesized notes and shows the pitch contour between them.
- Choose whether the target note moved **up** or **down** by a **step** or a **leap**. Use **1–4** or tap one of the four choices; **Play pair again** repeats the current cue.
- Complete eight original pairs. Each correct interval earns 100 points; a missed choice advances to the next pair and reveals its direction and size.
- **Pause set** or **Escape** holds the current pair. **Restart** clears the run.
- Your highest score stays saved in this browser and does not sync. Audio is optional; the visual pitch contour remains available when Arcade sounds are off.

## Magnetron controls

- Reverse magnetic posts to pull or push the puck through three original obstacle courses and into each exit ring. A polarity change sends a quick field pulse toward or away from that post; no key holding is needed.
- Use **1–4** for posts in order or tap their polarity controls. Posts show their current pull or push state with both a sign and a label.
- **Escape** pauses or resumes. **Reset puck** returns to the start of the current course and adds three seconds. **R** or **Restart** begins a fresh three-course run. The game pauses when its browser tab is hidden.
- Your fastest clear stays saved in this browser and does not sync.

## Keystone controls

- Push every block onto a socket to hold the lock open, then reach the exit. Blocks can be pushed but not pulled. Clear four original chambers in one route.
- Use the **Arrow keys** or **W A S D**, or tap the direction pad. Each press moves one square; holding a key does not repeat. **Z** or **Undo** takes back one move.
- **Escape** pauses or resumes. **R** or **Restart** begins the route again.
- Your fewest moves across all four chambers stays saved in this browser and does not sync.

## Beamworks controls

- Route the beam through mirrors and into the receiver. Clear four original circuits in as few mirror turns as possible.
- Tap a mirror or press its **1–4** key to switch between its slash and backslash angles. The ray updates immediately, and connecting a receiver advances to the next circuit.
- **Z** or **Undo** takes back a turn. **Escape** pauses or resumes; **R** or **Restart** resets the route.
- Your fewest mirror turns stay saved in this browser and do not sync.

## Rack Run controls

- Sink the three colored balls, then call a pocket and sink the eight. An eight-ball pocket that is early, uncalled, or scratched ends the rack.
- Call a pocket with **1–6** or tap its button. Pull back from the cue ball and release to set aim and power. You can also adjust aim with **Left / Right** or **A / D**, change power with **Up / Down** or **W / S**, then shoot with **Space** or **Enter**.
- **Escape** pauses or resumes. **R** or **Restart** resets the rack. A cue scratch returns the cue ball to the kitchen and counts as a foul.
- Your fewest shots for a clean rack stay saved in this browser and do not sync.

## Pin Parade controls

- Bowl all ten frames. A strike clears the rack on one ball; a spare clears it across two. Strike and spare bonuses are scored using the standard rules, including the tenth-frame bonus balls.
- Pull back from the ball and release to set line and power. You can also aim with **Left / Right** or **A / D**, set power with **Up / Down** or **W / S**, adjust spin with **Q / E**, then bowl with **Space** or **Enter**.
- **Escape** pauses or resumes. **R** or **Restart** resets the game. Use the sliders and buttons for touch controls.
- Your highest ten-frame score stays saved in this browser and does not sync.

## Deckhand controls

- Select a face-up card or run, then select its destination column or suit foundation. Build tableaus downward in alternating colors; empty columns take kings. Draw one card from the stock, then recycle the waste when it runs out. Deals are generated locally with a clear path through all 52 cards.
- Use **Tab**, **Enter**, and **Space** to reach and activate the card controls. Press **Z** to undo, **Escape** to pause, and **R** to restart the same deal.
- Your fastest clear stays in this browser and does not sync.

## Local records and preferences

Arcade saves personal bests, current daily puzzle progress, and preferences in this browser. Arcade sounds are short synthesized beeps made locally in the browser and are off by default. Records and preferences do not sync. Use **Clear records** under Preferences to remove personal bests; daily progress and preferences stay saved. The system reduced-motion setting is always respected.

Under **Local data backup**, choose **Download backup** to save records, daily progress, and preferences as a JSON file on your device. To restore or move that data to another browser, choose **Choose backup file**, select the file, and confirm the restore. Restoring replaces the Arcade data saved in the current browser. Arcade never uploads the backup or its contents.

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
