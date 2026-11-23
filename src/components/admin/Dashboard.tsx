import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import Link from 'next/link'

import { localeLabels } from '@/i18n/locales'
import { readDashboard, type DashboardData } from '@/lib/dashboard-read'
import { permissionAllowed, taskCounts, type Cell, type DocumentSnapshot } from '@/lib/dashboard-snapshot'

/**
 * Admin start page (Vietnamese). Everything shown is read from the CMS with the signed-in user's
 * own permissions: shortcuts only for what that role may open, banner status from the stored Home
 * Page draft. Nothing here is a placeholder figure; what is not wired shows an empty state.
 */
const roleName: Record<string, string> = {
  admin: 'Quản trị viên',
  editor: 'Biên tập viên',
  translator: 'Biên dịch viên',
}
const shortcuts = [
  { href: '/admin/globals/home-page', label: 'Banner trang chủ', note: '5 banner, duyệt từng ngôn ngữ', kind: 'globals', slug: 'home-page' },
  { href: '/admin/collections/products', label: 'Sản phẩm', note: 'Nội dung và thành phần', kind: 'collections', slug: 'products' },
  { href: '/admin/collections/media', label: 'Thư viện media', note: 'Ảnh và quyền công khai', kind: 'collections', slug: 'media' },
  { href: '/admin/collections/articles', label: 'Bài viết tạp chí', note: 'Soạn và duyệt bài', kind: 'collections', slug: 'articles' },
  { href: '/admin/collections/stores', label: 'Điểm bán', note: 'Cửa hàng và nhà phân phối', kind: 'collections', slug: 'stores' },
  { href: '/admin/collections/contact-submissions', label: 'Tin nhắn liên hệ', note: 'Chỉ quản trị viên', kind: 'collections', slug: 'contact-submissions' },
  { href: '/admin/collections/partner-inquiries', label: 'Yêu cầu hợp tác B2B', note: 'Chỉ quản trị viên', kind: 'collections', slug: 'partner-inquiries' },
] as const


