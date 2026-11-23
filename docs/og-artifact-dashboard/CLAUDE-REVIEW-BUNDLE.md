# Claude review ngắn — OG + đo dashboard

Nền: `5ec6a27fbcf4c0369a5ad2bc4c10aa83f810402d`; nhánh `codex/og-artifact-dashboard-diagnostics`.

Owner cho phép PR/merge/deploy **sau** review không còn blocker. Chưa có kết luận Claude cho bản này. Không có quyền ghi nội dung/ACL/migration Production.

## Diff hiện tại

1. OG: pre-loader duy nhất cho `@payloadcms/next/dist/routes/rest/og/index.js`, đổi import fs thành adapter; DefinePlugin nhúng chính bytes font vendor. Không sửa node_modules. Public licenses giữ copyright Google 2011 (đọc từ bảng name của WOFF), Apache2 và Payload MIT; không tải/thay font.
2. Dashboard: nối wrapper tại reader, giữ nguyên options/read order/concurrency/ACL/guest context. Observer pg chỉ lấy đồng hồ/count, không đọc SQL hoặc parameters. AsyncLocalStorage tách nhóm/request; React request cache giữ timing Admin, không cache dữ liệu/người dùng giữa request.
3. Root Admin gọi wrapper bắt đầu timing. Pre-loader riêng khớp chính xác SDK `utilities/initReq.js`, chỉ đổi tên import getPayload và bọc lời gọi gốc bằng đồng hồ, kiểm contract để fail build khi SDK thay đổi. Không đổi quyền hoặc cách khởi tạo. File Admin page do Payload sinh có thay một wrapper; khi regenerate phải giữ/kiểm lại wrapper này.
4. Không endpoint chẩn đoán; không metrics trong HTML/RSC/header. Log JSON cố định gồm nhóm, timing/count, UUID ngẫu nhiên, region/process flags và tình trạng đo. Không SQL/parameters/connection URL/cookie/token/email/ID tài liệu/nội dung/stack.
5. Bật phải đồng thời có `DASHBOARD_DIAGNOSTICS=1` và `DASHBOARD_DIAGNOSTICS_UNTIL_MS` hợp lệ trong tương lai. Mặc định tắt, hết hạn tự tắt trên deployment cũ. Cap 8 records/process, tối đa20; không phải quota toàn deployment. Khi kết thúc đo đặt cấu hình flag=0 cho lần deploy sau, đồng thời xác nhận expiry đã dừng log trên deployment hiện tại; không deploy trùng chỉ để đo.

## Ranh giới timing cần review

- `serverToDashboardDataMs`: entry Admin server component → hết dashboard read/projection. Đây là tổng **đến dữ liệu**, không phải tổng HTTP hay toàn React render/stream. `rootAssemblyMs` là await RootPage, không phải render hoàn tất.
- `payloadGetMs`/calls: await getPayload thật do SDK gọi; có thể là instance đã có. Không gọi là cold initialization. Nếu không có lời gọi trong render này, null thay vì 0.
- `appReadTotalMs`: tổng reader; inventory count/list, Products/Home draft/main/guest là wall spans Local API. Projection là snapshot đồng bộ. Không cộng các spans chồng lấp thành total.
- `driverSumMs`/queryCount và `acquireSumMs`: chỉ từ callback/promise pg thật được observer nhìn thấy. Driver gồm network/PostgreSQL/deserialization; acquire gồm chờ và mở kết nối, không đo riêng CPU DB hay thuần queue. Query dạng không quan sát được đánh dấu `unmeasuredQueries`; `driverObserved=false` khi không gắn được pool. Không suy DB từ wall Local API.
- Tổng HTTP/server invocation hoàn chỉnh sẽ chỉ báo nếu Vercel runtime metadata thật cung cấp; không dùng mốc server-to-data hoặc browser completion để giả tổng này. Nếu không có, ghi chưa đo. Browser TTFB/document duration/load được ghi riêng nếu công cụ cung cấp.

## Kế hoạch Production sau review

- Giữ region/pool/concurrency/cache. Xác minh origin/main, PR SHA/checks; bật đúng ba biến không bí mật với expiry ngắn trước merge để chỉ main auto-deploy một lần. Theo dõi Ready/SHA, không tạo deployment song song.
- `/api/og`: 200 image/png1200×630 và mở ảnh; log không còn lỗi font. Artifact Windows trước đó đạt, có giới hạn harness đã ghi; không coi là Production PASS.
- Cùng phiên Admin/dữ liệu, bốn lượt (đầu quan sát +3 tiếp theo), không ghi nội dung. Xuất riêng log metrics allowlist, snapshot/count/link mẫu và mẫu guest draft/private file. Không gọi lượt đầu cold start.
- Function region từ deployment metadata + event VERCEL_REGION; Neon region từ console metadata khi có phiên hợp lệ. Nếu chưa có, giữ chưa xác minh, không đọc hàng loạt env/secret.
- Kết thúc flag=0 trong cấu hình, expiry bảo đảm code ngừng ghi ngay trên deployment hiện tại; xác minh không còn event mới. Không tối ưu tiếp trước số đo.

