import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // The canvas library is loaded lazily; pre-bundle it so the first visit does not trigger a reload.
  optimizeDeps: { include: ['@xyflow/react'] },
  // The two large libraries every screen needs get their own files, so they are cached across releases.
  build: { rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'], stats: ['jstat'] } } } },
  test: {
    include: ['tests/**/*.test.{ts,js}'],
    environment: 'node',
  },
})
