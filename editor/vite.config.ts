import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  base: './',
  plugins: [react()],
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: 'dist',
    target:
      process.env.TAURI_ENV_PLATFORM === 'windows'
        ? 'chrome105'
        : 'safari13',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Single CSS bundle via main.tsx import — no <link rel="stylesheet"> in index.html.
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        codemirrorFrame: resolve(__dirname, 'codemirror-frame.html'),
      },
      external: [/\/runtime\/game\.js$/],
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (
            id.includes('@codemirror') ||
            id.includes('@lezer') ||
            id.includes('@uiw/react-codemirror')
          ) return 'vendor-codemirror'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('@tauri-apps')) return 'vendor-tauri'
          return undefined
        },
      },
    },
  },
})
