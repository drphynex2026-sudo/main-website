/* eslint-disable @typescript-eslint/no-explicit-any -- Payload test double, no network/database. */
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { readDashboard } from '@/lib/dashboard-read'
import { taskCounts } from '@/lib/dashboard-snapshot'
const permissions = { collections: { products: { read: true } } }
const editor = { id: 1, role: 'editor' }
const doc = (id: number) => ({
  id,
  name: `Fixture ${id}`,
  translationStatus: 'in-review',
  landing: [],
  landingApprovals: {},
  images: [],
})
function fixture(size = 20) {
  const calls: any[] = []
  const payload = {
    count: vi.fn(async () => ({ totalDocs: 43 })),
    find: vi.fn(async (options: any) => {
      calls.push(options)
      return {
        docs: !options.where
          ? Array.from({ length: size }, (_, i) => doc(21 + i))
          : options.where.id.in
            ? [...options.where.id.in].reverse().map((id: string) => doc(Number(id)))
            : [doc(Number(options.where.id.equals))],
      }
    }),
  }
  return { payload, calls }
}
describe('page batching preserves access boundaries and incomplete reads', () => {
  it('reads only the current 20 IDs; no request/user/context is shared into guest reads', async () => {
    const { payload, calls } = fixture()
    const data = await readDashboard(payload as never, editor as never, permissions, '2')
    expect(data.inventory).toEqual({ kind: 'ok', value: { page: 2, pages: 3, total: 43 } })
    expect(data.products.map((x) => x.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => String(i + 21)),
    )
    expect(taskCounts(data.products).total).toBe(60)
    const sources = calls.filter((x) => x.where)
    expect(sources).toHaveLength(9)
    for (const options of sources) {
      expect(options.where.id.in).toEqual(data.products.map((x) => x.id))
      expect(options).toMatchObject({
        overrideAccess: false,
        fallbackLocale: false,
        limit: 20,
        pagination: false,
      })
      expect(options.req).toBeUndefined()
      expect(options.context).toEqual({ skipApprovalState: true })
    }
    const guest = sources.filter((x) => !x.user)
    expect(guest).toHaveLength(3)
    expect(guest.map((x) => x.locale)).toEqual(['ko', 'en', 'vi'])
    expect(guest.every((x) => x.draft === false && x.depth === 0)).toBe(true)
    expect(new Set(sources.map((x) => x.context)).size).toBe(9)
    expect(sources.filter((x) => x.draft).every((x) => x.user === editor && x.depth === 2)).toBe(
      true,
    )
  })
  it('keeps absent guest rows distinct from denied/error; a batch error remains unknown', async () => {
    const { payload } = fixture(2)
    payload.find.mockImplementation(async (options: any) => {
      if (!options.where) return { docs: [doc(21), doc(22)] }
      if (options.locale === 'en' && options.draft) throw Error('SECRET_TEST_SENTINEL')
      if (!options.user && options.locale === 'vi')
        throw Object.assign(Error('SECRET_TEST_SENTINEL'), { status: 403 })
      if (!options.user) return { docs: [] }
      return { docs: [doc(21), doc(22)] }
    })
    const data = await readDashboard(payload as never, editor as never, permissions, '1')
    for (const product of data.products) {
      expect(product.cells[0].publicLabel).toBe('Không có bản đọc được cho khách')
      expect(product.cells[1]).toMatchObject({
        contentLabel: 'Chưa đọc được trạng thái duyệt',
        reason: 'DATA',
      })
      expect(product.cells[2].publicLabel).toContain('Bị từ chối')
    }
    expect(JSON.stringify(data)).not.toContain('SECRET_TEST_SENTINEL')
  })
  it('does not batch an empty page or reuse results between users', async () => {
    const { payload, calls } = fixture(0)
    await readDashboard(payload as never, editor as never, permissions, '1')
    expect(calls).toHaveLength(1)
    await readDashboard(payload as never, { role: 'translator' } as never, permissions, '1')
    expect(calls).toHaveLength(2)
    expect(calls[1].user.role).toBe('translator')
  })
})
