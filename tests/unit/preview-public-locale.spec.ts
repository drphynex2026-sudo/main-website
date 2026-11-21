import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ count: vi.fn(), user: { id: 1, role: 'admin' }, view: 'guest' }))
vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-dx-preview-view': mocks.view }) }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('@/lib/preview', () => ({ getPreviewUser: async () => mocks.user }))
vi.mock('@/lib/content-client', () => ({ getPayloadClient: async () => ({ count: mocks.count }) }))
import { approvedLocalesFor } from '@/lib/content'
import { Pending } from '@/components/ui/Pending'
beforeEach(() => { mocks.view = 'guest'; mocks.count.mockReset().mockImplementation(async ({ locale }: { locale: string }) => ({ totalDocs: locale === 'ko' ? 1 : 0 })) })
it('guest language availability is based on anonymous public counts even for signed-in staff', async () => {
  expect(await approvedLocalesFor('products', 'mx-02-luma', true)).toEqual(['ko'])
  expect(mocks.count).toHaveBeenCalledTimes(3)
  for (const [args] of mocks.count.mock.calls) {
    expect(args.overrideAccess).toBe(false)
    expect(args.user).toBeUndefined()
    expect(args.where).toEqual({ slug: { equals: 'mx-02-luma' } })
  }
})
it('ordinary staff preview keeps all locale options', async () => {
  expect(await approvedLocalesFor('products', 'mx-02-luma')).toEqual(['ko', 'en', 'vi'])
  expect(mocks.count).not.toHaveBeenCalled()
})
it('does not render localized preview placeholders inside guest original-draft simulation', async () => {
  expect(await Pending({ label: 'heroImage' })).toBeNull()
})
it('retains structural preview markers for staff', async () => {
  mocks.view = 'staff'
  expect((await Pending({ label: 'heroImage' }))?.props['data-preview-staff-mark']).toBe(true)
})
