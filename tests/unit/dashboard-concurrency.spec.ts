import {describe,it,expect,vi} from 'vitest'
vi.mock('server-only',()=>({}))
import {mapProducts,readDashboard} from '@/lib/dashboard-read'
const gate=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r});return{promise,resolve}}
describe('bounded Product aggregation',()=>{
 it('at most four workers, out-of-order completion retains input order',async()=>{
  const gates=Array.from({length:9},gate),started:number[]=[],finished:number[]=[];let active=0,peak=0
  const work=mapProducts(gates,async(g,i)=>{started.push(i);peak=Math.max(peak,++active);await g.promise;active--;finished.push(i);return i*10})
  await vi.waitFor(()=>expect(started).toEqual([0,1,2,3]));expect(peak).toBe(4)
  gates[3].resolve();await vi.waitFor(()=>expect(started).toEqual([0,1,2,3,4]));gates.forEach(g=>g.resolve())
  expect(await work).toEqual([0,10,20,30,40,50,60,70,80]);expect(finished[0]).toBe(3);expect(peak).toBe(4)
 })
 it('drains in-flight workers after failure and schedules no further Products',async()=>{
  const gates=Array.from({length:4},gate),started:number[]=[];let completed=0,settled=false
  const work=mapProducts([0,1,2,3,4,5],async n=>{started.push(n);await gates[n].promise;if(n===0)throw Error('aggregate failure');completed++;return n})
  const outcome=work.then(()=>{throw Error('unexpected success')},e=>{settled=true;return e.message})
  expect(started).toEqual([0,1,2,3]);gates[0].resolve();await Promise.resolve();await Promise.resolve();expect(settled).toBe(false)
  gates.slice(1).forEach(g=>g.resolve());expect(await outcome).toBe('aggregate failure');expect(completed).toBe(3);expect(started).toEqual([0,1,2,3])
 })
 it('four Products fan out to 36 top-level Local API finds, not all inventory',async()=>{
  const gates=Array.from({length:8},gate);const started=new Set<number>();let active=0,peak=0
  const payload={count:vi.fn(async()=>({totalDocs:8})),find:vi.fn(async(opts:{where?:{id:{equals:string}}})=>{
   if(!opts.where)return{docs:gates.map((_,i)=>({id:i+1}))}
   const id=Number(opts.where.id.equals);started.add(id);peak=Math.max(peak,++active);await gates[id-1].promise;active--
   return{docs:[{id,name:`P${id}`,translationStatus:'in-review',landing:[],landingApprovals:{},images:[]}]}
  })}
  const work=readDashboard(payload as never,{role:'editor'} as never,{collections:{products:{read:true}}},'1')
  await vi.waitFor(()=>expect(active).toBe(36));expect([...started]).toEqual([1,2,3,4]);gates[3].resolve();await vi.waitFor(()=>expect(started.has(5)).toBe(true));gates.forEach(g=>g.resolve())
  const data=await work;expect(data.products.map(p=>p.id)).toEqual(['1','2','3','4','5','6','7','8']);expect(peak).toBe(36);expect(active).toBe(0)
 })
})
