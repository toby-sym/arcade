# Arcade

A small browser arcade for a quick break. Snake, Reaction, Pattern Memory, Breakout, and Pong are playable.

## Local development

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Vite prints the local URL after startup. Choose any of the five games from the game floor.

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
- Move the paddle with the **left and right arrow keys** or **A and D** while the playfield is focused.
- On touch screens, drag across the field to steer the paddle.
- **Pause** in the game panel or press **Escape** while the playfield is focused. The game also pauses when the browser tab is hidden.
- Clear all bricks to finish the run. **Restart** begins with three lives and a fresh wall.

## Pong controls

- Select **Start match** or press **Space** to serve. After either player scores, press **Serve** or **Space** to continue.
- Move your paddle with the **up and down arrow keys** or **W and S** while the playfield is focused.
- On touch screens, drag up or down across the field to move the paddle.
- Choose **Calm**, **Steady**, or **Quick** computer pace before the match. The choice is saved in this browser and can be changed for the next match.
- **Pause** in the game panel or press **Escape** while the playfield is focused. The match also pauses when the browser tab is hidden.
- Reach five points before the computer to win. Your highest points in a match are saved as a local personal best.

## Local records and preferences

Arcade saves Snake's highest score, Breakout's highest score, Pong's highest points in a match, the fastest Reaction time, the most Pattern Memory practice rounds completed, and the latest daily Pattern Memory completion date in browser storage. The **Reduce motion** and Pong opponent pace preferences are saved there too. These records and preferences stay on this browser and do not sync or leave the app. Use **Clear records** under Preferences to remove all personal bests from this browser; daily completion and preferences stay saved. The system reduced-motion setting is always respected.

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
