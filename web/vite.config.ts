import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project site is served under /l1wyuan-site/
  base: '/l1wyuan-site/',
  plugins: [react()],
})
