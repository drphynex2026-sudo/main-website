import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({
  envDir: false,
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/int/dashboard-performance.int.spec.ts'],
    maxWorkers: 1,
    fileParallelism: false,
    bail: 1,
    testTimeout: 180000,
    hookTimeout: 120000,
  },
})
