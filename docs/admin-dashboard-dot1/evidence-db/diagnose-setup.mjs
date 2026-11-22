// Owner-authorized SETUP DIAGNOSTIC ONLY: no pg client, SQL, fixture, test runner or application.
import {execFileSync} from 'node:child_process'
import {randomBytes,randomUUID} from 'node:crypto'
import {mkdirSync,writeFileSync,existsSync} from 'node:fs'
import path from 'node:path'
const folder=path.resolve('docs/admin-dashboard-dot1/evidence-db')
const output=path.join(folder,'setup-diagnostic.json')
if(existsSync(output))throw Error('Diagnostic already recorded; refusing rerun/overwrite')
const env={}
for(const key of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA'])if(process.env[key])env[key]=process.env[key]
const configDir=path.join(folder,'docker-diagnostic-empty');mkdirSync(configDir,{recursive:true});writeFileSync(path.join(configDir,'config.json'),'{}');env.DOCKER_CONFIG=configDir
const endpoint='npipe:////./pipe/dockerDesktopLinuxEngine',runId=randomUUID(),labelKey='drphynex.dashboard-setup-diagnostic',short=runId.slice(0,8)
const name='dx-dashboard-diag-'+short,networkName='dx-dashboard-diag-net-'+short,password=randomBytes(32).toString('hex')
const report={runId,endpoint,name,scope:'metadata only; NO DB connection or tests',snapshots:[],cleanup:[],startedAt:new Date().toISOString()}
const save=()=>writeFileSync(output,JSON.stringify(report,null,2))
const docker=(args,extra={})=>execFileSync('docker',['--host',endpoint,...args],{env,encoding:'utf8',windowsHide:true,timeout:30000,...extra}).trim()
let cid,nid
try{
 nid=docker(['network','create','--internal','--label',`${labelKey}=${runId}`,networkName]);report.networkId=nid;save()
 cid=docker(['run','--detach','--pull','never','--name',name,'--label',`${labelKey}=${runId}`,'--network',nid,'--memory','768m','--cpus','1','--pids-limit','128','--tmpfs','/var/lib/postgresql/data:rw,size=512m','--publish','127.0.0.1::5432','--env','POSTGRES_PASSWORD','--env','POSTGRES_DB=drphynex_independent_review_test','postgres:17.6-alpine'],{env:{...env,POSTGRES_PASSWORD:password}});report.containerId=cid;save()
 for(let index=0;index<2;index++){
  if(index===1)await new Promise(resolve=>setTimeout(resolve,3000))
  const c=JSON.parse(docker(['inspect',cid]))[0],n=JSON.parse(docker(['network','inspect',nid]))[0]
  if(c.Id!==cid||c.Config.Labels[labelKey]!==runId||n.Id!==nid||n.Labels[labelKey]!==runId)throw Error('Resource identity mismatch')
  const bindings=c.HostConfig.PortBindings,attachments=Object.entries(c.NetworkSettings.Networks).map(([name,v])=>({name,id:v.NetworkID,ip:v.IPAddress})),members=Object.keys(n.Containers)
  if(Object.keys(bindings).length!==1||Object.values(bindings).flat().some(b=>b.HostIp!=='127.0.0.1')||attachments.length!==1||attachments[0].id!==nid||!n.Internal||members.length!==1||members[0]!==cid||c.Mounts.some(m=>m.Type!=='tmpfs'||m.Destination!=='/var/lib/postgresql/data'))throw Error('Isolation policy mismatch')
  report.snapshots.push({index,at:new Date().toISOString(),state:{status:c.State.Status,running:c.State.Running,exitCode:c.State.ExitCode,error:c.State.Error},configuredBindings:bindings,actualPorts:c.NetworkSettings.Ports,dockerPort:docker(['port',cid]),network:{id:nid,internal:n.Internal,members},attachments,mounts:c.Mounts.map(m=>({type:m.Type,destination:m.Destination})),resources:{memory:c.HostConfig.Memory,nanoCPUs:c.HostConfig.NanoCpus,pidsLimit:c.HostConfig.PidsLimit}});save()
 }
 report.diagnosticComplete=true
}catch(error){report.failure=String(error.message).replaceAll(password,'[REDACTED]');process.exitCode=1}
finally{
 if(cid){const c=JSON.parse(docker(['inspect',cid]))[0];if(c.Id!==cid||c.Config.Labels[labelKey]!==runId)throw Error('Refuse container cleanup identity mismatch');docker(['rm','--force',cid]);report.cleanup.push({containerId:cid,removed:true})}
 if(nid){const n=JSON.parse(docker(['network','inspect',nid]))[0];if(n.Id!==nid||n.Labels[labelKey]!==runId||Object.keys(n.Containers).length!==0)throw Error('Refuse network cleanup');docker(['network','rm',nid]);report.cleanup.push({networkId:nid,removed:true})}
 report.finishedAt=new Date().toISOString();save()
}
console.log(JSON.stringify(report,null,2))
