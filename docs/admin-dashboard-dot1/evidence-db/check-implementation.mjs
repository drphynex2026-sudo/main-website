import {spawnSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
const env={};for(const k of ['PATH','Path','SystemRoot','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'])if(process.env[k])env[k]=process.env[k]
env.NODE_OPTIONS='--max-old-space-size=2048';env.NEXT_TELEMETRY_DISABLED='1'
const steps=[['typecheck','node_modules/typescript/bin/tsc',['--noEmit']],['lint','node_modules/eslint/bin/eslint.js',['src/lib/dashboard-read.ts','src/lib/dashboard-snapshot.ts','src/components/admin/Dashboard.tsx','tests/unit/dashboard-snapshot.spec.ts']],['unit','node_modules/vitest/vitest.mjs',['run','--config','docs/admin-dashboard-dot1/evidence-db/vitest.dashboard-unit.config.mts']]]
for(const [name,bin,args] of steps){const r=spawnSync(process.execPath,[bin,...args],{env,windowsHide:true,timeout:180000,encoding:'utf8'});const log=(r.stdout||'')+(r.stderr||'');writeFileSync(`docs/admin-dashboard-dot1/evidence-db/${name}-implementation.log`,log);console.log(name+' exit='+r.status+'\n'+log);if(r.status!==0){process.exitCode=1;break}}
