const cacheVersion = new URL(self.location.href).searchParams.get('version') || 'v2'
const APP_CACHE = `arcade-shell-${cacheVersion}`
const NDS_CACHE = `arcade-nds-${cacheVersion}`
const MAX_CACHED_GAME_ASSETS = 40
const STATIC_FILES = [
  '/manifest.webmanifest',
  '/arcade-icon.svg',
  '/arcade-icon-192.png',
  '/arcade-icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch('/index.html', { cache: 'reload' })
    if (!response.ok) throw new Error('Arcade app shell could not be cached.')

    const html = await response.clone().text()
    const builtAssets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
      .map((match) => match[1])
    const manifestResponse = await fetch('/.vite/manifest.json', { cache: 'reload' })
    if (!manifestResponse.ok) throw new Error('Arcade asset manifest could not be cached.')

    const manifest = await manifestResponse.json()
    const splitAssets = Object.values(manifest).flatMap((entry) => [
      entry.file,
      ...(entry.css || []),
      ...(entry.assets || []),
    ])
    const assetUrls = [...new Set([...builtAssets, ...splitAssets]
      .filter((asset) => typeof asset === 'string')
      .map((asset) => asset.startsWith('/') ? asset : `/${asset}`))]
    const cache = await caches.open(APP_CACHE)
    await cache.put('/index.html', response)
    await cache.addAll([...STATIC_FILES, ...assetUrls])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((name) => (name.startsWith('arcade-shell-') && name !== APP_CACHE)
        || (name.startsWith('arcade-nds-') && name !== NDS_CACHE))
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/nds/')) {
    event.respondWith((async () => {
      const cache = await caches.open(NDS_CACHE)
      if (request.mode === 'navigate') {
        try {
          const response = await fetch(request, { cache: 'no-cache' })
          if (response.ok) await cache.put(request, response.clone())
          return response
        } catch {
          return await cache.match(request) || await cache.match('/nds/index.html') || new Response(
            'Open the Nintendo DS cabinet once while online before using it offline.',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
          )
        }
      }

      const cached = await cache.match(request, { ignoreVary: true })
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch {
        return new Response('This Nintendo DS asset has not been cached on this device yet.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    })())
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE)
      try {
        const response = await fetch(request, { cache: 'no-cache' })
        if (response.ok) await cache.put('/index.html', response.clone())
        return response
      } catch {
        return await cache.match('/index.html') || new Response(
          'Arcade needs one online visit before it can be played offline.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
        )
      }
    })())
    return
  }

  if (!url.pathname.startsWith('/assets/') && !STATIC_FILES.includes(url.pathname)) return

  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE)
    const cached = await cache.match(request, { ignoreVary: true })
    if (cached) return cached

    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
      await pruneOldGameAssets(cache)
    }
    return response
  })())
})

async function pruneOldGameAssets(cache) {
  const assets = (await cache.keys()).filter((request) => new URL(request.url).pathname.startsWith('/assets/'))
  const oldAssets = assets.slice(0, Math.max(0, assets.length - MAX_CACHED_GAME_ASSETS))
  await Promise.all(oldAssets.map((request) => cache.delete(request)))
}
