import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The key is only added by the local dev proxy. Never give it a VITE_ prefix:
// those values are written into the published JavaScript.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: '/finsight/',
  server: {
    proxy: {
      '/api': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        headers: {
          'x-api-key': loadEnv(mode, process.cwd(), 'ANTHROPIC_').ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        }
      }
    }
  }
}))
