import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { beforeAll, afterAll, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { getPayload, handleEndpoints, APIError, type Payload } from 'payload'
import type { User } from '@/payload-types'
import config from '@/payload.config'
import { withContentLocaleGuard } from '@/lib/content-mutations'
import { readApprovalState } from '@/lib/approval-basis'
import { readApprovals } from '@/lib/banner-revision'
import { publishOnlyRequestedLocale } from '@/hooks/publishLocale'
const locs = ['ko', 'en', 'vi'] as const
type L = (typeof locs)[number]
let raw: Payload, p: Payload
const users = {} as Record<'admin' | 'editor' | 'translator', User>
const tokens: Record<string, string | undefined> = {}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
let originalProducts: string
beforeAll(async () => {
  const u = new URL(process.env.DATABASE_URL!)
  if (
    u.hostname !== '127.0.0.1' ||
    u.port !== '55497' ||
    u.pathname !== '/drphynex_independent_review_test'
  )
    throw Error('Wrong disposable endpoint')
  await client.connect()
  const {
    rows: [r],
  } = await client.query(
    "SELECT current_database() name,current_user role,host(inet_server_addr()) addr,shobj_description(oid,'pg_database') marker,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) super FROM pg_database WHERE datname=current_database()",
  )
  expect(r).toMatchObject({
    name: 'drphynex_independent_review_test',
    role: 'workflow_test',
    addr: '172.22.0.2',
    marker: 'drphynex-independent-review-disposable-v1',
    super: false,
  })
  originalProducts = (
    await client.query(
      'SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY id)::text) hash FROM products p WHERE id IN (2,3,4,5)',
    )
  ).rows[0].hash
  raw = await getPayload({ config })
  p = withContentLocaleGuard(raw)
  const pass = randomBytes(24).toString('hex')
  for (const role of ['admin', 'editor', 'translator'] as const) {
    users[role] = await p.create({
      collection: 'users',
      data: { email: `workflow-${role}-${Date.now()}@test.invalid`, password: pass, role },
      ...(role === 'admin'
        ? { overrideAccess: true }
        : { overrideAccess: false, user: users.admin }),
    })
    tokens[role] = (
      await p.login({ collection: 'users', data: { email: users[role].email, password: pass } })
    ).token
  }
})
afterAll(async () => {
  if (raw) {
    const h = (
      await client.query(
        'SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY id)::text) hash FROM products p WHERE id IN (2,3,4,5)',
      )
    ).rows[0].hash
    expect(h).toBe(originalProducts)
    await raw.destroy()
  }
  await client.end()
})
async function rest(path: string, data: Record<string, unknown>, role: string, method = 'PATCH') {
  const r = await handleEndpoints({
    config,
    request: new Request('http://localhost:3057/api/' + path, {
      method,
      headers: { Authorization: 'JWT ' + tokens[role], 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  })
  const body = await r.json()
  return { status: r.status, body }
}
const pick = (value: unknown, field: string) => {
  const d = value as Record<string, unknown> | null
  return d ? { text: d[field], seo: d.seo, translationStatus: d.translationStatus } : null
}
it('limits the hook to the registered localized content workflow', async () => {
  for (const slug of [
    'media',
    'source-documents',
    'users',
    'contact-submissions',
    'partner-inquiries',
  ]) {
    const collection = raw.collections[slug as keyof typeof raw.collections].config
    expect(collection.hooks.beforeOperation).not.toContain(publishOnlyRequestedLocale)
  }
  expect(raw.collections.products.config.hooks.beforeOperation).toContain(
    publishOnlyRequestedLocale,
  )
  for (const global of raw.globals.config) {
    expect(global.hooks.beforeOperation).toContain(publishOnlyRequestedLocale)
  }
})
it('deliberately refuses document-wide Unpublish even with only EN public; Save Draft remains usable', async () => {
  const doc = await p.create({
    collection: 'products',
    locale: 'en',
    draft: true,
    user: users.admin,
    overrideAccess: false,
    data: { name: 'SINGLE EN PUBLIC', slug: 'workflow-single-' + Date.now() },
  })
  const options = {
    collection: 'products' as const,
    id: doc.id,
    locale: 'en' as const,
    user: users.admin,
    overrideAccess: false,
  }
  await p.update({ ...options, draft: true, data: { translationStatus: 'approved' } })
  await p.update({ ...options, data: { _status: 'published' } })
  const publicRead = async (locale: L) =>
    (
      await p.find({
        collection: 'products',
        locale,
        fallbackLocale: false,
        depth: 0,
        draft: false,
        overrideAccess: false,
        where: { id: { equals: doc.id } },
      })
    ).docs
  expect(await publicRead('ko')).toEqual([])
  expect(await publicRead('vi')).toEqual([])
  expect(
    (await rest('products/' + doc.id + '?locale=en', { _status: 'draft' }, 'admin')).status,
  ).toBe(409)
  expect((await publicRead('en'))[0].name).toBe('SINGLE EN PUBLIC')
  await p.update({ ...options, draft: true, data: { name: 'SINGLE EN DRAFT' } })
  expect((await publicRead('en'))[0].name).toBe('SINGLE EN PUBLIC')
  expect((await p.findByID({ ...options, draft: true })).name).toBe('SINGLE EN DRAFT')
})
for (const kind of ['product', 'brand'] as const)
  for (const role of ['admin', 'editor'] as const) {
    let id: number, path: string, field: string
    const read = async (l: L, draft = true) =>
      kind === 'product'
        ? await p.findByID({
            collection: 'products',
            id,
            locale: l,
            draft,
            depth: 0,
            fallbackLocale: false,
            user: users[role],
            overrideAccess: false,
          })
        : await p.findGlobal({
            slug: 'brand-page',
            locale: l,
            draft,
            depth: 0,
            fallbackLocale: false,
            user: users[role],
            overrideAccess: false,
          })
    const guest = async (l: L) => {
      if (kind === 'product')
        return (
          await p.find({
            collection: 'products',
            where: { id: { equals: id } },
            locale: l,
            draft: false,
            depth: 0,
            fallbackLocale: false,
            overrideAccess: false,
          })
        ).docs[0]
      try {
        const d = await p.findGlobal({
          slug: 'brand-page',
          locale: l,
          draft: false,
          depth: 0,
          fallbackLocale: false,
          overrideAccess: false,
        })
        return Object.keys(d).length === 0 ? null : d
      } catch (e) {
        if (e instanceof APIError && (e.status === 403 || e.status === 404)) return null
        throw e
      }
    }
    const save = async (l: L, data: Record<string, unknown>, draft = true) =>
      kind === 'product'
        ? await p.update({
            collection: 'products',
            id,
            locale: l,
            draft,
            data: data as never,
            user: users[role],
            overrideAccess: false,
          })
        : await p.updateGlobal({
            slug: 'brand-page',
            locale: l,
            draft,
            data: data as never,
            user: users[role],
            overrideAccess: false,
          })
    it(`${kind}/${role}: establish three public fixture locales on restored copy`, async () => {
      field = kind === 'product' ? 'name' : 'title'
      if (kind === 'product')
        id = (
          await p.create({
            collection: 'products',
            locale: 'en',
            draft: true,
            user: users[role],
            overrideAccess: false,
            data: { name: 'workflow initial', slug: 'workflow-' + role + '-' + Date.now() },
          })
        ).id
      path = kind === 'product' ? 'products/' + id : 'globals/brand-page'
      for (const l of locs) {
        await save(l, { [field]: `PUBLIC ${kind} ${role} ${l}`, seo: { title: `PUBLIC SEO ${l}` } })
        await save(l, { translationStatus: 'approved' })
        await save(l, { _status: 'published' }, false)
        expect((await guest(l))?.[field as never]).toBe(`PUBLIC ${kind} ${role} ${l}`)
      }
    })
    for (const l of locs)
      it(`${kind}/${role}/${l}: pending full-form publish refused, approve separately, publish, withdraw, refuse document-wide unpublish`, async () => {
        const other = locs.filter((x) => x !== l)
        const before = Object.fromEntries(
          await Promise.all(locs.map(async (x) => [x, pick(await guest(x), field)])),
        )
        const otherDraft = Object.fromEntries(
          await Promise.all(other.map(async (x) => [x, pick(await read(x), field)])),
        )
        await save(l, {
          [field]: `PRIVATE ${kind} ${role} ${l}`,
          seo: { title: `PRIVATE SEO ${l}` },
          translationStatus: 'approved',
        })
        const draft = await read(l)
        expect(draft.translationStatus).toBe('in-review')
        const full = JSON.parse(JSON.stringify(draft))
        full._status = 'published'
        const reject = await rest(
          path + '?locale=' + l,
          full,
          role,
          kind === 'product' ? 'PATCH' : 'POST',
        )
        expect(reject.status).toBe(409)
        expect(pick(await read(l), field)).toEqual(pick(draft, field))
        for (const x of locs) expect(pick(await guest(x), field)).toEqual(before[x])
        expect(
          (
            await rest(
              path + '?locale=' + l + '&draft=true',
              { translationStatus: 'approved' },
              role,
              kind === 'product' ? 'PATCH' : 'POST',
            )
          ).status,
        ).toBe(200)
        const approved = await read(l)
        expect(approved.translationStatus).toBe('approved')
        expect(
          (
            await rest(
              path + '?locale=' + l,
              { ...approved, _status: 'published' },
              role,
              kind === 'product' ? 'PATCH' : 'POST',
            )
          ).status,
        ).toBe(200)
        expect(pick(await guest(l), field)).toMatchObject({
          text: `PRIVATE ${kind} ${role} ${l}`,
          seo: { title: `PRIVATE SEO ${l}` },
        })
        for (const x of other) {
          expect(pick(await guest(x), field)).toEqual(before[x])
          expect(pick(await read(x), field)).toEqual(otherDraft[x])
        }
        const withdrawal = {
          ...(await read(l)),
          translationStatus: 'in-review',
          _status: 'published',
        }
        expect(
          (
            await rest(
              path + '?locale=' + l,
              withdrawal,
              'translator',
              kind === 'product' ? 'PATCH' : 'POST',
            )
          ).status,
        ).toBe(403)
        expect(
          (
            await rest(
              path + '?locale=' + l,
              withdrawal,
              role,
              kind === 'product' ? 'PATCH' : 'POST',
            )
          ).status,
        ).toBe(200)
        expect(await guest(l)).toBeFalsy()
        for (const x of other) expect(pick(await guest(x), field)).toEqual(before[x])
        await save(l, { translationStatus: 'approved' })
        await save(l, { _status: 'published' }, false)
        const publicBeforeUnpublish = pick(await guest(l), field),
          draftBeforeUnpublish = pick(await read(l), field)
        const unpublish = await rest(
          path + '?locale=' + l,
          { _status: 'draft' },
          role,
          kind === 'product' ? 'PATCH' : 'POST',
        )
        expect(unpublish.status).toBe(409)
        expect(unpublish.body.errors[0].message).toMatch(/ẩn cả các ngôn ngữ khác/)
        const nativeAdminUnpublish = await rest(
          path + '?depth=0&fallback-locale=null&unpublishAllLocales=true',
          { _status: 'draft' },
          role,
          kind === 'product' ? 'PATCH' : 'POST',
        )
        expect(nativeAdminUnpublish.status).toBe(409)
        expect(nativeAdminUnpublish.body.errors[0].message).toMatch(
          /Giao diện thu hồi riêng từng ngôn ngữ chưa được triển khai/,
        )
        await expect(save(l, { _status: 'draft' }, false)).rejects.toThrow(
          /ẩn cả các ngôn ngữ khác/,
        )
        expect(pick(await guest(l), field)).toEqual(publicBeforeUnpublish)
        expect(pick(await read(l), field)).toEqual(draftBeforeUnpublish)
        for (const x of other) expect(pick(await guest(x), field)).toEqual(before[x])
      })
  }
const home = (data: Record<string, unknown>, user: User, context: Record<string, unknown> = {}) =>
  p.updateGlobal({
    slug: 'home-page',
    locale: 'vi',
    draft: true,
    data: data as never,
    user,
    overrideAccess: false,
    context,
  })
const homeRead = () =>
  p.findGlobal({
    slug: 'home-page',
    locale: 'vi',
    draft: true,
    depth: 0,
    user: users.editor,
    overrideAccess: false,
  })
const pendingLock = async () => {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const r = await client.query(
      "SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND NOT granted",
    )
    if (r.rows[0].n > 0) return
    await new Promise((r) => setTimeout(r, 20))
  }
  throw Error('Second writer did not queue before deadline')
}
it('two sessions: content first, stale approval second is refused', async () => {
  await home({ banners: { forma: { title: 'COPY race base' } } }, users.admin)
  const basis = (await readApprovalState(raw, 'vi')).basis
  let contender: Promise<unknown> | undefined
  await home({ banners: { forma: { title: 'COPY race changed' } } }, users.admin, {
    afterHomePageLock: async () => {
      contender = home({ translationStatus: 'approved' }, users.editor, {
        approvalBasis: basis,
      }).then(
        () => ({ ok: true }),
        (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }),
      )
      await pendingLock()
    },
  })
  expect(await contender).toMatchObject({
    error: expect.stringMatching(/thay đổi kể từ lúc bạn mở trang/),
  })
  const d = await homeRead()
  expect(d.banners.forma.title).toBe('COPY race changed')
  expect(d.translationStatus).toBe('in-review')
  expect(readApprovals(d.bannerApprovals).vi).toBeUndefined()
})
it('two sessions: approval first, content second revokes old approval', async () => {
  await home({ banners: { forma: { title: 'COPY race 2 base' } } }, users.editor)
  const basis = (await readApprovalState(raw, 'vi')).basis
  let contender: Promise<unknown> | undefined
  await home({ translationStatus: 'approved' }, users.admin, {
    approvalBasis: basis,
    afterHomePageLock: async () => {
      contender = home({ banners: { forma: { title: 'COPY race 2 changed' } } }, users.editor)
      contender.catch(() => {})
      await pendingLock()
    },
  })
  await contender
  const d = await homeRead()
  expect(d.banners.forma.title).toBe('COPY race 2 changed')
  expect(d.translationStatus).toBe('in-review')
  expect(readApprovals(d.bannerApprovals).vi).toBeUndefined()
})
