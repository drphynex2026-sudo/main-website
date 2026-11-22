import 'server-only'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { isStaffUser, isEditorUser } from '@/access/roles'
import { locales, type Locale } from '@/i18n/locales'
import { permissionAllowed, pageNumber, snapshot, type Doc, type Read, type Source, type LocaleReads, type DocumentSnapshot } from './dashboard-snapshot'

export async function safeRead<T>(fn: () => Promise<T>): Promise<Read<T>> {
  try { return { kind: 'ok', value: await fn() } } catch (error) {
    return { kind: error && typeof error === 'object' && 'status' in error && error.status === 403 ? 'denied' : 'error' }
  }
}
export const PAGE_SIZE = 20
export type DashboardData = { products: DocumentSnapshot[]; home: DocumentSnapshot | null; inventory: Read<{ total: number; pages: number; page: number }>; productsAllowed: boolean; homeAllowed: boolean; observedAt: string }
export async function readDashboard(payload: Payload, user: User | null, permissions: unknown, requestedPage: unknown): Promise<DashboardData> {
  const p = permissions as { collections?: Record<string, { read?: unknown }>; globals?: Record<string, { read?: unknown }> }
  const productsAllowed = isStaffUser(user) && permissionAllowed(p?.collections?.products?.read)
  const homeAllowed = isStaffUser(user) && permissionAllowed(p?.globals?.['home-page']?.read)
  const data: DashboardData = { products: [], home: null, inventory: { kind: 'denied' }, productsAllowed, homeAllowed, observedAt: new Date().toISOString() }
  // Never forward the dashboard request or auth cookie to the guest read.
  const base = (locale: Locale, staff: boolean, draft: boolean) => ({ locale, fallbackLocale: false as const, overrideAccess: false, draft, ...(staff ? { user } : {}), context: { skipApprovalState: true } })
  async function sources(kind: 'products' | 'home', id?: string): Promise<Source> {
    const read = async (locale: Locale, staff: boolean, draft: boolean): Promise<Read<Doc | null>> => safeRead(async () => {
      if (kind === 'home') return await payload.findGlobal({ slug: 'home-page', ...base(locale, staff, draft), depth: 1 }) as unknown as Doc
      const result = await payload.find({ collection: 'products', ...base(locale, staff, draft), depth: draft ? 2 : 0, where: { id: { equals: id } }, limit: 1 })
      return result.docs[0] as unknown as Doc ?? null
    })
    const all = async (staff: boolean, draft: boolean) => Object.fromEntries(await Promise.all(locales.map(async l => [l, await read(l, staff, draft)]))) as LocaleReads
    const [draft, main, guest] = await Promise.all([all(true, true), all(true, false), all(false, false)])
    return { draft, main, guest }
  }
  if (productsAllowed) {
    const count = await safeRead(() => payload.count({ collection: 'products', locale: 'ko', user, overrideAccess: false }))
    if (count.kind !== 'ok') data.inventory = count
    else {
      const pages = Math.max(1, Math.ceil(count.value.totalDocs / PAGE_SIZE)), page = Math.min(pageNumber(requestedPage), pages)
      data.inventory = { kind: 'ok', value: { total: count.value.totalDocs, pages, page } }
      const list = await safeRead(() => payload.find({ collection: 'products', locale: 'ko', fallbackLocale: false, draft: true, user, overrideAccess: false, limit: PAGE_SIZE, page, sort: ['slug', 'id'], depth: 0 }))
      if (list.kind !== 'ok') data.inventory = list
      else for (const item of list.value.docs) {
        const id = String(item.id), source = await sources('products', id)
        const name = locales.map(l => source.draft[l]).find(r => r.kind === 'ok' && typeof r.value?.name === 'string')
        const title = name?.kind === 'ok' ? String(name.value?.name) : `Sản phẩm #${id}`
        data.products.push(snapshot('products', id, title, source, isEditorUser(user)))
      }
    }
  }
  if (homeAllowed) data.home = snapshot('home', 'home-page', 'Trang chủ', await sources('home'), isEditorUser(user))
  return data
}
