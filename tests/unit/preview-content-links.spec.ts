import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
import PreviewLink, { PreviewNavigation } from '@/components/preview/PreviewNavigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { RichText } from '@/components/ui/RichText'
import { ConsentField } from '@/components/forms/FormParts'
import { builderPreviewRoute, previewHref, previewRequestHeaders, previewReport } from '@/lib/preview-navigation'

const guest = (children: ReturnType<typeof createElement>) => createElement(PreviewNavigation, {
  view: 'guest', origin: 'mx-02-luma', siteOrigin: 'https://example.com', path: '/ko/products/mx-02-luma',
}, children)
it('renders the actual breadcrumb with guest/original-draft context in SSR', async () => {
  const html = renderToStaticMarkup(guest(await Breadcrumb({ items: [{ label: 'Products', href: '/ko/products' }, { label: 'LUMA' }] })))
  expect(html).toContain('href="/ko/products?lp=guest&amp;lpOrigin=mx-02-luma"')
})
it('keeps guest context on the real form privacy link', () => {
  const html = renderToStaticMarkup(guest(createElement(ConsentField, { state: { status: 'idle' }, privacyHref: '/ko/privacy' })))
  expect(html).toContain('href="/ko/privacy?lp=guest&amp;lpOrigin=mx-02-luma"')
})
it('renders a real CMS internal rich-text link with context, never an external/exit link', () => {
  const link = (url: string) => ({ type: 'link', version: 3, fields: { linkType: 'custom', url }, children: [{ type: 'text', text: 'Link', version: 1 }] })
  const html = renderToStaticMarkup(guest(createElement(RichText, { locale: 'ko', data: { root: { type: 'root', version: 1, children: [
    { type: 'paragraph', version: 1, children: [link('/ko/products/public-fixture'), link('https://external.invalid/page'), link('/preview/exit?path=%2Fko')] },
  ] } } })))
  expect(html).toContain('/ko/products/public-fixture?lp=guest&amp;lpOrigin=mx-02-luma')
  expect(html).toContain('href="https://external.invalid/page"')
  expect(html).toContain('href="/preview/exit?path=%2Fko"')
})
it.each(['/preview/exit?path=%2Fko', '/admin', '/api/media/file/private.png', 'https://external.invalid/ko', 'mailto:hello@example.com', '#main'])('does not propagate context to %s', href => {
  expect(previewHref(href, 'guest', 'mx-02-luma', 'https://example.com', '/ko/products')).toBe(href)
})
it('keeps context through relative, same-origin absolute, filters and soft-navigation Link props', () => {
  expect(previewHref('https://example.com/ko/contact?product=p#form', 'guest', 'mx-02-luma', 'https://example.com')).toBe('/ko/contact?product=p&lp=guest&lpOrigin=mx-02-luma#form')
  expect(previewHref('?line=mx', 'guest', 'mx-02-luma', 'https://example.com', '/ko/products')).toBe('/ko/products?line=mx&lp=guest&lpOrigin=mx-02-luma')
  const html = renderToStaticMarkup(guest(createElement(PreviewLink, { href: '/ko/products/public-fixture' }, 'Next')))
  expect(html).toContain('/ko/products/public-fixture?lp=guest&amp;lpOrigin=mx-02-luma')
})
it('permits the draft exception only for the original product; a later product uses public reads', () => {
  const make = (slug: string) => previewRequestHeaders(new URL(`https://example.com/ko/products/${slug}?lp=guest&lpOrigin=mx-02-luma`), new Headers())
  expect(make('mx-02-luma').get('x-dx-preview-product')).toBe('1')
  expect(make('mx-01-forma').get('x-dx-preview-product')).toBe('0')
})
it('requires an explicit valid report; staff marks override an asserted guest view', () => {
  for (const value of [null, {}, { source: 'dx-lp-preview', type: 'ready', view: 'guest' }, { source: 'dx-lp-preview', type: 'ready', view: 'guest', href: 'https://example.com/admin' }]) expect(previewReport(value)).toBeNull()
  expect(previewReport({ source: 'dx-lp-preview', type: 'ready', view: 'guest', href: 'https://example.com/ko/products?lp=staff', staffMarks: false })).toBeNull()
  expect(previewReport({ source: 'dx-lp-preview', type: 'ready', view: 'guest', href: 'https://example.com/ko/products?lp=guest', staffMarks: false })?.view).toBe('guest')
  expect(previewReport({ source: 'dx-lp-preview', type: 'ready', view: 'guest', href: 'https://example.com/ko/brand?lp=guest', staffMarks: true })?.view).toBe('staff')
})
it('mode changes preserve the inner route/locale but changing the edited document resets the destination', () => {
  const location = { path: '/en/contact?lp=guest', locale: 'ko', slug: 'mx-02-luma' }
  expect(builderPreviewRoute('ko', 'mx-02-luma', location)).toBe('/en/contact?lp=guest')
  expect(builderPreviewRoute('vi', 'mx-02-luma', location)).toBe('/vi/products/mx-02-luma')
  expect(builderPreviewRoute('ko', 'other-product', location)).toBe('/ko/products/other-product')
  expect(builderPreviewRoute('ko', 'mx-02-luma', { ...location, path: '/admin' })).toBe('/ko/products/mx-02-luma')
})
