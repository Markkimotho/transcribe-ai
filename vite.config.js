import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API port is configurable so dev works even when 3001 is taken (API_PORT env).
const API = `http://localhost:${process.env.API_PORT || process.env.PORT || 3001}`

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/ws': { target: API, ws: true, changeOrigin: true },
    }
  }
})
