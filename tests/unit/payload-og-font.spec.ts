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
