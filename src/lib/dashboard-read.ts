import 'server-only'
import { withDashboardDiagnostics, traceDashboardProjection } from './dashboard-diagnostics'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { isStaffUser, isEditorUser } from '@/access/roles'
import { locales, type Locale } from '@/i18n/locales'
import {
  permissionAllowed,
  pageNumber,
  snapshot,
  type Doc,
  type Read,
  type Source,
  type DocumentSnapshot,
} from './dashboard-snapshot'

export async function safeRead<T>(fn: () => Promise<T>): Promise<Read<T>> {
  try {
    return { kind: 'ok', value: await fn() }
  } catch (error) {
    return {
      kind:
        error && typeof error === 'object' && 'status' in error && error.status === 403
          ? 'denied'
          : 'error',
    }
  }
}
/** Bound page-level reads, rather than fanning out nine finds per Product.
 * Measured against the deployed pool limit of three. Relation reads still obey
 * Payload access and may issue additional queries; this does not change the pool.
 */
export const DASHBOARD_READ_CONCURRENCY = 3
export async function mapDashboardReads<T, R>(
  items: readonly T[],
  map: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0,
    failed = false,
    failure: unknown
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++
      try {
        results[index] = await map(items[index], index)
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
        }
      }
    }
  }
  // Drain in-flight work before reporting an aggregate error.
  await Promise.all(
    Array.from({ length: Math.min(DASHBOARD_READ_CONCURRENCY, items.length) }, worker),
  )
  if (failed) throw failure
  return results
}
export const PAGE_SIZE = 20
export type DashboardData = {
  products: DocumentSnapshot[]
  home: DocumentSnapshot | null
  inventory: Read<{ total: number; pages: number; page: number }>
  productsAllowed: boolean
  homeAllowed: boolean
  observedAt: string
}
async function readDashboardSources(
  payload: Payload,
  user: User | null,
  permissions: unknown,
  requestedPage: unknown,
): Promise<DashboardData> {
  const p = permissions as {
    collections?: Record<string, { read?: unknown }>
    globals?: Record<string, { read?: unknown }>
  }
  const productsAllowed = isStaffUser(user) && permissionAllowed(p?.collections?.products?.read)
  const homeAllowed = isStaffUser(user) && permissionAllowed(p?.globals?.['home-page']?.read)
  const data: DashboardData = {
    products: [],
    home: null,
    inventory: { kind: 'denied' },
    productsAllowed,
    homeAllowed,
    observedAt: new Date().toISOString(),
  }
  // Never forward the dashboard request or auth cookie to the guest read.
  const base = (locale: Locale, staff: boolean, draft: boolean) => ({
    locale,
    fallbackLocale: false as const,
    overrideAccess: false,
    draft,
    ...(staff ? { user } : {}),
    context: { skipApprovalState: true },
  })
  const requests = (['draft', 'main', 'guest'] as const).flatMap((kind) =>
    locales.map((locale) => ({ kind, locale, staff: kind !== 'guest', draft: kind === 'draft' })),
  )
  async function productSources(ids: string[]): Promise<Map<string, Source>> {
    const reads = await mapDashboardReads(requests, async (request) => ({
      ...request,
      read: await safeRead(async () => {
        // Batch ONLY the current page. Separate Local API calls preserve staff/guest,
        // locale, field ACL, draft/main and population semantics. No shared request/cache.
        const result = await payload.find({
          collection: 'products',
          ...base(request.locale, request.staff, request.draft),
          depth: request.draft ? 2 : 0,
          where: { id: { in: ids } },
          limit: ids.length,
          pagination: false,
        })
        return new Map(result.docs.map((doc) => [String(doc.id), doc as unknown as Doc]))
      }),
    }))
    return new Map(
      ids.map((id) => {
        const source = { draft: {}, main: {}, guest: {} } as Source
        for (const { kind, locale, read } of reads)
          source[kind][locale] =
            read.kind === 'ok' ? { kind: 'ok', value: read.value.get(id) ?? null } : read
        return [id, source]
      }),
    )
  }
  async function homeSources(): Promise<Source> {
    const source = { draft: {}, main: {}, guest: {} } as Source
    const reads = await mapDashboardReads(requests, async (request) => ({
      ...request,
      read: await safeRead(
        async () =>
          (await payload.findGlobal({
            slug: 'home-page',
            ...base(request.locale, request.staff, request.draft),
            depth: 1,
          })) as unknown as Doc,
      ),
    }))
    for (const { kind, locale, read } of reads) source[kind][locale] = read
    return source
  }
  if (productsAllowed) {
    const count = await safeRead(() =>
      payload.count({ collection: 'products', locale: 'ko', user, overrideAccess: false }),
    )
    if (count.kind !== 'ok') data.inventory = count
    else {
      const pages = Math.max(1, Math.ceil(count.value.totalDocs / PAGE_SIZE)),
        page = Math.min(pageNumber(requestedPage), pages)
      data.inventory = { kind: 'ok', value: { total: count.value.totalDocs, pages, page } }
      const list = await safeRead(() =>
        payload.find({
          collection: 'products',
          locale: 'ko',
          fallbackLocale: false,
          draft: true,
          user,
          overrideAccess: false,
          limit: PAGE_SIZE,
          page,
          sort: ['slug', 'id'],
          depth: 0,
        }),
      )
      if (list.kind !== 'ok') data.inventory = list
      else if (list.value.docs.length) {
        const sources = await productSources(list.value.docs.map((item) => String(item.id)))
        data.products = list.value.docs.map((item) => {
          const id = String(item.id),
            source = sources.get(id)!
          const name = locales
            .map((l) => source.draft[l])
            .find((r) => r.kind === 'ok' && typeof r.value?.name === 'string')
          const title = name?.kind === 'ok' ? String(name.value?.name) : `Sản phẩm #${id}`
          return traceDashboardProjection(() =>
            snapshot('products', id, title, source, isEditorUser(user)),
          )
        })
      }
    }
  }
  if (homeAllowed) {
    const sources = await homeSources()
    data.home = traceDashboardProjection(() =>
      snapshot('home', 'home-page', 'Trang chủ', sources, isEditorUser(user)),
    )
  }
  return data
}

export async function readDashboard(
  payload: Payload,
  user: User | null,
  permissions: unknown,
  requestedPage: unknown,
): Promise<DashboardData> {
  return withDashboardDiagnostics(payload, (measured) =>
    readDashboardSources(measured, user, permissions, requestedPage),
  )
}
