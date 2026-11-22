import {defineConfig} from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({envDir:false,plugins:[tsconfigPaths()],test:{environment:'node',include:['tests/unit/dashboard-snapshot.spec.ts','tests/unit/publish-locale.spec.ts','tests/unit/bulk-unpublish-error.spec.ts','tests/unit/preview-navigation.spec.ts'],maxWorkers:1,fileParallelism:false}})
