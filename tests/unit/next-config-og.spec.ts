import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
class Define {
  constructor(readonly definitions: Record<string, string>) {}
}
vi.mock('@payloadcms/next/withPayload', () => ({ withPayload: (config: unknown) => config }))
vi.mock('next-intl/plugin', () => ({ default: () => (config: unknown) => config }))
import config from '../../next.config'
function configure(isServer: boolean) {
  const base = { resolve: {}, module: { rules: [] }, plugins: [] }
  return config.webpack!(base, {
    isServer,
    webpack: { DefinePlugin: Define },
  } as never)
}
describe('Payload OG bundled public font', () => {
  it('rewrites the actual pinned SDK import and fails closed on a changed/duplicate import', () => {
    const loader = require('../../scripts/webpack/payload-og-font.cjs') as (
      source: string,
    ) => string
    const source = readFileSync(
      new URL('../../node_modules/@payloadcms/next/dist/routes/rest/og/index.js', import.meta.url),
      'utf8',
    )
    const transformed = loader(source)
    expect(transformed).not.toContain("import fs from 'fs/promises';")
    expect(transformed).toContain('/src/lib/payload-og-font.ts')
    expect(transformed.slice(transformed.indexOf('import { ImageResponse'))).toBe(
      source.slice(source.indexOf('import { ImageResponse')),
    )
    expect(() => loader(source.replace("import fs from 'fs/promises';", ''))).toThrow(
      'import changed',
    )
    expect(() => loader(source + "import fs from 'fs/promises';")).toThrow('import changed')
  })
  it('embeds exact vendor font bytes in server code rather than trusting NFT presence', () => {
    const result = configure(true),
      plugin = result.plugins[0] as Define
    expect(config.outputFileTracingIncludes).toBeUndefined()
    const bytes = readFileSync(
      new URL(
        '../../node_modules/@payloadcms/next/dist/routes/rest/og/roboto-regular.woff',
        import.meta.url,
      ),
    )
    expect(
      Buffer.from(JSON.parse(plugin.definitions.__PAYLOAD_OG_FONT_BASE64__), 'base64'),
    ).toEqual(bytes)
    expect(configure(false).plugins).toHaveLength(0)
    expect(configure(false).module.rules).toHaveLength(0)
  })
  it('transforms only the pinned SDK OG source before dependency parsing', () => {
    const rule = configure(true).module.rules[0]
    expect(rule.enforce).toBe('pre')
    expect(rule.use[0].loader.replaceAll('\\', '/')).toMatch(
      /scripts\/webpack\/payload-og-font.cjs$/,
    )
    for (const file of [
      '/app/node_modules/@payloadcms/next/dist/routes/rest/og/index.js',
      'C:\\app\\node_modules\\@payloadcms\\next\\dist\\routes\\rest\\og\\index.js',
    ])
      expect(rule.test.test(file)).toBe(true)
    for (const file of [
      '/app/src/index.js',
      '/app/node_modules/payload/dist/uploads/index.js',
      '/app/node_modules/@payloadcms/next/dist/routes/rest/index.js',
    ])
      expect(rule.test.test(file)).toBe(false)
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
