import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves 404.html for unknown paths under the base. Shipping a
// copy of index.html as 404.html means a deep link or reload still boots the
// app instead of showing a Pages 404.
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    closeBundle() {
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_TARGET || 'http://127.0.0.1:8000'
  // GitHub Pages serves the app under /<repo>/. Set VITE_BASE_PATH to
  // '/42-Warsaw-Hacks-ft-Riders/' for that build; it stays '/' otherwise.
  const base = env.VITE_BASE_PATH || '/'

  return {
    base,
    plugins: [react(), spaFallback()],
    server: {
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/health': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
