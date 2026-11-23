/* eslint-disable @typescript-eslint/no-explicit-any -- integration fixtures use actual Payload documents. */
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
import {getPayload,type Payload} from 'payload'
import {randomBytes,createHash} from 'node:crypto'
import {writeFileSync} from 'node:fs'
import config from '@/payload.config'
import {migrations} from '@/migrations'
import {assertDisposableDatabase} from '../helpers/database'
import {readDashboard} from '@/lib/dashboard-read'
import {taskCounts} from '@/lib/dashboard-snapshot'
import {homeApprovalContext} from '../helpers/home-approval'
let p:Payload,admin:any,editor:any,translator:any
const locales=['ko','en','vi'] as const
const evidenceFile=(name:string)=>(process.env.DASHBOARD_EVIDENCE_DIR || 'docs/admin-dashboard-dot1/evidence-db')+'/'+name
const permissions={collections:{products:{read:true}},globals:{'home-page':{read:true}}}
const pw=process.env.TEST_FIXTURE_PASSWORD || randomBytes(24).toString('hex')
const options=(locale:any,user=editor,draft=false)=>({locale,user,draft,overrideAccess:false,fallbackLocale:false as const})
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
async function durable(){return hash({main:await p.find({collection:'products',...options('ko'),limit:100,depth:0}),home:await p.findGlobal({slug:'home-page',...options('ko'),depth:0,context:{skipApprovalState:true}}),productVersions:await p.findVersions({collection:'products',overrideAccess:false,user:editor,limit:200,depth:0}),homeVersions:await p.findGlobalVersions({slug:'home-page',overrideAccess:false,user:editor,limit:100,depth:0})})}
beforeAll(async()=>{
 p=await getPayload({config:await config});await assertDisposableDatabase(p);await p.db.migrate({migrations:migrations as any})
 admin=await p.create({collection:'users',overrideAccess:true,data:{email:'admin@fixture.invalid',password:pw,role:'admin'}})
 editor=await p.create({collection:'users',overrideAccess:false,user:admin,data:{email:'editor@fixture.invalid',password:pw,role:'editor'}})
 translator=await p.create({collection:'users',overrideAccess:false,user:admin,data:{email:'translator@fixture.invalid',password:pw,role:'translator'}})
 for(let i=0;i<21;i++){
  const doc=await p.create({collection:'products',...options('ko',editor,true),draft:true,data:{name:`[FIXTURE] ${String(i+1).padStart(2,'0')} KO`,slug:`dashboard-fixture-${String(i+1).padStart(2,'0')}`,translationStatus:'in-review',_status:'draft'}})
  for(const l of ['en','vi'] as const)await p.update({collection:'products',id:doc.id,...options(l,editor,true),data:{name:`[FIXTURE] ${String(i+1).padStart(2,'0')} ${l.toUpperCase()}`}})
  if(i===0){await p.update({collection:'products',id:doc.id,...options('ko',editor,true),data:{translationStatus:'approved'}});await p.update({collection:'products',id:doc.id,...options('ko'),data:{_status:'published'}});await p.update({collection:'products',id:doc.id,...options('ko',editor,true),data:{shortDescription:'[FIXTURE] New draft not approved'}})}
 }
 for(const l of locales){await p.updateGlobal({slug:'home-page',...options(l,editor,true),data:{headline:`[FIXTURE] ${l}`,translationStatus:'in-review'}});await p.updateGlobal({slug:'home-page',...options(l,editor,true),data:{translationStatus:'approved'},context:await homeApprovalContext(p,l)});await p.updateGlobal({slug:'home-page',...options(l),data:{_status:'published'}})}
 await p.updateGlobal({slug:'home-page',...options('ko',editor,true),data:{banners:{luma:{theme:'forma'}}}})
 await p.updateGlobal({slug:'home-page',...options('ko',editor,true),data:{translationStatus:'approved'},context:await homeApprovalContext(p,'ko')})
})
afterAll(async()=>{await p?.destroy()})
describe('Dashboard application reads on disposable fixture',()=>{
 it.each(['admin','editor','translator'])('%s sees page20 and separate Home, without serializing hidden data',async role=>{const user={admin,editor,translator}[role];const data=await readDashboard(p,user,permissions,'1');expect(data.products).toHaveLength(20);expect(data.inventory).toEqual({kind:'ok',value:{total:21,pages:2,page:1}});expect(data.home?.cells[0].missing.map(m=>m.locale)).toEqual(['en','vi']);expect(data.home?.cells[0].reason).toBe('DEPENDENCY');expect(data.products[0].cells[0]).toMatchObject({publicLabel:'Khách đọc được bản hiện tại',contentLabel:'Đang xem xét',reason:'CONTENT'});expect(data.products[1].cells[0].sharedLabel).toBe('Không áp dụng landing');expect(JSON.stringify(data)).not.toMatch(/approvalBasis|bannerApprovals|landingApprovals|docSave|password|salt|hash"|fixture.invalid/);expect(taskCounts(data.products).total).toBe(60)})
 it('page2/clamping count only current Products and Home remains separate',async()=>{const data=await readDashboard(p,editor,permissions,'999');expect(data.products).toHaveLength(1);expect(data.inventory).toEqual({kind:'ok',value:{total:21,pages:2,page:2}});expect(taskCounts(data.products).total).toBe(3);expect(taskCounts([data.home!]).total).toBe(3)})
 it('permission denied does not leak the other source',async()=>{const data=await readDashboard(p,translator,{collections:{products:{read:false}},globals:{'home-page':{read:false}}},'1');expect(data.products).toEqual([]);expect(data.home).toBeNull();expect(data.productsAllowed).toBe(false)})
 it('readDashboard performs no mutation calls and leaves main/version data unchanged',async()=>{const before=await durable();const calls:string[]=[];const proxy=new Proxy(p,{get(target,key){if(['create','update','delete','updateGlobal','restoreVersion','restoreGlobalVersion'].includes(String(key)))return()=>{calls.push(String(key));throw Error('Mutation from dashboard')};return Reflect.get(target,key)}});await readDashboard(proxy,editor,permissions,'1');expect(calls).toEqual([]);expect(await durable()).toBe(before)})
 it('dashboard missing set agrees with actual Home publish guard and refusal changes no durable state',async()=>{const before=await durable(),data=await readDashboard(p,editor,permissions,'1');expect(data.home!.cells[0].missing.map(m=>m.locale)).toEqual(['en','vi']);await expect(p.updateGlobal({slug:'home-page',...options('ko'),data:{_status:'published'}})).rejects.toMatchObject({status:409});expect(await durable()).toBe(before)})
 it('records sanitized fixture inventory for browser checks',async()=>{const data=await readDashboard(p,editor,permissions,'1');writeFileSync(evidenceFile('dashboard-fixture-summary.json'),JSON.stringify({inventory:data.inventory,products:data.products.map(d=>({id:d.id,title:d.title,links:d.cells.map(c=>c.href)})),home:data.home?.cells.map(c=>({locale:c.locale,href:c.href,missing:c.missing})),beforeBrowserContentHash:await durable()},null,2))})
 it('never-published Product: staff main succeeds and guest gets no document',async()=>{
  const where={slug:{equals:'dashboard-fixture-02'}}
  for(const locale of locales){
   const staff=await p.find({collection:'products',...options(locale,translator),where,depth:0})
   const guest=await p.find({collection:'products',locale,fallbackLocale:false,overrideAccess:false,draft:false,where,depth:0})
   expect(staff.docs).toHaveLength(1);expect(staff.docs[0]._status).toBe('draft');expect(guest.docs).toHaveLength(0)
  }
 })
 it('bounded real reads preserve ordering and record actual top-level find concurrency',async()=>{
  let active=0,peak=0
  const proxy=new Proxy(p,{get(target,key){if(key==='find')return async(opts:any)=>{const tracked=opts.collection==='products'&&!!opts.where?.id; if(tracked)peak=Math.max(peak,++active);try{return await target.find(opts)}finally{if(tracked)active--}};return Reflect.get(target,key)}})
  const data=await readDashboard(proxy,editor,permissions,'1');expect(data.products.map(d=>Number(d.id))).toEqual(Array.from({length:20},(_,i)=>i+1));expect(peak).toBe(3);expect(active).toBe(0)
  writeFileSync(evidenceFile('real-concurrency.json'),JSON.stringify({topLevelProductFindsLimit:3,topLevelProductFindsPeak:peak,findsPerPage:9,homeRunsAfterProducts:true,internalRelationQueriesNotCounted:true},null,2))
 })
 it('Product dependency matches real 409 after shared structure changes',async()=>{
  const doc=await p.create({collection:'products',...options('ko',editor,true),draft:true,data:{name:'[FIXTURE] Product dependency KO',slug:'review-dependency-product',landing:[{blockType:'hero',tagline:'KO'}],translationStatus:'in-review'}})
  await p.update({collection:'products',id:doc.id,...options('ko',editor,true),data:{translationStatus:'approved'}});await p.update({collection:'products',id:doc.id,...options('ko'),data:{_status:'published'}})
  await p.update({collection:'products',id:doc.id,...options('en',editor,true),data:{name:'[FIXTURE] Product dependency EN'}});await p.update({collection:'products',id:doc.id,...options('en',editor,true),data:{translationStatus:'approved'}});await p.update({collection:'products',id:doc.id,...options('en'),data:{_status:'published'}})
  const seen=await p.findByID({collection:'products',id:doc.id,...options('ko',editor,true),depth:0})
  await p.update({collection:'products',id:doc.id,...options('ko',editor,true),data:{landing:seen.landing!.map(b=>({...b,tone:'dark'}))}})
  await p.update({collection:'products',id:doc.id,...options('ko',editor,true),data:{translationStatus:'approved'}})
  const data=await readDashboard(p,editor,permissions,'2'),cell=data.products.find(d=>d.id===String(doc.id))!.cells[0]
  expect(cell.reason).toBe('DEPENDENCY');expect(cell.missing).toEqual([{locale:'en',href:`/admin/collections/products/${doc.id}?locale=en`}])
  const before=await durable();await expect(p.update({collection:'products',id:doc.id,...options('ko'),data:{_status:'published'}})).rejects.toMatchObject({status:409});expect(await durable()).toBe(before)
  writeFileSync(evidenceFile('product-dependency.json'),JSON.stringify({id:doc.id,missing:cell.missing,guardStatus:409,durableUnchanged:true},null,2))
 })
})
