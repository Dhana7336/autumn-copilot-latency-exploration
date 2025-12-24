import { defineConfig } from 'vite'

// Minimal config: proxy /api to backend. Avoid loading ESM-only plugin in this environment.
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
