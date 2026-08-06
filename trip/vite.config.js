import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tripPreviewBasePath } from '../shared/tripsync-preview-contract.js'

export default defineConfig({
  plugins: [react()],
  // 部署到 GitHub Pages 时改成 '/<仓库名>/'
  base: `${tripPreviewBasePath}/`,
  server: { port: 5173, open: false },
})
