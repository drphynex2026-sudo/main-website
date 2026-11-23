// TEST PROCESS PRELOAD ONLY. Never imported by src, Next config, or production CLI.
// Inject an aggregation failure into the compiled function in memory; no bundle is written.
const Module=require('node:module'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),acorn=require('acorn')
const url=new URL(process.env.DATABASE_URL||'')
if(url.hostname!=='127.0.0.1'||url.pathname!=='/drphynex_independent_review_test'||!process.env.DASHBOARD_FAULT_RUN_ID||!process.env.DASHBOARD_FAULT_EVIDENCE)throw Error('Refuse fault preload outside verified disposable runner')
const serverRoot=path.resolve('.next/server')+path.sep,original=Module.prototype._compile
let injected=false
Module.prototype._compile=function(code,filename){
 if(!injected&&path.resolve(filename).startsWith(serverRoot)&&code.includes('skipApprovalState')&&code.includes('observedAt')){
  const ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'script'}),candidates=[]
  function walk(n){if(!n||typeof n!=='object')return;if(n.async&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type)&&n.body?.type==='BlockStatement'){const body=code.slice(n.body.start,n.body.end);if(body.includes('skipApprovalState')&&body.includes('observedAt')&&body.includes('productsAllowed'))candidates.push(n)}for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}}
  walk(ast)
  const leaves=candidates.filter(c=>!candidates.some(other=>other!==c&&other.start>c.start&&other.end<c.end))
  if(leaves.length!==1)throw Error('Fault injection target is not unique')
  const target=leaves[0],at=target.body.start+1
  fs.writeFileSync(process.env.DASHBOARD_FAULT_EVIDENCE,JSON.stringify({runId:process.env.DASHBOARD_FAULT_RUN_ID,bundle:path.relative(process.cwd(),filename),unmodifiedSha256:crypto.createHash('sha256').update(code).digest('hex'),functionName:target.id?.name||'(arrow)',byteOffset:at,inMemoryOnly:true},null,2))
  code=code.slice(0,at)+'throw new Error("__FIXTURE_SECRET_DB_SENTINEL__");'+code.slice(at);injected=true
 }
 return original.call(this,code,filename)
}
