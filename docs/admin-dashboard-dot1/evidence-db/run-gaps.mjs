import {execFileSync,spawn} from 'node:child_process';import {randomBytes,randomUUID} from 'node:crypto';import {writeFileSync,mkdirSync,existsSync,lstatSync,symlinkSync,unlinkSync} from 'node:fs';import {createRequire} from 'node:module';import path from 'node:path';
const root=process.cwd(),evidence=path.join(root,'docs/admin-dashboard-dot1/evidence-db'),host='npipe:////./pipe/dockerDesktopLinuxEngine';
const env={};for(const k of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA'])if(process.env[k])env[k]=process.env[k];
const dockerConfig=path.join(evidence,'docker-empty');mkdirSync(dockerConfig,{recursive:true});writeFileSync(path.join(dockerConfig,'config.json'),'{}');env.DOCKER_CONFIG=dockerConfig;
const runId=randomUUID(),short=runId.slice(0,8),name='dx-dashboard-gap-'+short,network='dx-dashboard-gap-net-'+short,label='drphynex.dashboard-gap-run='+runId;
const password=randomBytes(32).toString('hex'),db='drphynex_independent_review_test',marker='drphynex-independent-review-disposable-v1';
let cid,nid,pg,testChild,junction=false;const ledger={runId,name,endpoint:host,image:'postgres:17.6-alpine',created:[],checks:[],cleanup:[]};const save=()=>writeFileSync(path.join(evidence,'resource-ledger.json'),JSON.stringify(ledger,null,2));
function docker(args,extra={}){return execFileSync('docker',['--host',host,...args],{encoding:'utf8',windowsHide:true,timeout:30000,env,...extra}).trim()}
const require=createRequire('C:/Users/THAI/Websites/website-demo/package.json');const {Client}=require('pg');
let exitCode=1;
try{
 if(existsSync(path.join(evidence,'RUN-COMPLETE.json')))throw Error('No automatic rerun allowed');
 nid=docker(['network','create','--label',label,network]);ledger.created.push({kind:'network',id:nid});save();
 cid=docker(['run','--detach','--pull','never','--name',name,'--label',label,'--network',nid,'--memory','768m','--cpus','1','--pids-limit','128','--tmpfs','/var/lib/postgresql/data:rw,size=512m','--publish','127.0.0.1::5432','--env','POSTGRES_PASSWORD','--env','POSTGRES_DB='+db,'postgres:17.6-alpine'],{env:{...env,POSTGRES_PASSWORD:password}});ledger.created.push({kind:'container',id:cid});save();
 const inspect=JSON.parse(docker(['inspect',cid]))[0],net=JSON.parse(docker(['network','inspect',nid]))[0];
 const ports=inspect.HostConfig.PortBindings,mounts=inspect.Mounts,attachments=Object.values(inspect.NetworkSettings.Networks);
 if(inspect.Id!==cid||inspect.Config.Labels['drphynex.dashboard-gap-run']!==runId||net.Internal!==false||Object.keys(net.Containers).length!==1||!net.Containers[cid]||attachments.length!==1||attachments[0].NetworkID!==nid)throw Error('Container/network identity mismatch');
 if(Object.keys(ports).length!==1||!ports['5432/tcp']?.length||Object.values(ports).flat().some(x=>x.HostIp!=='127.0.0.1')||(mounts.length!==0||inspect.HostConfig.Tmpfs?.['/var/lib/postgresql/data']!=='rw,size=512m'))throw Error('Forbidden binding/mount');
 const bound=inspect.NetworkSettings.Ports['5432/tcp'];ledger.actualPortDiagnostic={configured:ports,actual:inspect.NetworkSettings.Ports,state:inspect.State.Status};save();if(bound.length!==1||bound[0].HostIp!=='127.0.0.1')throw Error('Actual port mismatch');
 ledger.checks.push({identity:true,networkInternal:false,exclusiveNetwork:true,port:bound[0].HostPort,mounts:mounts.map(x=>({type:x.Type,destination:x.Destination})),noExternalVolumes:true});save();
 const connectionString=`postgresql://postgres:${password}@127.0.0.1:${bound[0].HostPort}/${db}`;
 const deadline=Date.now()+45000;while(true){const client=new Client({connectionString,connectionTimeoutMillis:1000});try{await client.connect();pg=client;break}catch(e){await client.end().catch(()=>{});if(Date.now()>deadline)throw Error('DB ready deadline');await new Promise(r=>setTimeout(r,500))}}
 const identity=(await pg.query('select current_database() as name,current_user as role,host(inet_server_addr()) as address,system_identifier::text from pg_control_system()')).rows[0];ledger.connectedIdentityObserved=identity;ledger.expectedServerAddress=attachments[0].IPAddress;save();if(identity.name!==db||identity.role!=='postgres'||identity.address!==attachments[0].IPAddress)throw Error('Connected DB identity mismatch');
 if((await pg.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'")).rows[0].n!==0)throw Error('Expected empty brand-new DB');
 await pg.query(`COMMENT ON DATABASE ${db} IS '${marker}'`);
 const confirmed=(await pg.query("SELECT current_database() as name,shobj_description(oid,'pg_database') as marker FROM pg_database WHERE datname=current_database()" )).rows[0];if(confirmed.name!==db||confirmed.marker!==marker)throw Error('Marker mismatch');ledger.checks.push({...identity,marker:confirmed.marker,pgVersion:(await pg.query('show server_version')).rows[0].server_version});save();await pg.end();pg=null;
 const modules=path.join(root,'node_modules');if(!existsSync(modules)){symlinkSync('C:/Users/THAI/Websites/website-demo/node_modules',modules,'junction');junction=true}
 const childEnv={...env,NODE_ENV:'test',NODE_OPTIONS:'--max-old-space-size=2048',DATABASE_URL:connectionString,PAYLOAD_SECRET:randomBytes(32).toString('hex'),NEXT_PUBLIC_SERVER_URL:'http://127.0.0.1:1',NEXT_TELEMETRY_DISABLED:'1'};
 // No .env setup; envDir:false. Do not inherit database/storage/email/Vercel credentials.
 const args=['C:/Users/THAI/Websites/website-demo/node_modules/vitest/vitest.mjs','run','--config','docs/admin-dashboard-dot1/evidence-db/vitest.gaps.config.mts','--maxWorkers','1'];
 testChild=spawn(process.execPath,args,{cwd:root,env:childEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';const clean=s=>s.replaceAll(password,'[REDACTED]').replaceAll(connectionString,'[REDACTED_URL]').replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[REDACTED_URL]');for(const stream of [testChild.stdout,testChild.stderr])stream.on('data',b=>{const s=clean(b.toString());logs+=s;process.stdout.write(s)});
 const timer=setTimeout(()=>{ledger.testTimeout=true;testChild.kill()},210000);
 const result=await new Promise((resolve,reject)=>{testChild.once('error',reject);testChild.once('exit',(code,signal)=>resolve({code,signal}))});clearTimeout(timer);writeFileSync(path.join(evidence,'vitest.log'),logs);ledger.testResult=result;save();exitCode=result.code===0?0:1;
 writeFileSync(path.join(evidence,'RUN-COMPLETE.json'),JSON.stringify({runId,result,completedAt:new Date().toISOString(),noProductionConnection:true},null,2));
}catch(e){ledger.failure=String(e.message).replaceAll(password,'[REDACTED]');console.error('STOP '+ledger.failure);save()}
finally{
 if(pg)await pg.end().catch(()=>{});
 if(testChild&&testChild.exitCode===null&&testChild.signalCode===null){testChild.kill();ledger.cleanup.push({childSignal:'termination-requested'})}
 if(cid){const inspect=JSON.parse(docker(['inspect',cid]))[0];if(inspect.Id!==cid||inspect.Config.Labels['drphynex.dashboard-gap-run']!==runId)throw Error('Refuse cleanup identity mismatch');docker(['rm','--force',cid]);ledger.cleanup.push({container:cid,removed:true})}
 if(nid){const n=JSON.parse(docker(['network','inspect',nid]))[0];if(n.Id!==nid||n.Labels['drphynex.dashboard-gap-run']!==runId||Object.keys(n.Containers).length)throw Error('Refuse network cleanup');docker(['network','rm',nid]);ledger.cleanup.push({network:nid,removed:true})}
 if(junction){const target=path.join(root,'node_modules');if(lstatSync(target).isSymbolicLink()){unlinkSync(target);ledger.cleanup.push({temporaryDependencyJunctionRemoved:true})}}
 save();
}
process.exitCode=exitCode;



