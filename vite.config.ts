import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function isolatedEmulatorHeaders() {
  const applyHeaders = (server: { middlewares: { use: (middleware: (request: { url?: string }, response: { setHeader: (name: string, value: string) => void }, next: () => void) => void) => void } }) => {
    server.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
      if (pathname === '/nds' || pathname.startsWith('/nds/') || pathname === '/wii' || pathname.startsWith('/wii/')) {
        response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
      }
      next()
    })
  }

  return {
    name: 'isolated-emulator-routes',
    configureServer: applyHeaders,
    configurePreviewServer: applyHeaders,
  }
}

export default defineConfig({
  plugins: [react(), isolatedEmulatorHeaders()],
  build: { manifest: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    testTimeout: 10_000,
  },
})
