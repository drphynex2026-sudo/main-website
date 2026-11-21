import { isValidElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ staff: true, mode: 'guest' }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-dx-preview-view': state.mode }) }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('@/lib/preview', () => ({ getPreviewStaffUser: async () => state.staff ? { id: 1, role: 'admin' } : null }))
vi.mock('@/lib/content', () => ({ findGuestGlobal: async () => null, findPublicGlobal: async () => null }))
vi.mock('@/lib/analytics/config', () => ({ trackingConfig: () => ({ enabled: false }) }))
import { PageShell } from '@/components/layout/PageShell'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

function nodes(tree: ReactNode): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!isValidElement<Record<string, unknown>>(tree)) return []
  return [{ type: tree.type, props: tree.props }, ...nodes(tree.props.children as ReactNode)]
}
beforeEach(() => { state.staff = true; state.mode = 'guest' })

it.each(['ko', 'en', 'vi'] as const)('actual shell menu/footer and language links retain guest mode (%s)', async (locale) => {
  const tree = nodes(await PageShell({ locale, path: '/products/mx-02-luma', search: '?topic=care', children: null, guestView: true }))
  const links = tree.filter(n => typeof n.props.href === 'string').map(n => n.props.href as string)
  for (const path of ['mx-01-forma', 'mx-02-luma', 'rx-matrix-balm', 'rx-matrix-sheet']) expect(links).toContain(`/${locale}/products/${path}?lp=guest`)
  expect(links).toContain(`/${locale}/brand?lp=guest`)
  expect(links).toContain(`/${locale}/contact?lp=guest`)
  expect(tree.some(n => n.props.role === 'note')).toBe(false)
  const switcher = tree.find(n => n.type === LanguageSwitcher)!
  const language = nodes(await LanguageSwitcher(switcher.props as Parameters<typeof LanguageSwitcher>[0]))
  for (const target of ['ko', 'en', 'vi'].filter(l => l !== locale)) expect(language.map(n => n.props.href)).toContain(`/${target}/products/mx-02-luma?topic=care&lp=guest`)
})
it('does not add a mode for an anonymous request', async () => {
  state.staff = false
  const tree = nodes(await PageShell({ locale: 'ko', path: '/brand', children: null }))
  expect(tree.some(n => typeof n.props.href === 'string' && n.props.href.includes('lp='))).toBe(false)
})
