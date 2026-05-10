import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      // Prevent the WebView from caching WASM/JS builds during development
      'Cache-Control': 'no-store',
    },
  },

  // Vite strips unknown assets by default — tell it to pass .wasm through.
  assetsInclude: ['**/*.wasm'],

  build: {
    outDir:    'dist',
    sourcemap: true,
    // Don't try to bundle game.js — it's an Emscripten output loaded at runtime.
    rollupOptions: {
      external: [/\/runtime\/game\.js$/],
    },
  },
})
