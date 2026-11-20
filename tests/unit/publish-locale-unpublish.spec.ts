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
        locale: 'ko',
        payloadAPI: 'REST',
        searchParams: new URLSearchParams({ unpublishAllLocales: 'true' }),
        context: {},
      }
      expect(() => hook({ operation: 'update', args, req } as never)).toThrow(
        /Giao diện thu hồi riêng từng ngôn ngữ chưa được triển khai/,
      )
      expect(req.context).toEqual({})
    })
    it.each([true, 'true'])(
      `${kind}: refuses explicit all-locale unpublish with draft=true (%s)`,
      (flag) => {
        const args = { draft: true, unpublishAllLocales: flag, data: {} }
        const req = {
          locale: 'en',
          payloadAPI: 'REST',
          searchParams: new URLSearchParams({
            locale: 'en',
            draft: 'true',
            unpublishAllLocales: 'true',
          }),
          context: {},
        }
        expect(() => hook({ operation: 'update', args, req } as never)).toThrow(
          /ẩn cả các ngôn ngữ khác/,
        )
        expect(args.data).toEqual({})
        expect(req.context).toEqual({})
      },
    )
    it(`${kind}: rejects the all-locale edge case before locale validation`, () => {
      const req = {
        locale: 'all',
        payloadAPI: 'REST',
        searchParams: new URLSearchParams({ locale: 'all' }),
        context: {},
      }
      expect(() =>
        hook({
          operation: 'update',
          args: { unpublishAllLocales: true, data: { _status: 'draft' } },
          req,
        } as never),
      ).toThrow(/ẩn cả các ngôn ngữ khác/)
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
