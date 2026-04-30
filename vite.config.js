import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      // Forward all /api calls to Spring Boot
      // So you write fetch('/api/holdings') not fetch('http://localhost:8080/api/holdings')
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})