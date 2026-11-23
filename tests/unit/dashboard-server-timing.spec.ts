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
