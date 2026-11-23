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
