import { expect, it, vi } from 'vitest'
import { profileDashboard } from '../helpers/dashboard-profile'
it('attributes callback queries to their read group and distinguishes pg config + separate parameter arrays', async () => {
  const query = vi.fn(
    (_query: unknown, _values: unknown, callback: (error: null, result: unknown) => void) =>
      callback(null, { rows: [] }),
  )
  const client = { query }
  const connect = vi.fn((callback: (error: null, client: unknown, release: () => void) => void) =>
    queueMicrotask(() => callback(null, client, () => {})),
  )
  const pool = { connect, waitingCount: 0, options: { max: 3 } }
  const payload = {
    db: { pool },
    find: async (options: { where: { id: number } }) =>
      new Promise((resolve) =>
        pool.connect((_error, connection) => {
          ;(connection as typeof client).query(
            { text: 'select $1', rowMode: 'array' },
            [options.where.id],
            () => resolve({ docs: [] }),
          )
        }),
      ),
  }
  const profiler = profileDashboard(payload as never)
  try {
    for (const id of [1, 2])
      await profiler.payload.find({
        collection: 'products',
        locale: 'ko',
        draft: true,
        user: { role: 'editor' },
        where: { id },
      } as never)
    expect(profiler.report().duplicateSQLExecutions).toBe(0)
    await profiler.payload.find({
      collection: 'products',
      locale: 'ko',
      draft: true,
      user: { role: 'editor' },
      where: { id: 1 },
    } as never)
    expect(profiler.report()).toMatchObject({
      duplicateSQLExecutions: 1,
      sqlCount: 3,
      uniqueSQLShapes: 1,
      groups: { 'products.draft': { calls: 3, queries: 3 } },
    })
  } finally {
    profiler.restore()
  }
  expect(pool.connect).toBe(connect)
  expect(client.query).toBe(query)
})
