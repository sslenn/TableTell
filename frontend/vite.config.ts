import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/docs': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/openapi.json': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/redoc': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('plotly.js-dist-min')) {
            return 'vendor-plotly';
          }
          if (id.includes('node_modules')) {
            // Match whole package directories. A bare includes('react') also captures
            // lucide-react, react-markdown and Clerk, which defeats the split below.
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
              return 'vendor-react';
            }
            if (/node_modules\/(react-markdown|remark-[^/]+|rehype-[^/]+|micromark[^/]*|mdast-[^/]+|hast-[^/]+|unified|unist-[^/]+|vfile[^/]*)\//.test(id)) {
              return 'vendor-markdown';
            }
            if (/node_modules\/(lucide-react|zustand|@tanstack)\//.test(id)) {
              return 'vendor-ui';
            }
          }
        }
      }
    }
  }
})
