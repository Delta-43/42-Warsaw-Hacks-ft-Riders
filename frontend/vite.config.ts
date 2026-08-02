import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_TARGET || 'http://127.0.0.1:8000'
  // In production (GitHub Pages) assets live under the repo name subpath.
  // VITE_BASE_PATH is set to '/42-Warsaw-Hacks-ft-Riders/' in the workflow.
  // In dev it stays '/' so the local server works normally.
  const base = env.VITE_BASE_PATH || '/'

  return {
    base,
    plugins: [react()],
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
