/* eslint-disable @typescript-eslint/no-explicit-any -- owned disposable fixtures and pool measurement. */
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { getPayload, type Payload } from 'payload'
import { performance } from 'node:perf_hooks'
import { randomBytes, createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import config from '@/payload.config'
import { migrations } from '@/migrations'
import { readDashboard } from '@/lib/dashboard-read'
// Generated from the pinned baseline by the launcher, removed on completion.
// @ts-expect-error generated only during the disposable benchmark
import { readDashboard as baseline } from '../helpers/__dashboard-baseline'
import * as projection from '@/lib/dashboard-snapshot'
import { profileDashboard } from '../helpers/dashboard-profile'
import { assertDisposableDatabase } from '../helpers/database'
import { homeApprovalContext } from '../helpers/home-approval'
let p: Payload, admin: any, editor: any, translator: any
beforeAll(async () => {
  const cfg = await config
  // Match the deployed pool limit without VERCEL (which would require real storage).
  p = await getPayload({ config: cfg })
  await assertDisposableDatabase(p)
  ;(p.db as any).pool.options.max = 3
  await p.db.migrate({ migrations: migrations as any })
  admin = await p.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: 'admin@benchmark.invalid',
      password: process.env.TEST_FIXTURE_PASSWORD || randomBytes(24).toString('hex'),
      role: 'admin',
    },
  })
  editor = await p.create({
    collection: 'users',
    overrideAccess: false,
    user: admin,
    data: {
      email: 'editor@benchmark.invalid',
      password: randomBytes(24).toString('hex'),
      role: 'editor',
    },
  })
  translator = await p.create({
    collection: 'users',
    overrideAccess: false,
    user: admin,
    data: {
      email: 'translator@benchmark.invalid',
      password: randomBytes(24).toString('hex'),
      role: 'translator',
    },
  })
  for (let n = 0; n < 4; n++) {
    const product = await p.create({
      collection: 'products',
      user: editor,
      overrideAccess: false,
      locale: 'ko',
      draft: true,
      data: {
        name: `Fixture ${n} KO`,
        slug: `benchmark-${n}`,
        landing: [{ blockType: 'hero', tagline: 'Neutral fixture' }],
        translationStatus: 'in-review',
      },
    })
    for (const locale of ['en', 'vi'] as const)
      await p.update({
        collection: 'products',
        id: product.id,
        user: editor,
        overrideAccess: false,
        locale,
        draft: true,
        data: { name: `Fixture ${n} ${locale}` },
      })
    if (n === 0) {
      await p.update({
        collection: 'products',
        id: product.id,
        user: editor,
        overrideAccess: false,
        locale: 'ko',
        draft: true,
        data: { translationStatus: 'approved' },
      })
      await p.update({
        collection: 'products',
        id: product.id,
        user: editor,
        overrideAccess: false,
        locale: 'ko',
        data: { _status: 'published' },
      })
      await p.update({
        collection: 'products',
        id: product.id,
        user: editor,
        overrideAccess: false,
        locale: 'ko',
        draft: true,
        data: { shortDescription: 'Changed draft' },
      })
    }
  }
  for (const locale of ['ko', 'en', 'vi'] as const) {
    await p.updateGlobal({
      slug: 'home-page',
      user: editor,
      overrideAccess: false,
      locale,
      draft: true,
      data: { headline: `Fixture ${locale}`, translationStatus: 'in-review' },
    })
    await p.updateGlobal({
      slug: 'home-page',
      user: editor,
      overrideAccess: false,
      locale,
      draft: true,
      data: { translationStatus: 'approved' },
      context: await homeApprovalContext(p, locale),
    })
    await p.updateGlobal({
      slug: 'home-page',
      user: editor,
      overrideAccess: false,
      locale,
      data: { _status: 'published' },
    })
  }
})
afterAll(async () => {
  await p?.destroy()
})
it('compares pinned baseline and candidate on identical data/pool and preserves every projected cell for all roles', async () => {
  const permissions = {
    collections: { products: { read: true } },
    globals: { 'home-page': { read: true } },
  }
  const samples: any[] = []
  const actualSnapshot = projection.snapshot
  let projectionMs = 0
  const spy = vi.spyOn(projection, 'snapshot').mockImplementation((...args) => {
    const start = performance.now()
    try {
      return actualSnapshot(...args)
    } finally {
      projectionMs += performance.now() - start
    }
  })
  const clean = (value: any) => {
    const { observedAt: _, ...rest } = value
    return rest
  }
  try {
    for (const [role, user] of Object.entries({ admin, editor, translator })) {
      let expected: any
      // Alternate order to reduce warmed-cache bias; first call explicitly NOT a cold start.
      for (let round = 0; round < 4; round++) {
        for (const mode of round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
          const profiler = profileDashboard(p)
          projectionMs = 0
          const start = performance.now()
          try {
            const result = await (mode === 'baseline' ? baseline : readDashboard)(
              profiler.payload,
              user,
              permissions,
              '1',
            )
            const data = clean(result)
            if (!expected) expected = data
            expect(data).toEqual(expected)
            samples.push({
              role,
              round,
              mode,
              wallMs: performance.now() - start,
              projectionMs,
              snapshotHash: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
              ...profiler.report(),
            })
          } finally {
            profiler.restore()
          }
        }
      }
    }
  } finally {
    spy.mockRestore()
  }
  writeFileSync(
    process.env.DASHBOARD_BENCHMARK_EVIDENCE!,
    JSON.stringify(
      {
        condition:
          'PostgreSQL disposable, pool 3, 4 fixture Products, same persisted dataset, alternating order; Payload already initialized; not Vercel/Neon cold start.',
        samples,
      },
      null,
      2,
    ),
  )
  expect(samples).toHaveLength(24)
})
it.runIf(Boolean(process.env.DASHBOARD_TEST_AUTH_FILE))(
  'creates authentication for owned Local HTTP smoke',
  async () => {
    const login = await p.login({
      collection: 'users',
      data: { email: 'admin@benchmark.invalid', password: process.env.TEST_FIXTURE_PASSWORD! },
    })
    if (!login.token) throw Error('Disposable authentication failed')
    writeFileSync(process.env.DASHBOARD_TEST_AUTH_FILE!, JSON.stringify({ token: login.token }))
  },
)
