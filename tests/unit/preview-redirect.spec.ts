import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ redirect: vi.fn((url: string) => { throw Error('REDIRECT:' + url) }), find: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, permanentRedirect: mocks.redirect }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key, getFormatter: async () => ({ dateTime: () => '' }) }))
vi.mock('@/lib/locale', () => ({ pageLocale: async (params: Promise<{locale: string}>) => (await params).locale, firstParam: (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v }))
vi.mock('@/lib/content', () => ({ findPublic: mocks.find, populated: () => null, findPublicBySlug: async (collection: string) => collection === 'technologies' ? { slug: 'fixture' } : null }))
vi.mock('@/lib/preview', () => ({ getPreviewUser: async () => null, getPreviewStaffUser: async () => null }))
vi.mock('@/components/layout/PageShell', () => ({ PageShell: () => null }))
vi.mock('@/components/ingredient/DetailPage', () => ({ detailMetadata: () => ({}), IngredientDetail: () => null }))
import JournalPage from '@/app/(frontend)/[locale]/journal/page'
import IngredientPage from '@/app/(frontend)/[locale]/ingredients/[slug]/page'
import { previewDestinationMatches, previewRedirectHref } from '@/lib/preview-navigation'

beforeEach(() => {
  mocks.redirect.mockClear()
  mocks.find.mockReset().mockImplementation(async (collection: string, locale: string) => collection === 'journal-topics'
    ? { docs: locale === 'ko' ? [{ id: 1, slug: 'fixture-topic', name: 'Topic' }] : [] }
    : { docs: [], totalDocs: 2, totalPages: 1 })
})
it('actual Journal page clamp retains guest/origin', async () => {
  await expect(JournalPage({ params: Promise.resolve({ locale: 'ko' }), searchParams: Promise.resolve({ page: '999', topic: 'fixture-topic', lp: 'guest', lpOrigin: 'fixture-root' }) })).rejects.toThrow('REDIRECT:/ko/journal?topic=fixture-topic&lp=guest&lpOrigin=fixture-root')
})
it('actual Journal topic removal in the destination locale retains guest/origin', async () => {
  await expect(JournalPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({ topic: 'fixture-topic', lp: 'guest', lpOrigin: 'fixture-root' }) })).rejects.toThrow('REDIRECT:/en/journal?lp=guest&lpOrigin=fixture-root')
})
it('actual legacy Technology alias retains preview context', async () => {
  await expect(IngredientPage({ params: Promise.resolve({ locale: 'vi', slug: 'fixture' }), searchParams: Promise.resolve({ lp: 'staff', lpOrigin: 'fixture-root' }) })).rejects.toThrow('REDIRECT:/vi/technologies/fixture?lp=staff&lpOrigin=fixture-root')
})
it('redirect helper drops invalid/array context and arbitrary incoming query values', () => {
  expect(previewRedirectHref('/ko/journal', { lp: 'all', lpOrigin: 'root' })).toBe('/ko/journal')
  expect(previewRedirectHref('/ko/journal', { lp: ['guest'], lpOrigin: 'root' })).toBe('/ko/journal')
  for (const lpOrigin of ['../root', 'UPPER', 'x'.repeat(81), ['root']]) expect(previewRedirectHref('/ko/journal', { lp: 'guest', lpOrigin })).toBe('/ko/journal?lp=guest')
  expect(previewRedirectHref('/ko/journal', { lp: 'guest', lpOrigin: 'root', injected: 'never-forward' })).toBe('/ko/journal?lp=guest&lpOrigin=root')
})
it('acknowledges only the known normalizations without losing the preview identity guard', () => {
  const from = 'https://example.com/ko/journal?topic=topic-a&page=999&lp=guest&lpOrigin=root'
  for (const suffix of ['?topic=topic-a&lp=guest&lpOrigin=root', '?lp=guest&lpOrigin=root', '?topic=topic-a&page=2&lp=guest&lpOrigin=root']) expect(previewDestinationMatches(from, 'https://example.com/ko/journal'+suffix)).toBe(true)
  for (const suffix of ['?topic=other&lp=guest&lpOrigin=root', '?lp=staff&lpOrigin=root', '?lp=guest&lpOrigin=other', '?lp=guest', '?page=1000&lp=guest&lpOrigin=root']) expect(previewDestinationMatches(from, 'https://example.com/ko/journal'+suffix)).toBe(false)
  expect(previewDestinationMatches(from, 'https://example.com/en/journal?lp=guest&lpOrigin=root')).toBe(false)
  expect(previewDestinationMatches(from, 'https://external.invalid/ko/journal?lp=guest&lpOrigin=root')).toBe(false)
  expect(previewDestinationMatches('https://example.com/ko/ingredients/x?lp=guest&lpOrigin=root', 'https://example.com/ko/technologies/x?lp=guest&lpOrigin=root')).toBe(true)
  expect(previewDestinationMatches(from, from+'#main')).toBe(true)
})
