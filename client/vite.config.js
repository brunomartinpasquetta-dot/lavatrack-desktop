import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración de Vite: dev server en 5173 con proxy /api al backend Express.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3051',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
