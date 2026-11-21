import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewHref, previewRequestHeaders, previewView } from '@/lib/preview-navigation'

const mocks = vi.hoisted(() => ({
  enabled: true,
  headers: new Headers(),
  user: { id: 1, role: 'admin' } as { id: number; role: string } | null,
  auth: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))
vi.mock('next/headers', () => ({
  draftMode: async () => ({ isEnabled: mocks.enabled }),
  headers: async () => mocks.headers,
}))
vi.mock('@/lib/content-client', () => ({ getPayloadClient: async () => ({ auth: mocks.auth }) }))
import { getPreviewStaffUser, getPreviewUser } from '@/lib/preview'

beforeEach(() => {
  mocks.enabled = true
  mocks.user = { id: 1, role: 'admin' }
  mocks.auth.mockReset().mockImplementation(async () => ({ user: mocks.user }))
  mocks.headers = new Headers()
})

describe('builder navigation context', () => {
  it.each(['ko', 'en', 'vi'])('keeps guest mode for every menu and locale in %s', (locale) => {
    for (const path of ['/products/mx-01-forma', '/products/mx-02-luma', '/products/rx-matrix-balm', '/products/rx-matrix-sheet', '/brand', '/contact', '']) {
      expect(previewHref(`/${locale}${path}`, 'guest')).toBe(`/${locale}${path}?lp=guest`)
    }
  })
  it('keeps filters/hash, replaces conflicting mode, and leaves unrelated URLs alone', () => {
    expect(previewHref('/ko/contact?product=luma&lp=staff#form', 'guest')).toBe('/ko/contact?product=luma&lp=guest#form')
    expect(previewHref('/en?topic=care', 'staff')).toBe('/en?topic=care&lp=staff')
    for (const href of ['https://example.com', '//example.com', '#main', 'mailto:hello@example.com']) expect(previewHref(href, 'guest')).toBe(href)
    expect(previewHref('/ko/brand', null)).toBe('/ko/brand')
    expect(previewView('invalid')).toBeNull()
  })
  it('replaces forged request context using the actual URL', () => {
    const forged = new Headers({ 'x-dx-preview-view': 'staff', 'x-dx-preview-product': '1' })
    const actual = previewRequestHeaders(new URL('https://example.com/ko/brand?lp=guest'), forged)
    expect(actual.get('x-dx-preview-view')).toBe('guest')
    expect(actual.get('x-dx-preview-product')).toBe('0')
    expect(previewRequestHeaders(new URL('https://example.com/ko/brand'), forged).get('x-dx-preview-view')).toBe('')
  })
  it.each(['ko', 'en', 'vi'])('keeps authorized product draft simulation but uses guest reads on other pages (%s)', async (locale) => {
    mocks.headers = previewRequestHeaders(new URL(`https://example.com/${locale}/products/mx-02-luma?lp=guest`), new Headers())
    expect(await getPreviewUser()).toEqual(mocks.user)
    for (const path of ['brand', 'contact', 'products', '']) {
      mocks.headers = previewRequestHeaders(new URL(`https://example.com/${locale}/${path}?lp=guest`), new Headers())
      expect(await getPreviewUser()).toBeNull()
      expect(await getPreviewStaffUser()).toEqual(mocks.user)
    }
  })
  it('never grants draft access from the mode alone', async () => {
    mocks.headers = previewRequestHeaders(new URL('https://example.com/ko/products/mx-02-luma?lp=guest'), new Headers())
    mocks.enabled = false
    expect(await getPreviewUser()).toBeNull()
    expect(mocks.auth).not.toHaveBeenCalled()
    mocks.enabled = true
    mocks.user = null
    expect(await getPreviewUser()).toBeNull()
    mocks.user = { id: 2, role: 'customer' }
    expect(await getPreviewUser()).toBeNull()
  })
  it('preserves ordinary staff preview', async () => {
    expect(await getPreviewUser()).toEqual(mocks.user)
    mocks.headers = previewRequestHeaders(new URL('https://example.com/ko/brand?lp=staff'), new Headers())
    expect(await getPreviewUser()).toEqual(mocks.user)
  })
})
