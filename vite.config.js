import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/SYNRG-app1/',
  // Change to '/synrg-app/' if deploying to old repo
})