const reasonLabels = { CONTENT: 'Cần xem xét nội dung', SHARED: 'Cần duyệt cấu trúc hiện tại', DEPENDENCY: 'Cần ngôn ngữ khác duyệt cấu trúc', DATA: 'Chưa kiểm đủ dữ liệu', DISPLAY: 'Cảnh báo hiển thị' }
const filters = ['all', 'review', 'warning'] as const
function taskMatches(cell: Cell, filter: string) {
  if (!cell.reason) return false
  return filter === 'all' || (filter === 'review' ? ['CONTENT', 'SHARED', 'DEPENDENCY'].includes(cell.reason) : ['DATA', 'DISPLAY'].includes(cell.reason))
}
function DocumentState({ doc }: { doc: DocumentSnapshot }) {
  return <article className="dx-dash-document"><h3>{doc.title}</h3><div className="dx-dash-locales">{doc.cells.map(cell => <div key={cell.locale} className="dx-dash-locale" data-locale={cell.locale}>
    <h4>{localeLabels[cell.locale]}</h4><dl><dt>Công khai</dt><dd>{cell.publicLabel}</dd><dt>Nội dung bản nháp</dt><dd>{cell.contentLabel}</dd><dt>Duyệt cấu trúc bản nháp</dt><dd>{cell.sharedLabel}</dd></dl>
    <p>{cell.reason ? reasonLabels[cell.reason] : 'Chưa phát hiện điều kiện chặn trong snapshot'}</p>
    <Link href={cell.href}>Mở {doc.title} · {cell.locale.toUpperCase()}</Link>
  </div>)}</div></article>
}
function Tasks({ docs, filter = 'all' }: { docs: DocumentSnapshot[]; filter?: string }) {
  const tasks = docs.flatMap(doc => doc.cells.filter(cell => taskMatches(cell, filter)).map(cell => ({ doc, cell })))
  if (!tasks.length) return <p>Không có việc khớp bộ lọc trong phạm vi này.</p>
  return <ul className="dx-dash-tasks">{tasks.map(({ doc, cell }) => <li key={`${doc.id}:${cell.locale}`}>
    <strong>{doc.title} · {cell.locale.toUpperCase()} — {reasonLabels[cell.reason!]}</strong>
    <p>{cell.reason === 'DATA' || cell.reason === 'DISPLAY' ? 'Mở tài liệu để kiểm tra dữ liệu hoặc hiển thị. Cảnh báo không tự yêu cầu duyệt lại.' : cell.instruction}</p>
    {cell.missing.length > 0 && <p>Ngôn ngữ cần duyệt: {cell.missing.map((missing, index) => <span key={missing.locale}>{index > 0 ? ' · ' : ''}<Link href={missing.href}>Mở {doc.title} · {missing.locale.toUpperCase()}</Link></span>)}</p>}
    {cell.warnings.length > 0 && <ul>{cell.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
    <Link href={cell.href}>Mở {doc.title} · {cell.locale.toUpperCase()}</Link>
  </li>)}</ul>
}
export async function Dashboard({ initPageResult, payload, searchParams }: AdminViewServerProps) {
  const { req, permissions } = initPageResult
  const user = req.user as { email?: string; name?: string | null; role?: string } | null
  const params = searchParams as Record<string, unknown> | undefined
  const filter = typeof params?.work === 'string' && filters.includes(params.work as typeof filters[number]) ? params.work : 'all'
  const open = shortcuts.filter(s => permissionAllowed((permissions as unknown as Record<string, Record<string, { read?: unknown }>>)?.[s.kind]?.[s.slug]?.read))
  let work: { data: DashboardData; counts: ReturnType<typeof taskCounts>; homeCounts: ReturnType<typeof taskCounts> } | null = null
  try {
    const data = await readDashboard(payload, req.user, permissions, params?.page)
    work = { data, counts: taskCounts(data.products), homeCounts: taskCounts(data.home ? [data.home] : []) }
  } catch {
    // An aggregate/projection failure must not remove the permitted shortcuts,
    // fabricate zero work, or expose the exception to the UI.
    work = null
  }
  const data = work?.data
  const counts = work?.counts
  const homeCounts = work?.homeCounts
  const inventory = data?.inventory.kind === 'ok' ? data.inventory.value : null
  return <Gutter><div className="dx-dash">
    <header className="dx-dash__head"><h1>Bảng điều khiển</h1><p>Xin chào <strong>{user?.name || user?.email}</strong>{user?.role ? ` · ${roleName[user.role] ?? user.role}` : ''}</p></header>
    <p className="dx-dash-notice">Chỉ đọc: mở tài liệu để xử lý. Đây là snapshot lúc {data?.observedAt ?? 'chưa xác định'}; không bảo đảm lần xuất bản sau sẽ được chấp nhận. Không suy thay đổi chưa xuất bản từ trạng thái bản nháp.</p>
    {user?.role === 'translator' && <p className="dx-dash-notice">Bạn có thể soạn bản nháp theo quyền của mình; không có quyền duyệt hoặc xuất bản.</p>}
    {!data || !counts || !homeCounts ? <p role="alert">Chưa đọc được bảng việc. Hãy tải lại.</p> : <>
    <section aria-labelledby="dx-home-title"><h2 id="dx-home-title">Trang chủ · tính riêng</h2>{!data.homeAllowed ? <p>Không có quyền đọc Trang chủ.</p> : data.home ? <>
      <DocumentState doc={data.home} /><p>{homeCounts.total} cặp tài liệu/ngôn ngữ có việc ở Trang chủ. Không cộng vào Sản phẩm.</p><details><summary>Việc Trang chủ</summary><Tasks docs={[data.home]} /></details>
    </> : <p>Chưa đọc được Trang chủ.</p>}</section>
    <section aria-labelledby="dx-products-title"><h2 id="dx-products-title">Sản phẩm</h2>{!data.productsAllowed ? <p>Không có quyền đọc Sản phẩm.</p> : !inventory ? <p>{data.inventory.kind === 'denied' ? 'Bị từ chối đọc danh sách Sản phẩm.' : 'Chưa đọc được danh sách Sản phẩm. Hãy tải lại trang.'}</p> : <>
      <p>Trang {inventory.page}/{inventory.pages} · {data.products.length}/{inventory.total} sản phẩm. Số đếm việc chỉ tính Sản phẩm trên trang này, không phải toàn website.</p>
      <nav aria-label="Phân trang Sản phẩm" className="dx-dash-pages">{inventory.page > 1 && <Link href={`/admin?page=${inventory.page - 1}&work=${filter}`}>Trang trước</Link>}<span aria-current="page">Trang {inventory.page}</span>{inventory.page < inventory.pages && <Link href={`/admin?page=${inventory.page + 1}&work=${filter}`}>Trang sau</Link>}</nav>
      <h3>Việc cần xử lý · trang hiện tại</h3><p>{counts.total} cặp có việc: {counts.review} cần xem xét, {counts.warning} chỉ cảnh báo/chưa xác định. Không gồm Trang chủ hoặc trang khác.</p>
      <form action="/admin" method="get" className="dx-dash-filter"><input type="hidden" name="page" value={inventory.page} /><label htmlFor="dx-work">Lọc việc trong trang</label><select id="dx-work" name="work" defaultValue={filter}><option value="all">Tất cả việc</option><option value="review">Cần xem xét/duyệt</option><option value="warning">Cảnh báo/chưa xác định</option></select><button type="submit">Lọc</button></form>
      <Tasks docs={data.products} filter={filter} />
      <details open><summary>Trạng thái Sản phẩm · KO/EN/VI</summary>{data.products.length ? data.products.map(doc => <DocumentState key={doc.id} doc={doc} />) : <p>Chưa có Sản phẩm trong phạm vi được đọc.</p>}</details>
    </>}</section>
    </>}
    <section aria-labelledby="dx-links-title"><h2 id="dx-links-title">Lối tắt</h2>{open.length ? <ul className="dx-dash__cards">{open.map(s => <li key={s.href}><Link href={s.href}><strong>{s.label}</strong><span>{s.note}</span></Link></li>)}</ul> : <p>Tài khoản chưa có quyền truy cập mục nào.</p>}</section>
  </div></Gutter>
}