## Điều cần Claude kiểm

- Scope loader/font và quyền đọc không thay đổi; giấy phép/nguồn giữ đúng.
- Async/callback observer không thay return/error hoặc trộn thông tin request; guard log/expiry/cap không gây lộ dữ liệu.
- React request timing và SDK init timing có ý nghĩa đúng ranh giới; không diễn giải server-to-data thành full HTTP/render.
- Báo blocker cụ thể có file/dòng. Không gán kết quả build/artifact trước wiring cho nguồn này; kết quả cuối và fingerprint kèm bundle sẽ chốt sau kiểm.


## Diff tracked
```diff
diff --git a/next.config.ts b/next.config.ts
index 086df16..71a1dfc 100644
--- a/next.config.ts
+++ b/next.config.ts
@@ -2,6 +2,7 @@ import { withPayload } from '@payloadcms/next/withPayload'
 import type { NextConfig } from 'next'
 import createNextIntlPlugin from 'next-intl/plugin'
 import path from 'path'
+import { readFileSync } from 'node:fs'
 import { fileURLToPath } from 'url'
 
 const __filename = fileURLToPath(import.meta.url)
@@ -28,13 +29,6 @@ const securityHeaders = [
 const nextConfig: NextConfig = {
   // Also stops @payloadcms/next/withPayload from adding "X-Powered-By: Next.js, Payload".
   poweredByHeader: false,
-  // Payload 3.92.1 reads this package asset at runtime via import.meta.url.
-  // Pin it into the REST catch-all trace; do not replace the OG handler or font.
-  outputFileTracingIncludes: {
-    '/api/\\[\\.\\.\\.slug\\]': [
-      './node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff',
-    ],
-  },
   headers: async () => [{ source: '/:path*', headers: securityHeaders }],
   images: {
     // Media release can be revoked; serve originals through Payload on every request.
@@ -45,13 +39,46 @@ const nextConfig: NextConfig = {
       },
     ],
   },
-  webpack: (webpackConfig) => {
+  webpack: (webpackConfig, { isServer, webpack }) => {
     webpackConfig.resolve.extensionAlias = {
       '.cjs': ['.cts', '.cjs'],
       '.js': ['.ts', '.tsx', '.js', '.jsx'],
       '.mjs': ['.mts', '.mjs'],
     }
 
+    if (isServer) {
+      // Payload 3.92.1's OG module derives its font path from import.meta.url.
+      // Webpack freezes that URL to the build machine. Inline this one public
+      // vendor asset and replace ONLY that module's fs import, not other IO.
+      webpackConfig.module ??= {}
+      webpackConfig.module.rules ??= []
+      webpackConfig.plugins ??= []
+      webpackConfig.plugins.push(
+        new webpack.DefinePlugin({
+          __PAYLOAD_OG_FONT_BASE64__: JSON.stringify(
+            readFileSync(
+              path.join(
+                dirname,
+                'node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff',
+              ),
+            ).toString('base64'),
+          ),
+        }),
+      )
+      // Built-in fs is externalized before NormalModuleReplacementPlugin can
+      // rewrite it. Transform this one SDK source before dependency parsing.
+      webpackConfig.module.rules.push({
+        test: /[\\/]@payloadcms[\\/]next[\\/]dist[\\/]routes[\\/]rest[\\/]og[\\/]index\.js$/,
+        enforce: 'pre',
+        use: [{ loader: path.join(dirname, 'scripts/webpack/payload-og-font.cjs') }],
+      })
+      webpackConfig.module.rules.push({
+        test: /[\\/]@payloadcms[\\/]next[\\/]dist[\\/]utilities[\\/]initReq\.js$/,
+        enforce: 'pre',
+        use: [{ loader: path.join(dirname, 'scripts/webpack/payload-init-timing.cjs') }],
+      })
+    }
+
     return webpackConfig
   },
   turbopack: {
diff --git a/scripts/run-dashboard-checks.mjs b/scripts/run-dashboard-checks.mjs
index 7cb4589..080c943 100644
--- a/scripts/run-dashboard-checks.mjs
+++ b/scripts/run-dashboard-checks.mjs
@@ -38,6 +38,10 @@ const commands = {
     'node_modules/eslint/bin/eslint.js',
     'src/lib/dashboard-read.ts',
     'next.config.ts',
+    'src/lib/payload-og-font.ts',
+    'src/lib/dashboard-diagnostics.ts',
+    'src/lib/admin-server-timing.ts',
+    'src/app/(payload)/admin/[[...segments]]/page.tsx',
     'tests/helpers/dashboard-profile.ts',
     'tests/int/dashboard-performance.int.spec.ts',
     'tests/int/dashboard-snapshot.int.spec.ts',
@@ -45,7 +49,12 @@ const commands = {
     'tests/unit/dashboard-concurrency.spec.ts',
     'tests/unit/dashboard-profile.spec.ts',
     'tests/unit/next-config-og.spec.ts',
+    'tests/unit/payload-og-font.spec.ts',
+    'tests/unit/dashboard-diagnostics.spec.ts',
+    'tests/unit/dashboard-server-timing.spec.ts',
     'scripts/run-dashboard-checks.mjs',
+    'scripts/webpack/payload-og-font.cjs',
+    'scripts/webpack/payload-init-timing.cjs',
     'scripts/run-dashboard-performance.mjs',
     'tests/dashboard-unit.config.mts',
     'tests/dashboard-performance.config.mts',
diff --git a/src/app/(payload)/admin/[[...segments]]/page.tsx b/src/app/(payload)/admin/[[...segments]]/page.tsx
index 0de685c..4fcd0e1 100644
--- a/src/app/(payload)/admin/[[...segments]]/page.tsx
+++ b/src/app/(payload)/admin/[[...segments]]/page.tsx
@@ -5,6 +5,7 @@ import type { Metadata } from 'next'
 import config from '@payload-config'
 import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
 import { importMap } from '../importMap'
+import { traceAdminRoot } from '@/lib/admin-server-timing'
 
 type Args = {
   params: Promise<{
@@ -19,6 +20,6 @@ export const generateMetadata = ({ params, searchParams }: Args): Promise<Metada
   generatePageMetadata({ config, params, searchParams })
 
 const Page = ({ params, searchParams }: Args) =>
-  RootPage({ config, params, searchParams, importMap })
+  traceAdminRoot(() => RootPage({ config, params, searchParams, importMap }))
 
 export default Page
diff --git a/src/lib/dashboard-read.ts b/src/lib/dashboard-read.ts
index 4dd88ff..c70e819 100644
--- a/src/lib/dashboard-read.ts
+++ b/src/lib/dashboard-read.ts
@@ -1,4 +1,5 @@
 import 'server-only'
+import { withDashboardDiagnostics, traceDashboardProjection } from './dashboard-diagnostics'
 import type { Payload } from 'payload'
 import type { User } from '@/payload-types'
 import { isStaffUser, isEditorUser } from '@/access/roles'
@@ -67,7 +68,7 @@ export type DashboardData = {
   homeAllowed: boolean
   observedAt: string
 }
-export async function readDashboard(
+async function readDashboardSources(
   payload: Payload,
   user: User | null,
   permissions: unknown,
@@ -175,12 +176,29 @@ export async function readDashboard(
             .map((l) => source.draft[l])
             .find((r) => r.kind === 'ok' && typeof r.value?.name === 'string')
           const title = name?.kind === 'ok' ? String(name.value?.name) : `Sản phẩm #${id}`
