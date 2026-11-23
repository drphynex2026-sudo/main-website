/* eslint-disable @typescript-eslint/no-explicit-any -- test-only pg callback instrumentation. */
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import type { Payload } from 'payload'

/** Test-only. No SQL, parameters, documents or credentials enter the report. */
export function profileDashboard(payload: Payload) {
  const context = new AsyncLocalStorage<string>()
  const groups: Record<
    string,
    { calls: number; ms: number; queries: number; queryMs: number; acquireMs: number }
  > = {}
  const fingerprints = new Map<string, number>()
  const exactQueries = new Map<string, number>()
  const spans = new Map<string, { start: number; end: number }>()
  const group = (name = context.getStore() ?? 'other') =>
    (groups[name] ??= { calls: 0, ms: 0, queries: 0, queryMs: 0, acquireMs: 0 })
  const pool = (payload.db as any).pool
  const connect = pool.connect
  const originals = new Map<any, any>()
  let pendingPeak = 0,
    acquires = 0
  pool.connect = function (callback?: any): any {
    const started = performance.now(),
      label = context.getStore() ?? 'other'
    acquires++
    const ready = (error: any, client: any, release: any) => {
      group(label).acquireMs += performance.now() - started
      if (client && !originals.has(client)) {
        const query = client.query
        originals.set(client, query)
        client.query = function (...args: any[]) {
          const g = group(),
            at = performance.now()
          g.queries++
          const text = typeof args[0] === 'string' ? args[0] : (args[0]?.text ?? '')
          const fingerprint = createHash('sha256').update(text).digest('hex')
          fingerprints.set(fingerprint, (fingerprints.get(fingerprint) ?? 0) + 1)
          const exact = createHash('sha256')
            .update(
              JSON.stringify([
                text,
                (typeof args[1] !== 'function' ? args[1] : undefined) ?? args[0]?.values ?? null,
              ]),
            )
            .digest('hex')
          exactQueries.set(exact, (exactQueries.get(exact) ?? 0) + 1)
          const last = args.length - 1
          if (typeof args[last] === 'function') {
            const cb = args[last]
            args[last] = (...result: any[]) => {
              g.queryMs += performance.now() - at
              cb(...result)
            }
            return query.apply(this, args)
          }
          try {
            return Promise.resolve(query.apply(this, args)).finally(() => {
              g.queryMs += performance.now() - at
            })
          } catch (error) {
            g.queryMs += performance.now() - at
            throw error
          }
        }
      }
      context.run(label, () => callback?.(error, client, release))
    }
    if (callback) {
      const result = connect.call(this, ready)
      pendingPeak = Math.max(pendingPeak, pool.waitingCount)
      return result
    }
    return new Promise((resolve, reject) => {
      connect.call(this, (error: any, client: any, release: any) => {
        ready(error, client, release)
        if (error) reject(error)
        else resolve(client)
      })
      pendingPeak = Math.max(pendingPeak, pool.waitingCount)
    })
  }
  const proxy = new Proxy(payload, {
    get(target, key) {
      if (!['find', 'findGlobal', 'count'].includes(String(key))) return Reflect.get(target, key)
      return async (options: any) => {
        const inventory = key === 'count' || (key === 'find' && !options.where)
        const name = inventory
          ? 'inventory'
          : `${key === 'findGlobal' ? 'home' : 'products'}.${!options.user ? 'guest' : options.draft ? 'draft' : 'main'}`
        return context.run(name, async () => {
          const g = group(name),
            started = performance.now()
          g.calls++
          if (!spans.has(name)) spans.set(name, { start: started, end: started })
          try {
            return await (target as any)[key](options)
          } finally {
            const ended = performance.now()
            g.ms += ended - started
            spans.get(name)!.end = ended
          }
        })
      }
    },
  })
  return {
    payload: proxy,
    report: () => ({
      groups,
      acquires,
      pendingPeak,
      poolMax: pool.options.max,
      groupElapsedMs: Object.fromEntries(
        [...spans].map(([name, span]) => [name, span.end - span.start]),
      ),
      sqlCount: [...fingerprints.values()].reduce((a, b) => a + b, 0),
      uniqueSQLShapes: fingerprints.size,
      repeatedSQLShapes: [...fingerprints.values()].filter((n) => n > 1).length,
      duplicateSQLExecutions: [...exactQueries.values()].reduce(
        (sum, n) => sum + Math.max(0, n - 1),
        0,
      ),
      note: 'Group ms overlap. Acquire includes connection establishment and queue; queryMs excludes pool wait. Repeated shapes may have different parameters.',
    }),
    restore() {
      pool.connect = connect
      for (const [client, query] of originals) client.query = query
    },
  }
}
