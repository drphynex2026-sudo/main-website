import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({
  envDir: false,
  plugins: [tsconfigPaths()],
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/unit/dashboard-*.spec.ts', 'tests/unit/next-config-og.spec.ts'],
    maxWorkers: 1,
    fileParallelism: false,
  },
})
