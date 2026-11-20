import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({
  envDir: false,
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: [
      'tests/workflow/admin-workflow-copy.spec.ts',
      'tests/unit/publish-locale-unpublish.spec.ts',
      'tests/unit/bulk-unpublish-error.spec.ts',
    ],
    fileParallelism: false,
    maxWorkers: 1,
    bail: 1,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
})
