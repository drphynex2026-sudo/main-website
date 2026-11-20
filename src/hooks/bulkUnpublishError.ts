import { APIError, type CollectionAfterErrorHook } from 'payload'

// Match only the existing public guard refusal, not other bulk errors or partial writes.
// Kept separate so the publication guard and its transaction behavior stay unchanged.
const guardMessage =
  'Không thể bỏ xuất bản toàn tài liệu: thao tác này sẽ ẩn cả các ngôn ngữ khác. Nội dung công khai được giữ nguyên. Bạn vẫn có thể dùng Lưu bản nháp. Giao diện thu hồi riêng từng ngôn ngữ chưa được triển khai.'

/** Payload Admin reads docs.length before errors. Zero docs is truthful for this pre-write refusal. */
export const bulkUnpublishError: CollectionAfterErrorHook = ({
  collection,
  error,
  req,
  result,
}) => {
  if (
    req.payloadAPI !== 'REST' ||
    req.method !== 'PATCH' ||
    req.routeParams?.collection !== collection.slug ||
    req.routeParams?.id != null ||
    !req.query?.where ||
    typeof req.query.where !== 'object' ||
    Array.isArray(req.query.where) ||
    req.data?._status !== 'draft' ||
    !(error instanceof APIError) ||
    !error.isPublic ||
    error.status !== 409 ||
    error.message !== guardMessage ||
    !result?.errors?.some((entry) => entry.message === guardMessage) ||
    'docs' in result
  )
    return

  // Preserve Payload's sanitized errors and HTTP status; never claim a successful update.
  return { response: { ...result, docs: [] } }
}
