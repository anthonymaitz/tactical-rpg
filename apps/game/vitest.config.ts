import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  resolve: {
    conditions: ['browser', 'development'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    passWithNoTests: true,
    deps: {
      inline: [/solid/, /@solidjs/],
    },
  },
})
