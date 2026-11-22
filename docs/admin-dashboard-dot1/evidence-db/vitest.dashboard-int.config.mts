import {defineConfig} from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({envDir:false,plugins:[tsconfigPaths()],test:{environment:'node',include:['tests/int/dashboard-snapshot.int.spec.ts'],maxWorkers:1,fileParallelism:false,bail:1,testTimeout:90000,hookTimeout:120000}})
