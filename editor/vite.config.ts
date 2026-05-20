import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // Fondamentale per Tauri
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main:            resolve(__dirname, 'index.html'),
        codemirrorFrame: resolve(__dirname, 'codemirror-frame.html'),
      },
      external: [/\/runtime\/game\.js$/],
    },
  },
})
