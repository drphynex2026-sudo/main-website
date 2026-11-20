import { describe, expect, it } from 'vitest'
import { APIError } from 'payload'
import { bulkUnpublishError } from '@/hooks/bulkUnpublishError'
import { publishOnlyRequestedLocale } from '@/hooks/publishLocale'

const message =
  'Không thể bỏ xuất bản toàn tài liệu: thao tác này sẽ ẩn cả các ngôn ngữ khác. Nội dung công khai được giữ nguyên. Bạn vẫn có thể dùng Lưu bản nháp. Giao diện thu hồi riêng từng ngôn ngữ chưa được triển khai.'
const input = () => ({
  collection: { slug: 'products' },
  context: {},
  error: new APIError(message, 409, null, true),
  req: {
    payloadAPI: 'REST',
    method: 'PATCH',
    routeParams: { collection: 'products' },
    query: { where: { and: [{ _status: { not_equals: 'draft' } }, { id: { in: [10, 11] } }] } },
    data: { _status: 'draft' },
  },
  result: { errors: [{ message }] },
})
const run = async (args: ReturnType<typeof input>) => await bulkUnpublishError(args as never)
describe('bulk Unpublish error response compatibility', () => {
  it('keeps the real guard message, unchanged error/status, and truthfully reports zero docs', async () => {
    const args = input(),
      before = JSON.stringify(args)
    const result = await run(args)
    expect(result).toEqual({ response: { errors: [{ message }], docs: [] } })
    expect(result).not.toHaveProperty('status')
    expect(args.error.status).toBe(409)
    expect(JSON.stringify(args)).toBe(before)
    // The parser expression in Payload UnpublishMany/DrawerContent must no longer throw.
    expect(() => {
      const json = result!.response as { docs: unknown[] }
      return json?.docs.length || 0
    }).not.toThrow()
    expect(result!.response!.errors![0].message).toBe(message)
  })
  it('tracks the existing guard text without changing the guard', () => {
    try {
      publishOnlyRequestedLocale({
        operation: 'update',
        args: { data: { _status: 'draft' } },
        req: { context: {} },
      } as never)
      throw Error('Guard did not reject')
    } catch (error) {
      expect(error).toBeInstanceOf(APIError)
      expect((error as APIError).message).toBe(message)
    }
  })
  it.each([
    [
      'single document',
      (a: ReturnType<typeof input>): unknown => Object.assign(a.req.routeParams, { id: '10' }),
    ],
    ['Local API', (a: ReturnType<typeof input>): unknown => (a.req.payloadAPI = 'local')],
    ['global', (a: ReturnType<typeof input>): unknown => (a.req.method = 'POST')],
    ['no where', (a: ReturnType<typeof input>): unknown => (a.req.query.where = null as never)],
    [
      'malformed where',
      (a: ReturnType<typeof input>): unknown => (a.req.query.where = [] as never),
    ],
    [
      'different collection',
      (a: ReturnType<typeof input>): unknown => (a.req.routeParams.collection = 'media'),
    ],
    ['not Unpublish', (a: ReturnType<typeof input>): unknown => (a.req.data._status = 'published')],
    ['other status', (a: ReturnType<typeof input>): unknown => (a.error.status = 403)],
    ['private error', (a: ReturnType<typeof input>): unknown => (a.error.isPublic = false)],
    [
      'other error',
      (a: ReturnType<typeof input>): unknown => (a.error.message = 'private details'),
    ],
    [
      'sanitized response',
      (a: ReturnType<typeof input>): unknown =>
        (a.result.errors[0].message = 'Something went wrong.'),
    ],
    [
      'existing bulk result',
      (a: ReturnType<typeof input>): unknown => Object.assign(a.result, { docs: [{ id: 10 }] }),
    ],
  ] as const)('leaves %s untouched', async (_name, change) => {
    const args = input()
    change(args)
    const before = JSON.stringify(args)
    expect(await run(args)).toBeUndefined()
    expect(JSON.stringify(args)).toBe(before)
  })
})
