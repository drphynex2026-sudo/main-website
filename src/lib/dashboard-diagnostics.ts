/* eslint-disable @typescript-eslint/no-explicit-any -- proposed pg callback observer; never reads query text/parameters. */
import 'server-only'
import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks'
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
    // pg-pool can invoke a waiter from the releasing client's async context.
    // Bind every caller, including callers outside an instrumented request.
    if (typeof args[0] === 'function') args[0] = AsyncResource.bind(args[0])
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
