import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({
  envDir: false,
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'tests/int/draft-save-hook.int.spec.ts',
      'tests/int/publish-intent.int.spec.ts',
      'tests/int/review-p1.int.spec.ts',
    ],
    fileParallelism: false,
    maxWorkers: 1,
    bail: 1,
    testTimeout: 60000,
    hookTimeout: 120000,
  },
})