-          return snapshot('products', id, title, source, isEditorUser(user))
+          return traceDashboardProjection(() =>
+            snapshot('products', id, title, source, isEditorUser(user)),
+          )
         })
       }
     }
   }
-  if (homeAllowed)
-    data.home = snapshot('home', 'home-page', 'Trang chủ', await homeSources(), isEditorUser(user))
+  if (homeAllowed) {
+    const sources = await homeSources()
+    data.home = traceDashboardProjection(() =>
+      snapshot('home', 'home-page', 'Trang chủ', sources, isEditorUser(user)),
+    )
+  }
   return data
 }
+
+export async function readDashboard(
+  payload: Payload,
+  user: User | null,
+  permissions: unknown,
+  requestedPage: unknown,
+): Promise<DashboardData> {
+  return withDashboardDiagnostics(payload, (measured) =>
+    readDashboardSources(measured, user, permissions, requestedPage),
+  )
+}
diff --git a/tests/dashboard-unit.config.mts b/tests/dashboard-unit.config.mts
index 854855e..61fa109 100644
--- a/tests/dashboard-unit.config.mts
+++ b/tests/dashboard-unit.config.mts
@@ -6,7 +6,11 @@ export default defineConfig({
   esbuild: { jsx: 'automatic' },
   test: {
     environment: 'node',
-    include: ['tests/unit/dashboard-*.spec.ts', 'tests/unit/next-config-og.spec.ts'],
+    include: [
+      'tests/unit/dashboard-*.spec.ts',
+      'tests/unit/next-config-og.spec.ts',
+      'tests/unit/payload-og-font.spec.ts',
+    ],
     maxWorkers: 1,
     fileParallelism: false,
   },
diff --git a/tests/unit/next-config-og.spec.ts b/tests/unit/next-config-og.spec.ts
index a14a21a..95bf5ec 100644
--- a/tests/unit/next-config-og.spec.ts
+++ b/tests/unit/next-config-og.spec.ts
@@ -1,14 +1,73 @@
 import { describe, expect, it, vi } from 'vitest'
+import { createRequire } from 'node:module'
+import { readFileSync } from 'node:fs'
+const require = createRequire(import.meta.url)
+class Define {
+  constructor(readonly definitions: Record<string, string>) {}
+}
 vi.mock('@payloadcms/next/withPayload', () => ({ withPayload: (config: unknown) => config }))
 vi.mock('next-intl/plugin', () => ({ default: () => (config: unknown) => config }))
 import config from '../../next.config'
-describe('Payload OG runtime asset trace', () => {
-  it('includes the exact vendor font only in the REST catch-all trace', () => {
-    expect(config.outputFileTracingIncludes).toEqual({
-      '/api/\\[\\.\\.\\.slug\\]': [
-        './node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff',
-      ],
-    })
+function configure(isServer: boolean) {
+  const base = { resolve: {}, module: { rules: [] }, plugins: [] }
+  return config.webpack!(base, {
+    isServer,
+    webpack: { DefinePlugin: Define },
+  } as never)
+}
+describe('Payload OG bundled public font', () => {
+  it('rewrites the actual pinned SDK import and fails closed on a changed/duplicate import', () => {
+    const loader = require('../../scripts/webpack/payload-og-font.cjs') as (
+      source: string,
+    ) => string
+    const source = readFileSync(
+      new URL('../../node_modules/@payloadcms/next/dist/routes/rest/og/index.js', import.meta.url),
+      'utf8',
+    )
+    const transformed = loader(source)
+    expect(transformed).not.toContain("import fs from 'fs/promises';")
+    expect(transformed).toContain('/src/lib/payload-og-font.ts')
+    expect(transformed.slice(transformed.indexOf('import { ImageResponse'))).toBe(
+      source.slice(source.indexOf('import { ImageResponse')),
+    )
+    expect(() => loader(source.replace("import fs from 'fs/promises';", ''))).toThrow(
+      'import changed',
+    )
+    expect(() => loader(source + "import fs from 'fs/promises';")).toThrow('import changed')
+  })
+  it('embeds exact vendor font bytes in server code rather than trusting NFT presence', () => {
+    const result = configure(true),
+      plugin = result.plugins[0] as Define
+    expect(config.outputFileTracingIncludes).toBeUndefined()
+    const bytes = readFileSync(
+      new URL(
+        '../../node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff',
+        import.meta.url,
+      ),
+    )
+    expect(
+      Buffer.from(JSON.parse(plugin.definitions.__PAYLOAD_OG_FONT_BASE64__), 'base64'),
+    ).toEqual(bytes)
+    expect(configure(false).plugins).toHaveLength(0)
+    expect(configure(false).module.rules).toHaveLength(0)
+  })
+  it('transforms only the pinned SDK OG source before dependency parsing', () => {
+    const rule = configure(true).module.rules[0]
+    expect(rule.enforce).toBe('pre')
+    expect(rule.use[0].loader.replaceAll('\\', '/')).toMatch(
+      /scripts\/webpack\/payload-og-font.cjs$/,
+    )
+    for (const file of [
+      '/app/node_modules/@payloadcms/next/dist/routes/rest/og/index.js',
+      'C:\\app\\node_modules\\@payloadcms\\next\\dist\\routes\\rest\\og\\index.js',
+    ])
+      expect(rule.test.test(file)).toBe(true)
+    for (const file of [
+      '/app/src/index.js',
+      '/app/node_modules/payload/dist/uploads/index.js',
+      '/app/node_modules/@payloadcms/next/dist/routes/rest/index.js',
+    ])
+      expect(rule.test.test(file)).toBe(false)
   })
   it('retains security headers and does not configure a canonical/noindex override', async () => {
     expect(await config.headers!()).toEqual([
diff --git a/vercel.json b/vercel.json
index 76cec03..1f02946 100644
--- a/vercel.json
+++ b/vercel.json
@@ -5,7 +5,8 @@
       "codex/admin-locale-unpublish-fix": false,
       "codex/preview-navigation-fix": false,
       "codex/dashboard-phase-one": false,
-      "codex/dashboard-performance-og-fix": false
+      "codex/dashboard-performance-og-fix": false,
+      "codex/og-artifact-dashboard-diagnostics": false
     }
   }
 }

```

## scripts/webpack/payload-init-timing.cjs
```
// Pinned SDK import adapter for measurement only; does not alter vendor files.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Webpack's CommonJS loader contract.
const path = require('node:path')
module.exports = function payloadInitTimingLoader(source) {
  const expected = 'getAccessResults, getPayload, getRequestLanguage'
  if (source.split(expected).length !== 2)
    throw Error('Payload init import changed; review timing adapter')
  const adapter = path
    .resolve(__dirname, '../../src/lib/admin-server-timing.ts')
    .replaceAll('\\', '/')
  return (
    `import { tracePayloadInitialization } from ${JSON.stringify(adapter)};\n` +
    source.replace(
      expected,
      'getAccessResults, getPayload as getPayloadOriginal, getRequestLanguage',
    ) +
    '\nfunction getPayload(...args) { return tracePayloadInitialization(() => getPayloadOriginal(...args)); }\n'
  )
}

```

## scripts/webpack/payload-og-font.cjs
```
// Pinned Payload 3.92.1 contract: no vendor file is edited on disk.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Webpack's CommonJS loader contract.
const path = require('node:path')
module.exports = function payloadOGFontLoader(source) {
  const expected = "import fs from 'fs/promises';"
  if (source.split(expected).length !== 2) {
    throw Error('Payload OG fs import changed; review the font adapter before upgrading')
  }
  const adapter = path.resolve(__dirname, '../../src/lib/payload-og-font.ts')
  return source.replace(
    expected,
    `import fs from ${JSON.stringify(adapter.replaceAll('\\', '/'))};`,
  )
}

```

## src/lib/admin-server-timing.ts
```
import 'server-only'
import { cache } from 'react'
import { performance } from 'node:perf_hooks'
import { dashboardDiagnosticsEnabled } from './dashboard-diagnostics-enabled'

// React request cache, never shared between authenticated render requests.
const requestTiming = cache(() => ({
  started: null as number | null,
  rootAssemblyMs: null as number | null,
  payloadGetMs: 0,
  payloadGetCalls: 0,
}))

export async function traceAdminRoot<T>(load: () => Promise<T>): Promise<T> {
  if (!dashboardDiagnosticsEnabled()) return load()
  const timing = requestTiming(),
    at = performance.now()
  timing.started ??= at
  try {
    return await load()
  } finally {
    timing.rootAssemblyMs = performance.now() - at
  }
}

/** Times the actual SDK getPayload await, including cached/reused instances.
 * Does not claim this is cold initialization or PostgreSQL server time. */
export async function tracePayloadInitialization<T>(load: () => Promise<T>): Promise<T> {
  if (!dashboardDiagnosticsEnabled()) return load()
  const timing = requestTiming(),
    at = performance.now()
  timing.payloadGetCalls++
  try {
    return await load()
  } finally {
    timing.payloadGetMs += performance.now() - at
  }
}

export function adminServerTiming() {
  const t = requestTiming()
  return {
    serverToDashboardDataMs: t.started === null ? null : performance.now() - t.started,
    rootAssemblyMs: t.rootAssemblyMs,
    payloadGetMs: t.payloadGetCalls ? t.payloadGetMs : null,
    payloadGetCalls: t.payloadGetCalls,
  }
}

```

## src/lib/dashboard-diagnostics-enabled.ts
```
/** Explicit opt-in plus absolute expiry: an old deployment cannot keep logging. */
export function dashboardDiagnosticsEnabled(): boolean {
  const until = process.env.DASHBOARD_DIAGNOSTICS_UNTIL_MS
  return (
    process.env.DASHBOARD_DIAGNOSTICS === '1' &&
    typeof until === 'string' &&
    /^[0-9]{13}$/.test(until) &&
    Number(until) > Date.now()
  )
}

```

## src/lib/dashboard-diagnostics.ts
```
/* eslint-disable @typescript-eslint/no-explicit-any -- proposed pg callback observer; never reads query text/parameters. */
import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import type { Payload } from 'payload'
import { adminServerTiming } from './admin-server-timing'
import { dashboardDiagnosticsEnabled } from './dashboard-diagnostics-enabled'

// Server-only opt-in, bounded measurement. Never logs query/document inputs.
type Group = {
  calls: number
  wallSumMs: number
  queryCount: number
  driverSumMs: number
  acquireSumMs: number
  unmeasuredQueries: number
}
type Sample = {
  id: string
  groups: Record<string, Group>
  poolWaitingObservedMax: number
  closed: boolean
  driverObserved: boolean
}
type Context = { sample: Sample; group: string }
type State = {
  als: AsyncLocalStorage<Context>
  pools: WeakSet<object>
  clients: WeakSet<object>
  instance: string
  ordinal: number
}
const key = Symbol.for('drphynex.dashboard.diagnostics.v1')
const globals = globalThis as unknown as Record<symbol, State | undefined>
const state = () =>
  (globals[key] ??= {
    als: new AsyncLocalStorage<Context>(),
    pools: new WeakSet(),
    clients: new WeakSet(),
    instance: randomUUID(),
    ordinal: 0,
  })
const group = (c: Context) =>
  (c.sample.groups[c.group] ??= {
    calls: 0,
    wallSumMs: 0,
    queryCount: 0,
    driverSumMs: 0,
    acquireSumMs: 0,
    unmeasuredQueries: 0,
  })
const observe = (fn: () => void) => {
  try {
    fn()
  } catch {
    /* Measurement must not change application results. */
  }
}

function observePool(pool: any, s: State) {
  if (!pool || typeof pool.connect !== 'function') return false
  if (s.pools.has(pool)) return true
  const patchClient = (client: any) => {
    if (!client || typeof client.query !== 'function' || s.clients.has(client)) return
    const query = client.query
    client.query = function (this: any, ...args: any[]) {
      const c = s.als.getStore()
      if (!c || c.sample.closed) return query.apply(this, args)
      const g = group(c),
        at = performance.now()
      g.queryCount++
      let ended = false
      const finish = () =>
        observe(() => {
          if (!ended && !c.sample.closed) {
            ended = true
            g.driverSumMs += performance.now() - at
          }
        })
      const last = args.length - 1,
        callback = typeof args[last] === 'function'
      if (callback) {
        const cb = args[last]
        args[last] = function (this: any, ...values: any[]) {
          finish()
          return cb.apply(this, values)
        }
      }
      try {
        const value = query.apply(this, args)
        if (!callback) {
          if (value && typeof value.then === 'function') value.then(finish, finish)
          else g.unmeasuredQueries++
        }
        return value // Preserve pg Promise/Query identity and rejection behavior.
      } catch (error) {
        finish()
        throw error
      }
    }
    s.clients.add(client)
  }
  const connect = pool.connect
  pool.connect = function (this: any, ...args: any[]) {
    const c = s.als.getStore()
    if (!c || c.sample.closed) return connect.apply(this, args)
    const at = performance.now()
    const ready = (client?: any) =>
      observe(() => {
        if (!c.sample.closed) {
          group(c).acquireSumMs += performance.now() - at
          if (client) patchClient(client)
        }
      })
    if (typeof args[0] === 'function') {
      const cb = args[0]
      args[0] = function (this: any, ...values: any[]) {
        ready(values[1])
        return s.als.run(c, () => cb.apply(this, values))
      }
    }
    const callback = typeof args[0] === 'function'
    try {
      const value = connect.apply(this, args)
      observe(() => {
        c.sample.poolWaitingObservedMax = Math.max(
          c.sample.poolWaitingObservedMax,
          Number(pool.waitingCount) || 0,
        )
      })
      if (!callback && value && typeof value.then === 'function')
        value.then(
          (client: any) => ready(client),
          () => ready(),
        )
      return value
    } catch (error) {
      ready()
      throw error
    }
  }
  s.pools.add(pool)
  return true
}

function stageName(method: string, options: any): string {
  if (method === 'count') return 'inventory.count'
  if (method === 'find' && !options?.where) return 'inventory.list'
  const kind = !options?.user ? 'guest' : options.draft ? 'draft' : 'main'
  return (method === 'findGlobal' ? 'home.' : 'products.') + kind
}

/** No SQL/parameters, documents, user/locale IDs, basis/token, URL or errors are logged. */
export async function withDashboardDiagnostics<T>(
  payload: Payload,
  load: (p: Payload) => Promise<T>,
): Promise<T> {
  if (!dashboardDiagnosticsEnabled()) return load(payload)
  const s = state(),
    rawCap = process.env.DASHBOARD_DIAGNOSTICS_MAX
  const cap = rawCap && /^[1-9][0-9]?$/.test(rawCap) ? Math.min(20, Number(rawCap)) : 8
  if (s.ordinal >= cap) return load(payload)
  const ordinal = ++s.ordinal,
    sample: Sample = {
      id: randomUUID(),
      groups: {},
      poolWaitingObservedMax: 0,
      closed: false,
      driverObserved: false,
    }
  observe(() => {
    sample.driverObserved = observePool((payload.db as any)?.pool, s)
  })
  const proxy = new Proxy(payload, {
    get(target, name) {
      if (!['find', 'findGlobal', 'count'].includes(String(name))) return Reflect.get(target, name)
      return async (options: any) => {
        const c = { sample, group: stageName(String(name), options) },
          g = group(c),
          at = performance.now()
        g.calls++
        return s.als.run(c, async () => {
          try {
            return await (target as any)[name](options)
          } finally {
            g.wallSumMs += performance.now() - at
          }
        })
      }
    },
  })
  const started = performance.now()
  let result = 'error'
  try {
    const value = await s.als.run({ sample, group: 'other' }, () => load(proxy))
    result = 'ok'
    return value
  } finally {
    sample.closed = true
    observe(() =>
      console.info(
        'DX_DASHBOARD_PROFILE ' +
          JSON.stringify({
            version: 1,
            request: sample.id,
            instance: s.instance,
            ordinal,
            firstMeasuredInProcess: ordinal === 1,
            processUptimeMs: Math.round(process.uptime() * 1000),
            region: /^[a-z]{3}[0-9]$/.test(process.env.VERCEL_REGION || '')
              ? process.env.VERCEL_REGION
              : 'unknown',
            appReadTotalMs: performance.now() - started,
            ...adminServerTiming(),
            groups: sample.groups,
            poolWaitingObservedMax: sample.poolWaitingObservedMax,
            driverObserved: sample.driverObserved,
            result,
            unmeasured: [
              'cold initialization (getPayload await is measured separately)',
              'React serialization/render',
              'full HTTP request',
            ],
          }),
      ),
    )
  }
}

/** Synchronous projection only; NOT React render/serialization. */
export function traceDashboardProjection<T>(fn: () => T): T {
  const s = globals[key],
    c = s?.als.getStore()
  if (!s || !c || c.sample.closed) return fn()
  const next = { sample: c.sample, group: 'projection' },
    g = group(next),
    at = performance.now()
  g.calls++
  try {
    return s.als.run(next, fn)
  } finally {
    g.wallSumMs += performance.now() - at
  }
}

```

## src/lib/payload-og-font.ts
```
declare const __PAYLOAD_OG_FONT_BASE64__: string
const bytes = Buffer.from(__PAYLOAD_OG_FONT_BASE64__, 'base64')

/** Build-time replacement for ONLY Payload 3.92.1's OG fs/promises import.
 * No disk lookup, network, Payload data or user cache. Return a fresh buffer,
 * like fs.readFile, so one renderer cannot mutate another request's font.
 */
const payloadOGFont = {
  async readFile(file: unknown): Promise<Buffer> {
    if (typeof file !== 'string' || file.split(/[\\/]/).at(-1) !== 'roboto-regular.woff') {
      throw new Error('Unsupported Payload OG asset')
    }
    return Buffer.from(bytes)
  },
}

export default payloadOGFont

```

## tests/unit/dashboard-diagnostics-enabled.spec.ts
```
import { afterEach, expect, it, vi } from 'vitest'
import { dashboardDiagnosticsEnabled } from '@/lib/dashboard-diagnostics-enabled'
afterEach(() => vi.unstubAllEnvs())
it('requires explicit enable and a valid future deadline', () => {
  for (const flag of [undefined, '0', 'true']) {
    vi.stubEnv('DASHBOARD_DIAGNOSTICS', flag)
    vi.stubEnv('DASHBOARD_DIAGNOSTICS_UNTIL_MS', String(Date.now() + 60000))
    expect(dashboardDiagnosticsEnabled()).toBe(false)
  }
  vi.stubEnv('DASHBOARD_DIAGNOSTICS', '1')
  for (const until of [undefined, '', 'invalid', String(Date.now() - 1)]) {
    vi.stubEnv('DASHBOARD_DIAGNOSTICS_UNTIL_MS', until)
    expect(dashboardDiagnosticsEnabled()).toBe(false)
  }
  vi.stubEnv('DASHBOARD_DIAGNOSTICS_UNTIL_MS', String(Date.now() + 60000))
  expect(dashboardDiagnosticsEnabled()).toBe(true)
})

```

## tests/unit/dashboard-diagnostics.spec.ts
```
/* eslint-disable @typescript-eslint/no-explicit-any -- fake pg callbacks, no network. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { withDashboardDiagnostics, traceDashboardProjection } from '@/lib/dashboard-diagnostics'
const key = Symbol.for('drphynex.dashboard.diagnostics.v1')
beforeEach(() => {
  Reflect.deleteProperty(globalThis, key)
  vi.stubEnv('DASHBOARD_DIAGNOSTICS', '1')
  vi.stubEnv('DASHBOARD_DIAGNOSTICS_UNTIL_MS', String(Date.now() + 600000))
  vi.stubEnv('DASHBOARD_DIAGNOSTICS_MAX', '8')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, key)
})
function fixture() {
  const client: any = {
    query: vi.fn((_sql: unknown, _params: unknown, cb: any) => {
      queueMicrotask(() => cb(null, { rows: [] }))
    }),
  }
  const originalConnect = vi.fn((cb: any) => setTimeout(() => cb(null, client, () => {}), 1))
  const pool = { connect: originalConnect, waitingCount: 1 }
  const payload: any = {
    db: { pool },
    find: async (options: any) =>
      new Promise((resolve) =>
        pool.connect((_e: any, c: any) =>
          c.query('SECRET_SQL_SENTINEL', ['PRIVATE_VALUE'], () =>
            resolve({ docs: [{ private: 'DRAFT_BODY', user: options.user }] }),
          ),
        ),
      ),
  }
  return { payload, pool, client, originalConnect }
}
it('disabled means no pool access, no log, and identical return value', async () => {
  vi.stubEnv('DASHBOARD_DIAGNOSTICS', '0')
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  const payload = {
    get db() {
      throw Error('must not inspect')
    },
  }
  expect(await withDashboardDiagnostics(payload as never, async (p) => p)).toBe(payload)
  expect(log).not.toHaveBeenCalled()
})
it('concurrent reads share one pool wrapper but isolate groups/requests and do not log data', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {}),
    { payload, pool } = fixture()
  const work = (draft: boolean) =>
    withDashboardDiagnostics(payload, async (p) => {
      const value = await p.find({
        collection: 'products',
        draft,
        user: { role: 'editor' },
        where: { id: { in: [1] } },
      } as never)
      traceDashboardProjection(() => 1)
      return value
    })
  await Promise.all([work(true), work(false)])
  const records = log.mock.calls.map((c) =>
    JSON.parse(String(c[0]).slice('DX_DASHBOARD_PROFILE '.length)),
  )
  expect(records).toHaveLength(2)
  expect(new Set(records.map((r) => r.request)).size).toBe(2)
  expect(records.find((r) => r.groups['products.draft'])?.groups['products.draft'].queryCount).toBe(
    1,
  )
  expect(records.find((r) => r.groups['products.main'])?.groups['products.main'].queryCount).toBe(1)
  expect(records.every((r) => r.groups.projection.calls === 1 && r.result === 'ok')).toBe(true)
  expect(JSON.stringify(records)).not.toMatch(
    /SECRET_SQL|PRIVATE_VALUE|DRAFT_BODY|editor|where|basis|token/,
  )
  const wrapper = pool.connect
  await work(true)
  expect(pool.connect).toBe(wrapper)
})
it('cap limits records and measurement/logger failures do not hide application failures', async () => {
  vi.stubEnv('DASHBOARD_DIAGNOSTICS_MAX', '1')
  const log = vi.spyOn(console, 'info').mockImplementation(() => {
    throw Error('logger failure')
  })
  const { payload } = fixture()
  const error = new Error('PRIVATE_FAILURE')
  await expect(
    withDashboardDiagnostics(payload, async () => {
      throw error
    }),
  ).rejects.toBe(error)
  expect(await withDashboardDiagnostics(payload, async () => 42)).toBe(42)
  expect(log).toHaveBeenCalledTimes(1)
})

```

## tests/unit/dashboard-server-timing.spec.ts
```
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
vi.mock('server-only', () => ({}))
beforeEach(() => vi.stubEnv('DASHBOARD_DIAGNOSTICS_UNTIL_MS', String(Date.now() + 600000)))
vi.mock('react', () => ({
  cache: (fn: () => unknown) => {
    let value: unknown
    return () => (value ??= fn())
  },
}))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})
it('disabled timing returns original values/errors without measuring initialization', async () => {
  vi.stubEnv('DASHBOARD_DIAGNOSTICS', '0')
  const t = await import('@/lib/admin-server-timing'),
    value = {},
    error = new Error('private')
  expect(await t.traceAdminRoot(() => t.tracePayloadInitialization(async () => value))).toBe(value)
  expect(t.adminServerTiming().payloadGetMs).toBeNull()
  await expect(
    t.tracePayloadInitialization(async () => {
      throw error
    }),
  ).rejects.toBe(error)
})
it('measures actual getPayload await and server-to-data boundary, not full HTTP/render', async () => {
  vi.stubEnv('DASHBOARD_DIAGNOSTICS', '1')
  const t = await import('@/lib/admin-server-timing')
  await t.traceAdminRoot(() =>
    t.tracePayloadInitialization(async () => new Promise((r) => setTimeout(r, 8))),
  )
  const result = t.adminServerTiming()
  expect(result.payloadGetCalls).toBe(1)
  expect(result.payloadGetMs).toBeGreaterThan(0)
  expect(result.serverToDashboardDataMs).toBeGreaterThanOrEqual(result.rootAssemblyMs!)
  expect(result).not.toHaveProperty('fullHttpMs')
})
it('SDK timing adapter keeps real getPayload invocation and rejects a changed import', () => {
  const require = createRequire(import.meta.url)
  const loader = require('../../scripts/webpack/payload-init-timing.cjs') as (s: string) => string
  const source = readFileSync(
    new URL('../../node_modules/@payloadcms/next/dist/utilities/initReq.js', import.meta.url),
    'utf8',
  )
  const output = loader(source)
  expect(output).toContain('getPayloadOriginal(...args)')
  expect(output).toContain('const payload = await getPayload({')
  expect(output).toContain('tracePayloadInitialization')
  expect(() =>
    loader(source.replace('getAccessResults, getPayload, getRequestLanguage', 'changed')),
  ).toThrow('import changed')
})

```

## tests/unit/payload-og-font.spec.ts
```
import { describe, expect, it, vi } from 'vitest'
vi.hoisted(() => vi.stubGlobal('__PAYLOAD_OG_FONT_BASE64__', 'Zm9udC1maXh0dXJl'))
import fontFS from '@/lib/payload-og-font'
describe('Payload OG public font replacement', () => {
  it('serves the embedded bytes regardless of the frozen build directory; no filesystem lookup', async () => {
    expect(
      (
        await fontFS.readFile(
          '/vercel/path0/node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff',
        )
      ).toString(),
    ).toBe('font-fixture')
    expect((await fontFS.readFile('C:\\old-build\\roboto-regular.woff')).toString()).toBe(
      'font-fixture',
    )
  })
  it('returns independent buffers and refuses any other asset/path type', async () => {
    const one = await fontFS.readFile('/build/roboto-regular.woff')
    one.fill(0)
    expect((await fontFS.readFile('/other-build/roboto-regular.woff')).toString()).toBe(
      'font-fixture',
    )
    for (const value of [
      '/tmp/private.pdf',
      '/tmp/other-roboto-regular.woff',
      null,
      {},
      new URL('file:///build/roboto-regular.woff'),
    ])
      await expect(fontFS.readFile(value)).rejects.toThrow('Unsupported Payload OG asset')
  })
})

```

## Kết quả trước review
54/54 unit có mục tiêu, typecheck exit0, lint exit0 (Admin page bị ignore trong config nhưng đã chạy --no-ignore riêng exit0), build webpack exit0 một worker/heap2048 trong workspace vật lý riêng. Artifact nguồn cuối: HTTP200 image/png23907bytes1200x630, không font IO ngoài Function. Build còn warning cache big strings. Không có timing Production mới. Exact byte match build/runtime sources ghi ở evidence/approved-measurement/build-source.json.
