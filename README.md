# Arcade

A small browser arcade for a quick break. The first cabinet is Snake; reaction time and pattern memory are planned next.

## Local development

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Vite prints the local URL after startup. Press **Play Snake** to open the game.

## Snake controls

- **Arrow keys** or **WASD** to steer.
- **Direction pad** for touch screens.
- **Pause** in the game panel or press **Escape** while the playfield is focused.
- **Restart** to begin a new run.

Collect dots without hitting the walls or your tail. The game pauses when the browser tab is hidden. Motion effects honor the system reduced-motion preference.

## Checks

```sh
npm run check
```

This runs TypeScript checks, Snake rule and interface tests, release-promotion integration checks, a dependency audit, and a production build.

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
