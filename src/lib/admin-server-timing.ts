import 'server-only'
import { cache } from 'react'
import { performance } from 'node:perf_hooks'
import { dashboardDiagnosticsEnabled } from './dashboard-diagnostics-enabled'
const adapterKey = Symbol.for('drphynex.payloadInitTimingAdapter.v1')
export function registerPayloadInitAdapter() {
  Reflect.set(globalThis, adapterKey, true)
}

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
    payloadInitAdapter: Reflect.get(globalThis, adapterKey) === true,
    serverToDashboardDataMs: t.started === null ? null : performance.now() - t.started,
    rootAssemblyMs: t.rootAssemblyMs,
    payloadGetMs: t.payloadGetCalls ? t.payloadGetMs : null,
    payloadGetCalls: t.payloadGetCalls,
  }
}
