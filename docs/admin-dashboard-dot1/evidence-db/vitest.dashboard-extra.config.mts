import {defineConfig} from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({envDir:false,plugins:[tsconfigPaths()],test:{environment:'node',include:['tests/unit/publish-locale-unpublish.spec.ts','tests/unit/preview-public-locale.spec.ts','tests/unit/approval-view.spec.ts','tests/unit/approval-refresh.spec.ts'],maxWorkers:1,fileParallelism:false}})
