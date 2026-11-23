// Pure checks. Explicit environment allowlist; never loads .env or connects a DB.
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
const root = process.cwd(),
  mode = process.argv[2],
  output = process.env.DASHBOARD_PERF_EVIDENCE
if (!output) throw Error('DASHBOARD_PERF_EVIDENCE is required')
const env = {}
for (const key of [
  'PATH',
  'Path',
  'SystemRoot',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'PATHEXT',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'LOCALAPPDATA',
  'APPDATA',
])
  if (process.env[key]) env[key] = process.env[key]
env.NODE_OPTIONS = '--max-old-space-size=2048'
env.NEXT_TELEMETRY_DISABLED = '1'
const commands = {
  unit: [
    'node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'tests/dashboard-unit.config.mts',
    '--maxWorkers',
    '1',
  ],
  typecheck: ['node_modules/typescript/bin/tsc', '--noEmit'],
  lint: [
    'node_modules/eslint/bin/eslint.js',
    'src/lib/dashboard-read.ts',
    'next.config.ts',
    'tests/helpers/dashboard-profile.ts',
    'tests/int/dashboard-performance.int.spec.ts',
    'tests/int/dashboard-snapshot.int.spec.ts',
    'tests/unit/dashboard-batch.spec.ts',
    'tests/unit/dashboard-concurrency.spec.ts',
    'tests/unit/dashboard-profile.spec.ts',
    'tests/unit/next-config-og.spec.ts',
    'scripts/run-dashboard-checks.mjs',
    'scripts/run-dashboard-performance.mjs',
    'tests/dashboard-unit.config.mts',
    'tests/dashboard-performance.config.mts',
  ],
}
const temporary = []
if (mode === 'baseline-unit') {
  const baseline = 'tests/helpers/__dashboard-baseline.ts',
    suite = 'tests/unit/dashboard-baseline-red.spec.ts'
  for (const file of [baseline, suite])
    if (existsSync(file)) throw Error('Refuse overwrite of temporary baseline file')
  const source = execFileSync(
    'git',
    ['show', 'beb7918aba36a5b4e11568de55be88bfff3aa961:src/lib/dashboard-read.ts'],
    { encoding: 'utf8', windowsHide: true },
  )
  writeFileSync(
    baseline,
    source.replace("from './dashboard-snapshot'", "from '@/lib/dashboard-snapshot'"),
  )
  temporary.push(baseline)
  writeFileSync(
    suite,
    readFileSync('tests/unit/dashboard-batch.spec.ts', 'utf8').replace(
      "from '@/lib/dashboard-read'",
      "from '../helpers/__dashboard-baseline'",
    ),
  )
  temporary.push(suite)
  commands[mode] = [
    'node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'tests/dashboard-unit.config.mts',
    suite,
    '--maxWorkers',
    '1',
    '-t',
    'reads only the current 20 IDs',
  ]
}
if (!commands[mode]) throw Error('Unsupported check')
mkdirSync(output, { recursive: true })
const child = spawn(process.execPath, commands[mode], {
  cwd: root,
  env,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
for (const stream of [child.stdout, child.stderr])
  stream.on('data', (b) => {
    log += b.toString()
    process.stdout.write(b)
  })
const timer = setTimeout(() => child.kill(), 180000)
const result = await new Promise((resolve, reject) => {
  child.once('error', reject)
  child.once('exit', (code, signal) => resolve({ code, signal }))
})
clearTimeout(timer)
writeFileSync(path.join(output, mode + '.log'), log)
writeFileSync(path.join(output, mode + '.result.json'), JSON.stringify(result))
process.exitCode = result.code === 0 ? 0 : 1
for (const file of temporary) unlinkSync(file)
