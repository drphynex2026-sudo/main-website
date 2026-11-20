import {
  APIError,
  type CollectionBeforeOperationHook,
  type GlobalBeforeOperationHook,
} from 'payload'
import { isLocale } from '@/i18n/locales'

/** Never let Payload sanitize an invalid REST locale into the default language. */
export const publishOnlyRequestedLocale: CollectionBeforeOperationHook = ({
  args,
  operation,
  req,
}) => {
  if (operation === 'create' || operation === 'update') {
    const options = args as unknown as Record<string, unknown>
    const savingDraft = options.draft === true || options.draft === 'true'
    const status = (options.data as Record<string, unknown> | undefined)?._status
    // Payload's Unpublish changes the shared document status, even when
    // publishSpecificLocale is set. Refuse this whole-document operation in a
    // locale-scoped workflow: it would also hide valid publications in KO/EN/VI.
    // Explicit unpublish must also be refused with draft=true: Payload passes
    // this flag through to saveVersion and can overwrite the latest version.
    // REST parses the query into a boolean; Local API forwards the option.
    const unpublishAllLocales =
      options.unpublishAllLocales === true || options.unpublishAllLocales === 'true'
    // Ordinary Save Draft remains supported. There is no dedicated locale
    // withdrawal UI yet; do not suggest a manual API workaround to operators.
    if (operation === 'update' && (unpublishAllLocales || (!savingDraft && status === 'draft'))) {
      throw new APIError(
        'Không thể bỏ xuất bản toàn tài liệu: thao tác này sẽ ẩn cả các ngôn ngữ khác. Nội dung công khai được giữ nguyên. Bạn vẫn có thể dùng Lưu bản nháp. Giao diện thu hồi riêng từng ngôn ngữ chưa được triển khai.',
        409,
        null,
        true,
      )
    }
    const rawLocale = req.searchParams?.get('locale') ?? req.query?.locale
    // REST: compare with the locale written on the request itself. For globals Payload has already
    // replaced req.locale with publishSpecificLocale before any hook runs, so a "?locale=vi" request
    // asking to publish KO would otherwise go through. Local API callers are checked by
    // lib/content-mutations.ts before Payload is called.
    const restLocaleMismatch =
      req.payloadAPI === 'REST' &&
      options.publishSpecificLocale != null &&
      options.publishSpecificLocale !== rawLocale
    if (
      (rawLocale != null && !isLocale(rawLocale)) ||
      !isLocale(req.locale) ||
      (options.publishSpecificLocale != null && options.publishSpecificLocale !== req.locale) ||
      restLocaleMismatch ||
      options.publishAllLocales === true ||
      options.publishAllLocales === 'true'
    ) {
      throw new APIError(
        'Hãy chọn đúng một ngôn ngữ hợp lệ (ko, en hoặc vi); không cho xuất bản tất cả ngôn ngữ cùng lúc.',
        400,
        null,
        true,
      )
    }
    // "Save as draft" that also asks to publish: Payload would publish (its own draft flag
    // yields to `_status: 'published'`), while every guard here would treat it as a draft save
    // and skip the approval checks. Refused before anything is written; the Admin never sends it
    // (Publish has no draft flag, Save draft sends `_status: 'draft'`).
    if (savingDraft && status === 'published') {
      throw new APIError(
        'Yêu cầu mâu thuẫn: lưu bản nháp (draft=true) không được kèm trạng thái "published". Lưu nháp hoặc xuất bản riêng từng ngôn ngữ.',
        400,
        null,
        true,
      )
    }
    req.context.reviewSavingDraft = savingDraft
    req.context.reviewApprovalIntent = (
      options.data as Record<string, unknown> | undefined
    )?.translationStatus
    req.fallbackLocale = false
    // Publishing only ever applies to the requested language. A draft save publishes nothing, so
    // it does not use Payload's single-locale publish path: that path also stores a "snapshot"
    // version as the latest draft carrying the document's OLD updatedAt, which made the Admin
    // report every edit after a save as "modified by another user". A publishSpecificLocale sent
    // with a draft (already checked above to match the request) is therefore dropped as well.
    if (savingDraft) delete options.publishSpecificLocale
    else options.publishSpecificLocale = req.locale
    options.publishAllLocales = false
  }
  return args
}
export const publishOnlyRequestedGlobalLocale =
  publishOnlyRequestedLocale as unknown as GlobalBeforeOperationHook
