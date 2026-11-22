import { locales, type Locale } from '@/i18n/locales'
import { sharedRevision, readApprovals, bannersApprovedFor } from '@/lib/banner-revision'
import { landingRevision, EMPTY_LANDING_REVISION } from '@/lib/landing-approval'
import { blockIssues, type ProductProvides } from '@/lib/landing'

export type Doc = Record<string, unknown>
export type Read<T> = { kind: 'ok'; value: T } | { kind: 'denied' } | { kind: 'error' }
export type LocaleReads = Record<Locale, Read<Doc | null>>
export type Source = { draft: LocaleReads; main: LocaleReads; guest: LocaleReads }
export type Reason = 'CONTENT' | 'SHARED' | 'DEPENDENCY' | 'DATA' | 'DISPLAY'
export type Cell = { locale: Locale; href: string; publicLabel: string; contentLabel: string; sharedLabel: string; reason: Reason | null; missing: { locale: Locale; href: string }[]; warnings: string[]; instruction: string }
export type DocumentSnapshot = { id: string; title: string; cells: Cell[] }
export const permissionAllowed = (p: unknown) => p === true || (!!p && typeof p === 'object' && 'permission' in p && p.permission === true)
export const pageNumber = (v: unknown) => typeof v === 'string' && /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v)) ? Number(v) : 1
export const documentHref = (kind: 'products' | 'home', id: string, locale: Locale) => kind === 'home' ? `/admin/globals/home-page?locale=${locale}` : `/admin/collections/products/${encodeURIComponent(id)}?locale=${locale}`
const own = (d: Doc, k: string) => Object.prototype.hasOwnProperty.call(d, k)
const object = (v: unknown): Doc | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Doc : null
const statuses: Record<string, string> = { 'ai-draft': 'Bản nháp AI', 'in-review': 'Đang xem xét', approved: 'Đã duyệt bản nháp' }
function readLabel(read: Read<Doc | null>, home: boolean, locale: Locale) {
  if (read.kind === 'denied') return 'Bị từ chối đọc bản công khai; cần kiểm tra cấu hình'
  if (read.kind === 'error') return 'Chưa xác định bản công khai'
  const doc = read.value
  if (home) return doc?.translationStatus === 'approved' && bannersApprovedFor(doc, locale) ? 'Đang dùng banner CMS' : 'Đang dùng banner mặc định'
  return doc ? 'Khách đọc được bản hiện tại' : 'Không có bản đọc được cho khách'
}
/** null/id/unpopulated never proves absence. No private URLs leave this projection. */
export function mediaState(v: unknown): 'public' | 'private' | 'unknown' {
  const m = object(v)
  if (!m || !own(m, 'id') || typeof m.url !== 'string' || !m.url || typeof m.publicRelease !== 'boolean') return 'unknown'
  return m.publicRelease ? 'public' : 'private'
}
export function displayWarnings(doc: Doc, home: boolean): string[] {
  const warnings = new Set<string>()
  const inspect = (value: unknown, label: string) => {
    const state = mediaState(value)
    if (state === 'unknown') warnings.add(`${label}: chưa xác minh ảnh/quan hệ (chưa phân giải hoặc không đủ dữ liệu).`)
    if (state === 'private') warnings.add(`${label}: ảnh chưa công khai; chỉ là cảnh báo hiển thị.`)
    return state
  }
  if (home) {
    const banners = object(doc.banners)
    if (!banners) return ['Chưa đủ dữ liệu để kiểm tra ảnh banner.']
    for (const [slot, value] of Object.entries(banners)) {
      const b = object(value)
      if (!b) continue
      if (b.visualType === 'brandOptics') continue
      for (const field of ['desktopImage', 'mobileImage', 'localeDesktopImage', 'localeMobileImage']) {
        // Optional empty fields are not proof of a missing required visual; do not claim hidden.
        if (b[field] != null) inspect(b[field], `Banner ${slot}`)
      }
    }
    return [...warnings]
  }
  if (Array.isArray(doc.images)) doc.images.forEach(v => inspect(v, 'Ảnh sản phẩm'))
  if (!Array.isArray(doc.landing)) return ['Chưa đủ dữ liệu để kiểm tra khối landing.']
  const provides: ProductProvides = { image: false, packSize: false, inci: false, howToUse: false, cautions: false, keyIngredients: false }
  doc.landing.forEach((v, index) => {
    const b = object(v)
    if (!b || b.hidden === true) return
    const label = `Khối ${index + 1}`
    if (b.blockType === 'ingredients' || b.blockType === 'details') { warnings.add(`${label}: chưa xác minh nội dung/quan hệ theo quyền khách.`); return }
    let known = true
    for (const field of ['image', 'mobileImage']) {
      if (own(b, field) && b[field] != null) known = inspect(b[field], label) !== 'unknown' && known
    }
    // Only the required desktop image with full provenance can prove band/split omission.
    if (b.blockType === 'band' || b.blockType === 'split') known = mediaState(b.image) !== 'unknown' && known
    if (b.blockType === 'split') known = known && own(b, 'heading') && own(b, 'body')
    if (b.blockType === 'points' || b.blockType === 'faq') {
      const keys = b.blockType === 'points' ? ['title'] : ['question', 'answer']
      known = Array.isArray(b.items) && b.items.every(r => { const item = object(r); return !!item && keys.every(k => own(item, k)) })
    }
    if (!known) { warnings.add(`${label}: chưa đủ dữ liệu để kết luận khối có hiển thị với khách.`); return }
    const issues = blockIssues(b, provides, value => mediaState(value) === 'public')
    if (issues.required.length) warnings.add(`${label}: khách không thấy khối vì thiếu ${issues.required.join(', ')} (không phải chặn xuất bản).`)
  })
  return [...warnings]
}

