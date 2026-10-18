import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the backend runs separately on port 3000.
const backend = 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': backend,
    },
  },
})
