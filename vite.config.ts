import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('/livekit-client/')) return 'vendor-livekit-client'
          if (id.includes('/@livekit/components-react/') || id.includes('/@livekit/components-core/') || id.includes('/@livekit/components-styles/')) {
            return 'vendor-livekit-ui'
          }
          if (id.includes('/@livekit/')) return 'vendor-livekit'
          if (id.includes('/@insforge/')) return 'vendor-insforge'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react'
          if (id.includes('/react-router/') || id.includes('/react-router-dom/')) return 'vendor-router'
          if (id.includes('/lucide-react/')) return 'vendor-icons'
          if (id.includes('/react-markdown/') || id.includes('/remark-gfm/')) return 'vendor-markdown'

          return 'vendor-misc'
        },
      },
    },
  },
})
