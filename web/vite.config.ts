import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project site is served under /l1wyuan-site/
  base: '/l1wyuan-site/',
  plugins: [react()],
  server: {
    proxy: {
      // 开发环境把 API 请求转给 admin Next.js（5173/3000 同源化，cookie 直接生效）
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
