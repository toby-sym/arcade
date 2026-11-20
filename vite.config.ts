import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function isolatedNintendoDsHeaders() {
  const applyHeaders = (server: { middlewares: { use: (middleware: (request: { url?: string }, response: { setHeader: (name: string, value: string) => void }, next: () => void) => void) => void } }) => {
    server.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
      if (pathname === '/nds' || pathname.startsWith('/nds/')) {
        response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
      }
      next()
    })
  }

  return {
    name: 'isolated-nintendo-ds-route',
    configureServer: applyHeaders,
    configurePreviewServer: applyHeaders,
  }
}

export default defineConfig({
  plugins: [react(), isolatedNintendoDsHeaders()],
  build: { manifest: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
