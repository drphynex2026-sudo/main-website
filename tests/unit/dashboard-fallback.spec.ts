import {beforeEach,describe,it,expect,vi} from 'vitest'
import {createElement,type ReactNode} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
vi.mock('@payloadcms/ui',()=>({Gutter:({children}:{children:ReactNode})=>createElement('div',null,children)}))
vi.mock('next/link',()=>({default:({children,href}:{children:ReactNode;href:string})=>createElement('a',{href},children)}))
vi.mock('@/lib/dashboard-read',()=>({readDashboard:vi.fn()}))
import {readDashboard} from '@/lib/dashboard-read'
import {Dashboard} from '@/components/admin/Dashboard'
const props=(role='editor')=>({initPageResult:{req:{user:{role,email:'fixture@invalid.test'}},permissions:{collections:{products:{read:true},media:{read:true},'contact-submissions':{read:role==='admin'}},globals:{'home-page':{read:true}}}},payload:{},searchParams:{}})
beforeEach(()=>vi.resetAllMocks())
describe('aggregate fallback retains permitted dashboard shell',()=>{
 it.each(['admin','editor','translator'])('%s still sees title and only allowed shortcuts on reader/snapshot failure',async role=>{
  vi.mocked(readDashboard).mockRejectedValueOnce(new Error('SECRET_DB_URL_AND_TOKEN'))
  const html=renderToStaticMarkup(await Dashboard(props(role) as never))
  expect(html).toContain('Bảng điều khiển');expect(html).toContain('Chưa đọc được bảng việc. Hãy tải lại.');expect(html).toContain('Lối tắt');expect(html).toContain('href="/admin/collections/products"');expect(html).toContain('href="/admin/globals/home-page"')
  expect(html.includes('href="/admin/collections/contact-submissions"')).toBe(role==='admin')
  expect(html).not.toMatch(/SECRET_DB|cặp có việc|Chưa phát hiện điều kiện chặn|Trang 1\//)
 })
 it('also covers a task-count/projection failure after loading',async()=>{
  vi.mocked(readDashboard).mockResolvedValueOnce({products:null} as never)
  const html=renderToStaticMarkup(await Dashboard(props() as never));expect(html).toContain('Chưa đọc được bảng việc. Hãy tải lại.');expect(html).toContain('Lối tắt');expect(html).not.toContain('cặp có việc')
 })
})
