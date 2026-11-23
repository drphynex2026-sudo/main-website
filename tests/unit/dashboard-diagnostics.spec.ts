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
it('does not count an unmeasured waiter when a measured request releases the pooled client', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  let queued: any,
    defer = false,
    releaseWaiter = false
  const client: any = {
    query: vi.fn((_sql: unknown, cb: any) => {
      if (releaseWaiter) {
        releaseWaiter = false
        const next = queued
        queued = null
        next(null, client)
      }
      cb(null, { rows: [] })
    }),
  }
  const pool = {
    waitingCount: 0,
    connect: (cb: any) => {
      if (defer) {
        queued = cb
        pool.waitingCount = 1
        return
      }
      cb(null, client)
    },
  }
  const payload: any = {
    db: { pool },
    find: () =>
      new Promise((resolve) =>
        pool.connect((_e: any, c: any) => c.query('SENTINEL', () => resolve({ docs: [] }))),
      ),
  }
  const options = {
    collection: 'products',
    draft: true,
    user: { role: 'admin' },
    where: { id: { in: [1] } },
  } as never
  const actualQuery = client.query
  await withDashboardDiagnostics(payload, (p) => p.find(options)) // install observer/client wrapper
  log.mockClear()
  actualQuery.mockClear()
  defer = true
  const publicRead = payload.find() // queued outside any dashboard ALS context
  defer = false
  releaseWaiter = true
  await withDashboardDiagnostics(payload, (p) => p.find(options))
  await publicRead
  expect(actualQuery).toHaveBeenCalledTimes(2)
  const result = JSON.parse(String(log.mock.calls[0][0]).slice('DX_DASHBOARD_PROFILE '.length))
  expect(result.groups['products.draft'].queryCount).toBe(1)
})
