/** Request-scoped preview navigation, never an authorization credential. */
export const previewViewHeader = 'x-dx-preview-view'
export const previewProductHeader = 'x-dx-preview-product'
export const previewOriginHeader = 'x-dx-preview-origin'
export type PreviewView = 'guest' | 'staff' | null
export type BuilderLocation = { path: string; locale: string; slug: string }

/** Inner-frame language navigation is independent of the document locale being edited. */
export function builderPreviewRoute(locale: string, slug: string, location: BuilderLocation | null): string {
  return location?.locale === locale && location.slug === slug && /^\/(ko|en|vi)(?:\/|$)/.test(location.path)
    ? location.path : `/${locale}/products/${slug}`
}

export function previewView(value: string | null): PreviewView {
  return value === 'guest' || value === 'staff' ? value : null
}

export function previewHref(href: string, view: PreviewView, origin?: string | null, siteOrigin = 'https://preview.invalid', currentPath = '/'): string {
  if (!view || href.startsWith('#')) return href
  let url: URL
  try { url = new URL(href, new URL(currentPath, siteOrigin)) } catch { return href }
  // Only frontend routes; exit/auth/API/download and external links never carry preview context.
  if (url.origin !== new URL(siteOrigin).origin || !/^\/(?:$|(?:ko|en|vi)(?:\/|$))/.test(url.pathname)) return href
  url.searchParams.set('lp', view)
  if (origin) url.searchParams.set('lpOrigin', origin)
  return url.pathname + url.search + url.hash
}

export function previewRequestHeaders(url: URL, incoming: Headers): Headers {
  const headers = new Headers(incoming)
  // Always overwrite client-supplied context. Access still requires draft mode + staff auth.
  headers.set(previewViewHeader, previewView(url.searchParams.get('lp')) ?? '')
  const slug = /^\/(ko|en|vi)\/products\/([^/]+)\/?$/.exec(url.pathname)?.[2]
  const requestedOrigin = url.searchParams.get('lpOrigin')
  const origin = requestedOrigin === null ? slug : /^[a-z0-9-]{1,80}$/.test(requestedOrigin) ? requestedOrigin : undefined
  headers.set(previewOriginHeader, origin ?? '')
  headers.set(previewProductHeader, slug && slug === origin ? '1' : '0')
  return headers
}

export type PreviewReport = { view: PreviewView; href: string }
/** Explicit frame acknowledgement; absence/malformed reports never confirm Guest. */
export function previewReport(data: unknown): PreviewReport | null {
  if (!data || typeof data !== 'object') return null
  const value = data as Record<string, unknown>
  if (value.source !== 'dx-lp-preview' || value.type !== 'ready' || typeof value.href !== 'string' || !previewView(typeof value.view === 'string' ? value.view : null)) return null
  try {
    const url = new URL(value.href)
    if (!['http:', 'https:'].includes(url.protocol) || !/^\/(ko|en|vi)(?:\/|$)/.test(url.pathname) || url.searchParams.get('lp') !== value.view) return null
  } catch { return null }
  return { view: value.staffMarks === true ? 'staff' : value.view as PreviewView, href: value.href }
}
