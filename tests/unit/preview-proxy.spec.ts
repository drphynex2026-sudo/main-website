import { expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import proxy from '@/proxy'
vi.mock('next-intl/middleware', async () => {
  const { NextResponse } = await import('next/server')
  return { default: () => (request: NextRequest) => NextResponse.next({ request: { headers: request.headers } }) }
})

it('passes verified context to the locale middleware for HTML and RSC (middleware mocked)', () => {
  for (const rsc of [false, true]) {
    const response = proxy(new NextRequest('http://localhost/ko/brand?lp=guest', {
      headers: { 'x-dx-preview-view': 'staff', 'x-dx-preview-product': '1', cookie: 'fixture=1', ...(rsc ? { rsc: '1' } : {}) },
    }))
    expect(response.headers.get('x-middleware-request-x-dx-preview-view')).toBe('guest')
    expect(response.headers.get('x-middleware-request-x-dx-preview-product')).toBe('0')
    expect(response.headers.get('x-middleware-request-cookie')).toBe('fixture=1')
    if (rsc) expect(response.headers.get('x-middleware-request-rsc')).toBe('1')
  }
})
it('does not trust a forged product context without a matching URL', () => {
  const response = proxy(new NextRequest('http://localhost/en/contact', {
    headers: { 'x-dx-preview-view': 'guest', 'x-dx-preview-product': '1' },
  }))
  expect(response.headers.get('x-middleware-request-x-dx-preview-view')).toBe('')
  expect(response.headers.get('x-middleware-request-x-dx-preview-product')).toBe('0')
})
it('does not consume or replace the body of a form/action request', async () => {
  const request = new NextRequest('http://localhost/ko/contact?lp=guest', { method: 'POST', body: 'fixture-body' })
  const response = proxy(request)
  expect(response.status).toBe(200)
  expect(await request.text()).toBe('fixture-body')
})
