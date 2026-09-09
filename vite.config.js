import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/app/',
  build: {
    rollupOptions: {
      output: {
        // Split the libraries out of the app chunk. They change only when a
        // dependency is upgraded, so a normal deploy leaves them untouched in
        // the browser cache and returning users re-download app code alone.
        // Keep react and MUI together: MUI's runtime reaches into React on
        // module evaluation, and separating them lets Rollup order the chunks
        // so MUI can execute first, which throws at load.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|@mui|@emotion)[\\/]/.test(id)) return 'vendor'
        },
      },
    },
  },
})
