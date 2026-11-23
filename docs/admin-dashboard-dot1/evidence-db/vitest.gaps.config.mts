import {defineConfig} from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({envDir:false,plugins:[tsconfigPaths()],test:{environment:'node',include:['docs/admin-dashboard-dot1/evidence-db/gaps.int.spec.ts'],maxWorkers:1,fileParallelism:false,bail:1,testTimeout:60000,hookTimeout:120000}})
