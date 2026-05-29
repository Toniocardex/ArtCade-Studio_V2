import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['**/*.dom.test.{ts,tsx}', 'happy-dom'],
    ],
  },
})
