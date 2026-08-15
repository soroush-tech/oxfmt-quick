import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.mts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
})
