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
