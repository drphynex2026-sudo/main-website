'use client'

import NextLink from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { createContext, useContext, useEffect, type ComponentProps, type ReactNode } from 'react'
import { previewHref, previewNavigationChangesPage, type PreviewView } from '@/lib/preview-navigation'

type Context = { view: PreviewView; origin: string | null; siteOrigin: string; path: string }
const PreviewContext = createContext<Context>({ view: null, origin: null, siteOrigin: 'https://preview.invalid', path: '/' })
const send = (data: Record<string, unknown>) => {
  if (window.parent !== window) window.parent.postMessage({ source: 'dx-lp-preview', ...data }, window.location.origin)
}

export function PreviewNavigation({ children, ...context }: Context & { children?: ReactNode }) {
  return <PreviewContext.Provider value={context}>{children}</PreviewContext.Provider>
}

/** Reruns after soft navigation as well as a document load, on every PageShell route. */
export function PreviewReporter() {
  const context = useContext(PreviewContext)
  const path = usePathname()
  const search = useSearchParams()
  useEffect(() => {
    const report = () => send({ type: 'ready', view: context.view, href: window.location.href,
      staffMarks: !!document.querySelector('[data-preview-staff-mark]') })
    report()
    const renderedURL = window.location.href
    window.addEventListener('pageshow', report)
    window.addEventListener('hashchange', report)
    const navigating = () => previewNavigationChangesPage(window.location.href, renderedURL)
      ? send({ type: 'navigating', href: window.location.href }) : report()
    window.addEventListener('popstate', navigating)
    const onMessage = (e: MessageEvent) => {
      if (e.source === window.parent && e.origin === window.location.origin && e.data?.source === 'dx-lp-builder' && e.data.type === 'report') report()
    }
    window.addEventListener('message', onMessage)
    return () => { window.removeEventListener('pageshow', report); window.removeEventListener('hashchange', report); window.removeEventListener('message', onMessage); window.removeEventListener('popstate', navigating) }
  }, [context.view, path, search])
  return null
}

/** Real Link props are decorated before rendering, including SSR/new tabs and prefetch. */
export default function PreviewLink({ href, onNavigate, ...props }: ComponentProps<typeof NextLink>) {
  const context = useContext(PreviewContext)
  const target = typeof href === 'string' ? previewHref(href, context.view, context.origin, context.siteOrigin, context.path) : href
  return <NextLink {...props} href={target} onNavigate={e => {
    let prevented = false
    onNavigate?.({ preventDefault: () => { prevented = true; e.preventDefault() } })
    if (context.view && !prevented && typeof target === 'string' && previewNavigationChangesPage(target, window.location.href)) send({ type: 'navigating', href: new URL(target, window.location.href).href })
  }} />
}