/** Read-only prediction, not a promise that a later mutation will pass validation. */
export function snapshot(kind: 'products' | 'home', id: string, title: string, source: Source, canPublish: boolean): DocumentSnapshot {
  const home = kind === 'home'
  const field = home ? 'banners' : 'landing'
  const mapField = home ? 'bannerApprovals' : 'landingApprovals'
  const revision = (doc: Doc) => home ? sharedRevision(doc.banners as never) : landingRevision(doc.landing)
  return { id, title, cells: locales.map(locale => {
    const dr = source.draft[locale], mr = source.main[locale], gr = source.guest[locale]
    const doc = dr.kind === 'ok' ? dr.value : null
    const status = typeof doc?.translationStatus === 'string' ? doc.translationStatus : ''
    const complete = !!doc && own(doc, field) && own(doc, mapField)
    const mainKnown = mr.kind === 'ok' && (mr.value === null || Object.keys(mr.value).length === 0 || own(mr.value, field))
    // A successful absent main matches the guards' null/{} behavior; it is not a failed read.
    const main = mr.kind === 'ok' ? mr.value : null
    const rev = complete ? revision(doc!) : null
    const mainRev = main && own(main, field) ? revision(main) : home ? sharedRevision(undefined) : EMPTY_LANDING_REVISION
    const notApplicable = !home && complete && mainKnown && rev === EMPTY_LANDING_REVISION && mainRev === EMPTY_LANDING_REVISION
    const approval = complete ? readApprovals(doc![mapField])[locale] === rev : null
    let sharedLabel = notApplicable ? 'Không áp dụng landing' : !complete ? 'Chưa xác định duyệt cấu trúc' : status !== 'approved' ? 'Đi cùng lần duyệt nội dung' : approval ? 'Đã duyệt cấu trúc hiện tại' : 'Chưa có duyệt khớp cấu trúc hiện tại'
    let reason: Reason | null = null
    const missing: Cell['missing'] = []
    const warnings = doc ? displayWarnings(doc, home) : []
    if (!statuses[status] || !complete || !mainKnown) reason = 'DATA'
    else if (status !== 'approved') reason = 'CONTENT'
    else if (!notApplicable && !approval) reason = 'SHARED'
    else if (!notApplicable && rev !== mainRev && (home ? !!main : main?._status === 'published')) {
      for (const other of locales) {
        if (other === locale) continue
        const otherMain = source.main[other]
        if (otherMain.kind !== 'ok') { reason = 'DATA'; continue }
        if (otherMain.value && !own(otherMain.value, 'translationStatus') && Object.keys(otherMain.value).length) { reason = 'DATA'; continue }
        if (otherMain.value?.translationStatus === 'approved' && readApprovals(doc![mapField])[other] !== rev) missing.push({ locale: other, href: documentHref(kind, id, other) })
      }
      if (reason !== 'DATA' && missing.length) reason = 'DEPENDENCY'
    }
    if (status !== 'approved' && approval && !notApplicable) { reason = 'DATA'; sharedLabel = 'Trạng thái duyệt chưa nhất quán; cần kiểm tra' }
    if (gr.kind !== 'ok') warnings.push(gr.kind === 'denied' ? 'Bị từ chối đọc bản công khai; cần kiểm tra cấu hình.' : 'Nguồn công khai đang lỗi; chưa kiểm đủ điều kiện.')
    if (!reason && warnings.length) reason = 'DISPLAY'
    return { locale, href: documentHref(kind, id, locale), publicLabel: readLabel(gr, home, locale), contentLabel: dr.kind === 'denied' ? 'Không có quyền đọc bản nháp' : statuses[status] ?? 'Chưa đọc được trạng thái duyệt', sharedLabel, reason, missing, warnings,
      instruction: !canPublish ? 'Bạn được soạn bản nháp theo quyền của mình; cần editor/admin duyệt và xuất bản.' : home ? 'Mở Banner trang chủ, lưu nháp và duyệt bằng panel Duyệt cấu hình; xuất bản riêng từng ngôn ngữ.' : 'Mở tab Landing page; xem lại, lưu nháp Approved trong lần riêng không sửa nội dung, rồi xuất bản đúng ngôn ngữ.' }
  }) }
}
export function taskCounts(docs: DocumentSnapshot[]) {
  const cells = docs.flatMap(d => d.cells).filter(c => c.reason)
  return { total: cells.length, review: cells.filter(c => ['CONTENT', 'SHARED', 'DEPENDENCY'].includes(c.reason!)).length, warning: cells.filter(c => c.reason === 'DATA' || c.reason === 'DISPLAY').length }
}
