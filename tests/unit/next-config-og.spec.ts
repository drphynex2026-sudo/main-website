import { describe, expect, it, vi } from 'vitest'
vi.mock('@payloadcms/next/withPayload', () => ({ withPayload: (config: unknown) => config }))
vi.mock('next-intl/plugin', () => ({ default: () => (config: unknown) => config }))
import config from '../../next.config'
describe('Payload OG runtime asset trace', () => {
  it('includes the exact vendor font only in the REST catch-all trace', () => {
    expect(config.outputFileTracingIncludes).toEqual({
      '/api/\\[\\.\\.\\.slug\\]': [
        './node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff',
      ],
    })
  })
  it('retains security headers and does not configure a canonical/noindex override', async () => {
    expect(await config.headers!()).toEqual([
      expect.objectContaining({
        source: '/:path*',
        headers: expect.arrayContaining([
          expect.objectContaining({ key: 'X-Content-Type-Options', value: 'nosniff' }),
        ]),
      }),
    ])
    expect(config.images?.unoptimized).toBe(true)
  })
})
