import { describe, expect, it } from 'vitest'
import { publishOnlyRequestedLocale, publishOnlyRequestedGlobalLocale } from '@/hooks/publishLocale'

describe('whole-document unpublish safety in locale workflow', () => {
  for (const [kind, hook] of [
    ['collection', publishOnlyRequestedLocale],
    ['global', publishOnlyRequestedGlobalLocale],
  ] as const) {
    it.each(['ko', 'en', 'vi'])(
      `${kind}: refuses implicit whole-document unpublish in %s`,
      (locale) => {
        const data = { _status: 'draft' }
        const req = {
          locale,
          payloadAPI: 'REST',
          searchParams: new URLSearchParams({ locale }),
          context: {},
        }
        expect(() => hook({ operation: 'update', args: { data }, req } as never)).toThrow(
          /ẩn cả các ngôn ngữ khác/,
        )
        expect(data).toEqual({ _status: 'draft' })
        expect(req.context).toEqual({})
      },
    )
    it(`${kind}: the real Admin all-locale Unpublish gets the specific safety message`, () => {
      const args = { unpublishAllLocales: true, data: { _status: 'draft' } }
      const req = {
        locale: 'all',
        payloadAPI: 'REST',
        searchParams: new URLSearchParams({ unpublishAllLocales: 'true' }),
        context: {},
      }
      expect(() => hook({ operation: 'update', args, req } as never)).toThrow(
        /Giao diện thu hồi riêng từng ngôn ngữ chưa được triển khai/,
      )
      expect(req.context).toEqual({})
    })
    it(`${kind}: still accepts an ordinary Save Draft`, () => {
      const args = { draft: true, data: { _status: 'draft' } }
      const req = {
        locale: 'vi',
        payloadAPI: 'REST',
        searchParams: new URLSearchParams({ locale: 'vi' }),
        context: {} as Record<string, unknown>,
      }
      expect(hook({ operation: 'update', args, req } as never)).toBe(args)
      expect(req.context.reviewSavingDraft).toBe(true)
    })
  }
})
