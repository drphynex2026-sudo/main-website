/** Request-scoped preview navigation, never an authorization credential. */
export const previewViewHeader = 'x-dx-preview-view'
export const previewProductHeader = 'x-dx-preview-product'
export type PreviewView = 'guest' | 'staff' | null

export function previewView(value: string | null): PreviewView {
  return value === 'guest' || value === 'staff' ? value : null
}

export function previewHref(href: string, view: PreviewView): string {
  if (!view || !href.startsWith('/') || href.startsWith('//')) return href
  const url = new URL(href, 'https://preview.invalid')
  url.searchParams.set('lp', view)
  return url.pathname + url.search + url.hash
}

export function previewRequestHeaders(url: URL, incoming: Headers): Headers {
  const headers = new Headers(incoming)
  // Always overwrite client-supplied context. Access still requires draft mode + staff auth.
  headers.set(previewViewHeader, previewView(url.searchParams.get('lp')) ?? '')
  headers.set(previewProductHeader, /^\/(ko|en|vi)\/products\/[^/]+\/?$/.test(url.pathname) ? '1' : '0')
  return headers
}
