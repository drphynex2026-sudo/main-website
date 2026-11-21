import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ view: 'guest', path: '/ko/products', search: new URLSearchParams('lp=guest'), effect: undefined as undefined | (() => (() => void)), marks: false }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useContext: () => ({ view: state.view }), useEffect: (effect: () => (() => void)) => { state.effect = effect } }))
vi.mock('next/navigation', () => ({ usePathname: () => state.path, useSearchParams: () => state.search }))
import PreviewLink, { PreviewReporter } from '@/components/preview/PreviewNavigation'
let listeners: Map<string, (e?: unknown) => void>
let post: ReturnType<typeof vi.fn>
beforeEach(() => {
  state.view = 'guest'; state.path = '/ko/products'; state.search = new URLSearchParams('lp=guest'); state.marks = false
  listeners = new Map(); post = vi.fn()
  vi.stubGlobal('window', { location: { origin: 'https://example.com', href: 'https://example.com/ko/products?lp=guest' }, parent: { postMessage: post }, addEventListener: (type: string, fn: (e?: unknown) => void) => listeners.set(type, fn), removeEventListener: (type: string) => listeners.delete(type) })
  vi.stubGlobal('document', { querySelector: () => state.marks ? {} : null })
})
it('reports non-product routes and reports again after soft navigation or a mode change', () => {
  PreviewReporter(); let cleanup = state.effect!()
  expect(post.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'ready', view: 'guest', href: 'https://example.com/ko/products?lp=guest', staffMarks: false })
  cleanup(); expect(listeners.size).toBe(0)
  state.path = '/ko/brand'; window.location.href = 'https://example.com/ko/brand?lp=guest'
  PreviewReporter(); cleanup = state.effect!()
  expect(post.mock.calls.at(-1)?.[0]).toMatchObject({ view: 'guest', href: window.location.href })
  cleanup(); state.view = 'staff'; state.search = new URLSearchParams('lp=staff'); window.location.href = 'https://example.com/ko/brand?lp=staff'
  PreviewReporter(); cleanup = state.effect!()
  expect(post.mock.calls.at(-1)?.[0]).toMatchObject({ view: 'staff', href: window.location.href })
  cleanup()
})
it('uses structural staff markers, responds only to its same-origin parent, and invalidates back navigation', () => {
  state.marks = true; PreviewReporter(); const cleanup = state.effect!()
  expect(post.mock.calls.at(-1)?.[0].staffMarks).toBe(true)
  const count = post.mock.calls.length
  listeners.get('message')!({ source: {}, origin: window.location.origin, data: { source: 'dx-lp-builder', type: 'report' } })
  expect(post).toHaveBeenCalledTimes(count)
  listeners.get('message')!({ source: window.parent, origin: window.location.origin, data: { source: 'dx-lp-builder', type: 'report' } })
  expect(post).toHaveBeenCalledTimes(count + 1)
  window.location.href = 'https://example.com/ko/brand?lp=guest'
  listeners.get('popstate')!()
  expect(post.mock.calls.at(-1)?.[0].type).toBe('navigating')
  cleanup(); vi.unstubAllGlobals()
})
it.each(['https://example.com/ko/products?lp=guest', '#main'])('same URL/hash Link does not invalidate or prevent native navigation: %s', href => {
  const preventDefault = vi.fn()
  const link = PreviewLink({ href, children: 'Go' })
  link.props.onNavigate({ preventDefault })
  expect(post).not.toHaveBeenCalled()
  expect(preventDefault).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})
it('real route changes invalidate, while hash events acknowledge without waiting for a new page', () => {
  const link = PreviewLink({ href: '/ko/brand', children: 'Go' })
  link.props.onNavigate({ preventDefault: vi.fn() })
  expect(post.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'navigating', href: 'https://example.com/ko/brand?lp=guest' })
  PreviewReporter(); const cleanup = state.effect!()
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Updates the in-memory location fake, not a browser.
  window.location.href += '#main'
  listeners.get('hashchange')!()
  expect(post.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'ready', href: window.location.href })
  listeners.get('popstate')!()
  expect(post.mock.calls.at(-1)?.[0].type).toBe('ready')
  cleanup(); expect(listeners.size).toBe(0); vi.unstubAllGlobals()
})
