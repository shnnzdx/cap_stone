import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 部署到 GitHub Pages 时改成 '/<仓库名>/'
  base: '/trip-app/',
  server: { port: 5173, open: false },
})
