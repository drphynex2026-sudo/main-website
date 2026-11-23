import { execFileSync, spawn } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { tmpdir } from 'node:os'
import nodeNet from 'node:net'
import { performance } from 'node:perf_hooks'
const root = process.cwd(),
  evidence = process.env.DASHBOARD_PERF_EVIDENCE,
  host = 'npipe:////./pipe/dockerDesktopLinuxEngine'
if (!evidence || !path.isAbsolute(evidence)) throw Error('Absolute evidence directory required')
mkdirSync(evidence) // Exclusive run directory. No automatic reuse/retry.
const env = {}
for (const k of [
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
  if (process.env[k]) env[k] = process.env[k]
const dockerConfig = path.join(evidence, 'docker-empty')
mkdirSync(dockerConfig, { recursive: true })
writeFileSync(path.join(dockerConfig, 'config.json'), '{}')
env.DOCKER_CONFIG = dockerConfig
const runId = randomUUID(),
  short = runId.slice(0, 8),
  name = 'dx-dashboard-perf-' + short,
  network = 'dx-dashboard-perf-net-' + short,
  label = 'drphynex.dashboard-gap-run=' + runId
const password = randomBytes(32).toString('hex'),
  db = 'drphynex_independent_review_test',
  marker = 'drphynex-independent-review-disposable-v1'
let cid, nid, pg, testChild, authDir
const ledger = {
  runId,
  name,
  endpoint: host,
  image: 'postgres:17.6-alpine',
  created: [],
  checks: [],
  cleanup: [],
}
const save = () =>
  writeFileSync(path.join(evidence, 'resource-ledger.json'), JSON.stringify(ledger, null, 2))
function docker(args, extra = {}) {
  return execFileSync('docker', ['--host', host, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
    env,
    ...extra,
  }).trim()
}
const require = createRequire(path.join(root, 'package.json'))
const { Client } = require('pg')
let exitCode = 1
try {
  if (existsSync(path.join(evidence, 'RUN-COMPLETE.json')))
    throw Error('No automatic rerun allowed')
  nid = docker(['network', 'create', '--label', label, network])
  ledger.created.push({ kind: 'network', id: nid })
  save()
  cid = docker(
    [
      'run',
      '--detach',
      '--pull',
      'never',
      '--name',
      name,
      '--label',
      label,
      '--network',
      nid,
      '--memory',
      '768m',
      '--cpus',
      '1',
      '--pids-limit',
      '128',
      '--tmpfs',
      '/var/lib/postgresql/data:rw,size=512m',
      '--publish',
      '127.0.0.1::5432',
      '--env',
      'POSTGRES_PASSWORD',
      '--env',
      'POSTGRES_DB=' + db,
      'postgres:17.6-alpine',
    ],
    { env: { ...env, POSTGRES_PASSWORD: password } },
  )
  ledger.created.push({ kind: 'container', id: cid })
  save()
  const inspect = JSON.parse(docker(['inspect', cid]))[0],
    net = JSON.parse(docker(['network', 'inspect', nid]))[0]
  const ports = inspect.HostConfig.PortBindings,
    mounts = inspect.Mounts,
    attachments = Object.values(inspect.NetworkSettings.Networks)
  if (
    inspect.Id !== cid ||
    inspect.Config.Labels['drphynex.dashboard-gap-run'] !== runId ||
    net.Internal !== false ||
    Object.keys(net.Containers).length !== 1 ||
    !net.Containers[cid] ||
    attachments.length !== 1 ||
    attachments[0].NetworkID !== nid
  )
    throw Error('Container/network identity mismatch')
  if (
    Object.keys(ports).length !== 1 ||
    !ports['5432/tcp']?.length ||
    Object.values(ports)
      .flat()
      .some((x) => x.HostIp !== '127.0.0.1') ||
    mounts.length !== 0 ||
    inspect.HostConfig.Tmpfs?.['/var/lib/postgresql/data'] !== 'rw,size=512m'
  )
    throw Error('Forbidden binding/mount')
  const bound = inspect.NetworkSettings.Ports['5432/tcp']
  ledger.actualPortDiagnostic = {
    configured: ports,
    actual: inspect.NetworkSettings.Ports,
    state: inspect.State.Status,
  }
  save()
  if (bound.length !== 1 || bound[0].HostIp !== '127.0.0.1') throw Error('Actual port mismatch')
  ledger.checks.push({
    identity: true,
    networkInternal: false,
    exclusiveNetwork: true,
    port: bound[0].HostPort,
    mounts: mounts.map((x) => ({ type: x.Type, destination: x.Destination })),
    noExternalVolumes: true,
  })
  save()
  const connectionString = `postgresql://postgres:${password}@127.0.0.1:${bound[0].HostPort}/${db}`
  const deadline = Date.now() + 45000
  while (true) {
    const client = new Client({ connectionString, connectionTimeoutMillis: 1000 })
    try {
      await client.connect()
      pg = client
      break
    } catch {
      await client.end().catch(() => {})
      if (Date.now() > deadline) throw Error('DB ready deadline')
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  const identity = (
    await pg.query(
      'select current_database() as name,current_user as role,host(inet_server_addr()) as address,system_identifier::text from pg_control_system()',
    )
  ).rows[0]
  ledger.connectedIdentityObserved = identity
  ledger.expectedServerAddress = attachments[0].IPAddress
  save()
  if (
    identity.name !== db ||
    identity.role !== 'postgres' ||
    identity.address !== attachments[0].IPAddress
  )
    throw Error('Connected DB identity mismatch')
  if (
    (
      await pg.query(
        "select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
      )
    ).rows[0].n !== 0
  )
    throw Error('Expected empty brand-new DB')
  await pg.query(`COMMENT ON DATABASE ${db} IS '${marker}'`)
  const confirmed = (
    await pg.query(
      "SELECT current_database() as name,shobj_description(oid,'pg_database') as marker FROM pg_database WHERE datname=current_database()",
    )
  ).rows[0]
  if (confirmed.name !== db || confirmed.marker !== marker) throw Error('Marker mismatch')
  ledger.checks.push({
    ...identity,
    marker: confirmed.marker,
    pgVersion: (await pg.query('show server_version')).rows[0].server_version,
  })
  save()
  await pg.end()
  pg = null
  const baselineFile = path.join(root, 'tests/helpers/__dashboard-baseline.ts')
  if (existsSync(baselineFile)) throw Error('Refuse to overwrite baseline fixture')
  const baseline = execFileSync(
    'git',
    ['show', 'beb7918aba36a5b4e11568de55be88bfff3aa961:src/lib/dashboard-read.ts'],
    { encoding: 'utf8', windowsHide: true },
  )
  writeFileSync(
    baselineFile,
    baseline.replace("from './dashboard-snapshot'", "from '@/lib/dashboard-snapshot'"),
  )
  const fixturePassword = randomBytes(24).toString('hex'),
    secret = randomBytes(32).toString('hex')
  const socket = nodeNet.createServer()
  await new Promise((r) => socket.listen(0, '127.0.0.1', r))
  const port = socket.address().port
  await new Promise((r) => socket.close(r))
  const origin = `http://127.0.0.1:${port}`
  authDir = mkdtempSync(path.join(tmpdir(), 'dx-dashboard-perf-auth-'))
  const authFile = path.join(authDir, 'fixture-token.json')
  const regression = process.env.DASHBOARD_PERF_SUITE === 'regression'
  const childEnv = {
    ...env,
    NODE_ENV: 'test',
    CIRCLE_NODE_TOTAL: '2',
    NODE_OPTIONS: '--max-old-space-size=2048',
    DATABASE_URL: connectionString,
    PAYLOAD_SECRET: secret,
    NEXT_PUBLIC_SERVER_URL: origin,
    NEXT_TELEMETRY_DISABLED: '1',
    DASHBOARD_BENCHMARK_EVIDENCE: path.join(evidence, 'benchmark.json'),
    DASHBOARD_EVIDENCE_DIR: evidence,
    TEST_FIXTURE_PASSWORD: fixturePassword,
    ...(!regression ? { DASHBOARD_TEST_AUTH_FILE: authFile } : {}),
  }
  const clean = (s) =>
    s
      .replaceAll(password, '[REDACTED]')
      .replaceAll(connectionString, '[REDACTED_URL]')
      .replaceAll(fixturePassword, '[REDACTED]')
      .replaceAll(secret, '[REDACTED]')
  try {
    testChild = spawn(
      process.execPath,
      [
        path.join(root, 'node_modules/vitest/vitest.mjs'),
        'run',
        '--config',
        regression
          ? 'docs/admin-dashboard-dot1/evidence-db/vitest.dashboard-int.config.mts'
          : 'tests/dashboard-performance.config.mts',
        '--maxWorkers',
        '1',
        ...(process.env.DASHBOARD_PERF_SUITE === 'http'
          ? ['-t', 'creates authentication for owned Local HTTP smoke']
          : []),
      ],
      { cwd: root, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let log = ''
    for (const s of [testChild.stdout, testChild.stderr])
      s.on('data', (b) => {
        const text = clean(b.toString())
        log += text
        process.stdout.write(text)
      })
    const timer = setTimeout(() => {
      ledger.testTimeout = true
      testChild.kill()
    }, 240000)
    const result = await new Promise((resolve, reject) => {
      testChild.once('error', reject)
      testChild.once('exit', (code, signal) => resolve({ code, signal }))
    })
    clearTimeout(timer)
    writeFileSync(path.join(evidence, 'integration.log'), log)
    ledger.result = result
    save()
    if (result.code !== 0) throw Error('Benchmark failed')
  } finally {
    unlinkSync(baselineFile)
  }
  if (process.env.DASHBOARD_PERF_BUILD === '1' || process.env.DASHBOARD_PERF_SMOKE === '1') {
    if (regression) throw Error('Build smoke requires benchmark auth fixture')
    childEnv.NODE_ENV = 'production'
    delete childEnv.TEST_FIXTURE_PASSWORD
    delete childEnv.DASHBOARD_TEST_AUTH_FILE
    if (process.env.DASHBOARD_PERF_BUILD === '1') {
      testChild = spawn(
        process.execPath,
        [path.join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'],
        { cwd: root, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      let log = ''
      for (const s of [testChild.stdout, testChild.stderr])
        s.on('data', (b) => {
          const text = clean(b.toString())
          log += text
          process.stdout.write(text)
        })
      const timer = setTimeout(() => testChild.kill(), 600000)
      const result = await new Promise((resolve, reject) => {
        testChild.once('error', reject)
        testChild.once('exit', (code, signal) => resolve({ code, signal }))
      })
      clearTimeout(timer)
      writeFileSync(path.join(evidence, 'build.log'), log)
      ledger.build = result
      save()
      if (result.code !== 0) throw Error('Build failed')
    } else {
      // Test-only reuse of a previously built artifact; prove runtime bytes and build identity.
      const attestation = JSON.parse(
        readFileSync(process.env.DASHBOARD_PREBUILT_FINGERPRINT, 'utf8'),
      )
      for (const item of attestation.files) {
        const digest = createHash('sha256')
          .update(readFileSync(path.join(root, item.file)))
          .digest('hex')
        if (digest !== item.sha256) throw Error('Prebuilt runtime bytes changed')
      }
      if (readFileSync(path.join(root, '.next/BUILD_ID'), 'utf8') !== attestation.buildID)
        throw Error('Prebuilt build identity changed')
      ledger.reusedVerifiedBuild = attestation.buildID
    }
    const nftPath = path.join(root, '.next/server/app/(payload)/api/[...slug]/route.js.nft.json'),
      trace = JSON.parse(readFileSync(nftPath, 'utf8'))
    const font = trace.files.find((f) =>
      f.replaceAll('\\', '/').endsWith('/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff'),
    )
    if (!font) throw Error('OG font absent from REST trace')
    ledger.ogFontTraced = true
    save()
    testChild = spawn(
      process.execPath,
      [
        path.join(root, 'node_modules/next/dist/bin/next'),
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      { cwd: root, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let runtime = ''
    for (const s of [testChild.stdout, testChild.stderr])
      s.on('data', (b) => {
        runtime += clean(b.toString())
        writeFileSync(path.join(evidence, 'runtime.log'), runtime)
      })
    const readyBy = Date.now() + 45000
    while (true) {
      if (testChild.exitCode !== null || testChild.signalCode !== null)
        throw Error('Local server exited')
      const ready = await new Promise((resolve) => {
        const connection = nodeNet.connect({ host: '127.0.0.1', port })
        connection.setTimeout(500)
        connection.once('connect', () => {
          connection.destroy()
          resolve(true)
        })
        connection.once('error', () => resolve(false))
        connection.once('timeout', () => {
          connection.destroy()
          resolve(false)
        })
      })
      if (ready) break
      if (Date.now() > readyBy) throw Error('Local readiness deadline')
      await new Promise((r) => setTimeout(r, 300))
    }
    const token = JSON.parse(readFileSync(authFile, 'utf8')).token
    if (typeof token !== 'string' || !token) throw Error('Missing test authentication')
    const http = []
    for (let n = 0; n < 4; n++) {
      const start = performance.now()
      const response = await fetch(origin + '/admin', {
        // Match a browser's direct navigation. Payload intentionally ignores a
        // cookie from a client with neither Origin nor Sec-Fetch-Site (extractJWT).
        headers: { Cookie: 'payload-token=' + token, 'Sec-Fetch-Site': 'none' },
        redirect: 'manual',
        signal: AbortSignal.timeout(60000),
      })
      const html = await response.text()
      const documents = (html.match(/class="dx-dash-document"/g) ?? []).length
      const localeCounts = Object.fromEntries(
        ['ko', 'en', 'vi'].map((locale) => [
          locale,
          (
            html.match(
              new RegExp(
                `<div\\b[^>]*class="dx-dash-locale"[^>]*data-locale="${locale}"[^>]*>`,
                'g',
              ),
            ) ?? []
          ).length,
        ]),
      )
      if (
        response.status !== 200 ||
        !html.includes('Bảng điều khiển') ||
        html.includes('Chưa đọc được bảng việc. Hãy tải lại.') ||
        documents !== 5 ||
        Object.values(localeCounts).some((count) => count !== 5)
      ) {
        writeFileSync(
          path.join(evidence, 'http-failure.json'),
          JSON.stringify(
            {
              status: response.status,
              documents,
              localeCounts,
              hasHeading: html.includes('Bảng điều khiển'),
              fallback: html.includes('Chưa đọc được bảng việc. Hãy tải lại.'),
            },
            null,
            2,
          ),
        )
        throw Error('Local dashboard HTTP failed')
      }
      http.push({
        sample: n + 1,
        kind:
          n === 0
            ? 'first authenticated request in fresh Next process; includes initialization'
            : 'subsequent request',
        ms: performance.now() - start,
        status: response.status,
        documents,
        localeCounts,
      })
    }
    const response = await fetch(origin + '/api/og?title=Dr.PhynEX', {
        signal: AbortSignal.timeout(30000),
      }),
      image = Buffer.from(await response.arrayBuffer())
    if (response.status !== 200 || !response.headers.get('content-type')?.startsWith('image/png'))
      throw Error('OG HTTP failed')
    const sharp = createRequire(import.meta.url)('sharp')
    const metadata = await sharp(image).metadata(),
      stats = await sharp(image).stats()
    if (metadata.width !== 1200 || metadata.height !== 630 || stats.entropy <= 0)
      throw Error('OG render failed')
    writeFileSync(path.join(evidence, 'admin-og.png'), image)
    writeFileSync(
      path.join(evidence, 'http.json'),
      JSON.stringify(
        {
          origin,
          productionBuildLocal: true,
          localPoolMax: 10,
          productionPoolMax: 3,
          coldNote:
            'Local fresh-process request, not Vercel cold start. Benchmark uses pool 3 separately.',
          dashboard: http,
          og: {
            status: response.status,
            type: response.headers.get('content-type'),
            bytes: image.length,
            width: metadata.width,
            height: metadata.height,
            entropy: stats.entropy,
            fontTraced: true,
          },
        },
        null,
        2,
      ),
    )
    testChild.kill()
    await new Promise((resolve) => {
      if (testChild.exitCode !== null || testChild.signalCode !== null) return resolve()
      const timer = setTimeout(() => resolve(), 5000)
      testChild.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
    if (testChild.exitCode === null && testChild.signalCode === null)
      throw Error('Local server stop deadline')
    ledger.cleanup.push({
      localServerPid: testChild.pid,
      exitCode: testChild.exitCode,
      signalCode: testChild.signalCode,
    })
  }
  exitCode = 0
  writeFileSync(
    path.join(evidence, 'RUN-COMPLETE.json'),
    JSON.stringify(
      {
        runId,
        result: ledger.result,
        completedAt: new Date().toISOString(),
        noProductionConnection: true,
      },
      null,
      2,
    ),
  )
} catch (e) {
  ledger.failure = String(e.message).replaceAll(password, '[REDACTED]')
  console.error('STOP ' + ledger.failure)
  save()
} finally {
  if (pg) await pg.end().catch(() => {})
  if (testChild && testChild.exitCode === null && testChild.signalCode === null) {
    testChild.kill()
    ledger.cleanup.push({ childSignal: 'termination-requested' })
  }
  if (cid) {
    const inspect = JSON.parse(docker(['inspect', cid]))[0]
    if (inspect.Id !== cid || inspect.Config.Labels['drphynex.dashboard-gap-run'] !== runId)
      throw Error('Refuse cleanup identity mismatch')
    docker(['rm', '--force', cid])
    ledger.cleanup.push({ container: cid, removed: true })
  }
  if (nid) {
    const n = JSON.parse(docker(['network', 'inspect', nid]))[0]
    if (
      n.Id !== nid ||
      n.Labels['drphynex.dashboard-gap-run'] !== runId ||
      Object.keys(n.Containers).length
    )
      throw Error('Refuse network cleanup')
    docker(['network', 'rm', nid])
    ledger.cleanup.push({ network: nid, removed: true })
  }
  if (authDir) {
    const resolved = path.resolve(authDir)
    if (
      !resolved.startsWith(path.resolve(tmpdir()) + path.sep) ||
      !path.basename(resolved).startsWith('dx-dashboard-perf-auth-')
    )
      throw Error('Refuse auth scratch cleanup')
    rmSync(resolved, { recursive: true })
    ledger.cleanup.push({ fixtureAuthScratchRemoved: true })
  }
  save()
}
process.exitCode = exitCode
