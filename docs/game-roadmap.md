# Arcade game roadmap

Arcade games use original names, presentation, rules, and puzzle content. Daily boards are generated in the app or bundled with the app so play stays local and works offline.

The home floor includes a browser-local shelf for up to eight favourites. The shortlist can launch games directly, is included in backups, and does not sync.

## Emulator-first roadmap

1. **Local Wii and GameCube cabinet.** Provide an experimental browser cabinet for local disc images, standard gamepad input, and a clear compatibility and licensing notice. Wii Remote support and broad Wii compatibility remain open work.
2. **Curated web games.** Add a clearly separate area for web games that are open source, public domain, or explicitly permitted to embed. Investigate Club Penguin Rewritten under its current terms; omit it if it is unavailable or does not permit embedding. Respect iframe restrictions and never proxy a site to get around them.
3. **A useful local library.** Improve browsing and returning to games with clear categories, favourites, recently played, and history only where the game provides real results. Keep ROM bytes, records, and preferences local; add no accounts, public leaderboards, or multiplayer without an agreed data design.

Keep existing Arcade games playable throughout these milestones. Avoid paid APIs, analytics, and external game services.

## Shipped catalogue

| Game | Main mechanic |
| --- | --- |
| Snake | Grid navigation and growing-tail avoidance |
| Reaction | Single-signal timing |
| Pattern Memory | Repeat an expanding sequence |
| Breakout | Paddle and ball physics |
| Pong | Paddle rally against the computer |
| Space Invaders | Hold-to-move shooting and wave defense |
| Asteroids | Momentum, rotation, and shooting |
| Missile Command | Aim and intercept incoming threats |
| Block Drop | Falling-piece placement |
| Word Guess | Limited-turn hidden-word deduction |
| Connections | Group words by shared idea |
| Spelling Bee | Build words around a required letter |
| Strands | Trace hidden words through a letter field |
| Sudoku | Constraint-based number placement |
| Mini Crossword | Compact across-and-down clues |
| Daily Crossword | Larger across-and-down clue grid |
| Letter Boxed | Chain words across letter groups |
| Domino Logic | Place numbered tiles to meet row and column sums |
| Glyph Match | Find matching hidden pairs |
| Vertex | Build a loop from point clues |
| Tiles | Clear matching pairs from a layered layout |
| Pips | Place dominoes to satisfy pip clues |
| Minesweeper | Deduce safe squares from neighboring mine counts |
| Maze Dash | Collect gems and evade pursuing sentries |
| Skyline Skip | Carry momentum over rooftop gaps, spikes, and checkpoints |
| Cipher Circuit | Deduce a daily signal code from exact and misplaced feedback |
| Orbit Courier | Pilot a drifting ship through debris and deliver cargo to three stations |
| Color Conduit | Route four colored signals through a full board without crossing |
| Switchyard | Time track switches to deliver freight cars to matching depots |
| Prism Dash | Change lanes to catch light shards and dodge gates in a daily reflex run |
| Gravity Loom | Tilt a chamber to roll a spark through paired portals into daily receivers |
| Tideglass | Route three colored buoys through switchable sluices to matching daily berths |
| Skyhook | Carry a capsule's momentum between tether anchors, collect beacons, and dock |
| Pocket Pinball | Hold live flippers, bank shots off bumpers, light upper targets, and save a high score |
| Neon Rally | Hold a car on the racing line, follow twelve checkpoint gates, and set a three-lap time |
| Moonshot Mini Golf | Aim and bank putts around five original lunar greens, using walls and slow craters to sink the ball in fewer strokes |
| Beat Beacon | Match four original eight-beat drum patterns across four pads, with timing grades and a locally saved best score |
| Tuning Fork | Identify eight original rising and falling pitch intervals by ear or visual contour, and save a local accuracy score |
| Magnetron | Reverse field-post polarity to steer a puck through three obstacle courses and save a local best time |
| Keystone | Push blocks onto sockets to power locks and open four original chambers, with a local fewest-moves record |
| Beamworks | Rotate mirrors to route a beam into four receivers, with a local fewest-turns record |
| Rack Run | Aim, call a pocket, and clear three colors before the eight ball, with a local fewest-shots record |
| Pin Parade | Bowl ten original frames with strike and spare bonuses, using lane, power, and spin controls; save a local high score |
| Deckhand | Play a guaranteed-clear seven-column Klondike deal, build four suit foundations, undo moves, and save the fastest clear |
| Latchkey | Cross three original platform rooms with single-step controls, pulsed jumps, a key, and an exit; save the fastest route |
| Fathom | Find four locally generated ships by plotting hits and using a limited supply of three-by-three sonar sweeps; save the fewest shots |
| Fourfold | Connect four in a row against a local minimax opponent, keep a winning streak going, and save the best streak |
| Pegline | Clear three fixed pegboards by hopping pegs into empty sockets, finish with one peg on each target, and save the fewest-move route |
| Tally Market | Place one-use number tags into three daily baskets without overshooting, reach every exact target, and save the fewest-action clear |
| Keytrace | Type a deterministic daily twelve-word strip, pause or restart the timed run, and save the fastest clear with at least 95% accuracy |
| Pixel Mosaic | Solve an original daily 8×8 picture-logic grid using row and column run clues, pause or restart, and save the fastest clear |
| Minute Hand | Set an analog clock to match five original daily time clues, adjust by keyboard or touch, pause or restart, and save the fewest-adjustment clear |
| Pocket Orbit | Tune a launch, curve a satellite around two gravity wells, collect three beacons, and dock in a deterministic daily physics flight |

## Next candidates

These ideas are ordered to add mechanics Arcade does not already have. Recheck the shipped catalogue before starting each game.

1. **Word Ladder** — transform one original daily word into another by changing one letter at a time, keeping every step a valid bundled word.
2. **Signal Sweep** — tune a local radio dial through interference to isolate a daily sequence of short-wave tones, adding an audio and spatial listening mechanic.

Ideas can change as the catalogue grows. Keep each game self-contained, accessible, responsive, and playable offline; save personal bests in this browser.
