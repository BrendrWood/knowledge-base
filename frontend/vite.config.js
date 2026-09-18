import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/base/',
  plugins: [react()],
  server: {
    proxy: {
      '/base/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/base\/api/, '/api'),
      },
    },
  },
})