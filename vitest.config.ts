import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // cli.mts is a reporting shell over src/; the logic under it is what gets covered.
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts'],
      thresholds: { 100: true },
    },
  },
})
