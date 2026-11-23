import {tmpdir} from 'node:os';import nodeNet from 'node:net';
import {execFileSync,spawn} from 'node:child_process';import {randomBytes,randomUUID} from 'node:crypto';import {writeFileSync,mkdirSync,existsSync,lstatSync,symlinkSync,unlinkSync,mkdtempSync,rmSync,rmdirSync} from 'node:fs';import {createRequire} from 'node:module';import path from 'node:path';
const root=process.cwd(),evidence=path.join(root,'docs/admin-dashboard-dot1/review-fix-20261123/runtime'),host='npipe:////./pipe/dockerDesktopLinuxEngine';
const env={};for(const k of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA'])if(process.env[k])env[k]=process.env[k];
mkdirSync(evidence,{recursive:true});
const dockerConfig=path.join(evidence,'docker-empty');mkdirSync(dockerConfig,{recursive:true});writeFileSync(path.join(dockerConfig,'config.json'),'{}');env.DOCKER_CONFIG=dockerConfig;
const runId=randomUUID(),short=runId.slice(0,8),name='dx-dashboard-review-'+short,network='dx-dashboard-review-net-'+short,label='drphynex.dashboard-gap-run='+runId;
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
 const listen=nodeNet.createServer();await new Promise(r=>listen.listen(0,'127.0.0.1',r));const port=listen.address().port;await new Promise(r=>listen.close(r));const origin=`http://127.0.0.1:${port}`;
 const fixturePassword=randomBytes(24).toString('hex'),secret=randomBytes(32).toString('hex');
 const childEnv={...env,NODE_ENV:'test',NODE_OPTIONS:'--max-old-space-size=2048',DATABASE_URL:connectionString,PAYLOAD_SECRET:secret,NEXT_PUBLIC_SERVER_URL:origin,NEXT_TELEMETRY_DISABLED:'1',CIRCLE_NODE_TOTAL:'2',TEST_FIXTURE_PASSWORD:fixturePassword,DASHBOARD_EVIDENCE_DIR:evidence};
 const clean=s=>s.replaceAll(password,'[REDACTED]').replaceAll(connectionString,'[REDACTED_URL]').replaceAll(fixturePassword,'[REDACTED_FIXTURE_PASSWORD]').replaceAll(secret,'[REDACTED_SECRET]');
 async function command(label,args,timeout){const child=spawn(process.execPath,args,{cwd:root,env:childEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});testChild=child;let log='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{const s=clean(b.toString());log+=s;process.stdout.write(s)});const timer=setTimeout(()=>child.kill(),timeout);const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}))});clearTimeout(timer);writeFileSync(path.join(evidence,label+'.log'),log);ledger[label]=result;save();if(result.code!==0)throw Error(label+' failed');}
 await command('integration',['C:/Users/THAI/Websites/website-demo/node_modules/vitest/vitest.mjs','run','--config','docs/admin-dashboard-dot1/evidence-db/vitest.dashboard-int.config.mts','--maxWorkers','1'],210000);
 childEnv.NODE_ENV='production';delete childEnv.TEST_FIXTURE_PASSWORD;
 await command('build',['C:/Users/THAI/Websites/website-demo/node_modules/next/dist/bin/next','build','--webpack'],600000);
 async function contentSnapshot(){const c=new Client({connectionString,connectionTimeoutMillis:3000});await c.connect();try{const identity=(await c.query("SELECT current_database() as name,shobj_description(oid,'pg_database') as marker FROM pg_database WHERE datname=current_database()")).rows[0];if(identity.name!==db||identity.marker!==marker)throw Error('Snapshot identity mismatch');const tables=(await c.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename).filter(t=>/^(products|_products_v|home_page|_home_page_v)(_|$)/.test(t));const hashes={};for(const t of tables){if(!/^[a-z0-9_]+$/.test(t))throw Error('Unsafe table');hashes[t]=(await c.query(`select count(*)::int as count,md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text collate "C"),'')) as checksum from "${t}" t`)).rows[0]}return hashes}finally{await c.end()}}
 const before=await contentSnapshot();writeFileSync(path.join(evidence,'browser-content-before.json'),JSON.stringify(before,null,2));
 const loginDir=mkdtempSync(path.join(tmpdir(),'dx-dashboard-fixture-'));const loginFile=path.join(loginDir,'login.json');writeFileSync(loginFile,JSON.stringify({origin,password:fixturePassword,roles:{admin:'admin@fixture.invalid',editor:'editor@fixture.invalid',translator:'translator@fixture.invalid'}}));
 const server=spawn(process.execPath,['C:/Users/THAI/Websites/website-demo/node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:childEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});testChild=server;let serverLog='';for(const s of [server.stdout,server.stderr])s.on('data',b=>{serverLog+=clean(b.toString());writeFileSync(path.join(evidence,'server.log'),serverLog)});
 const readyDeadline=Date.now()+60000;let ready=false;while(Date.now()<readyDeadline){if(server.exitCode!==null||server.signalCode!==null)throw Error('Server exited');try{const r=await fetch(origin+'/admin/login',{signal:AbortSignal.timeout(3000)});if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,1000))}if(!ready)throw Error('Ready deadline');
 const stopFile=path.join(evidence,'STOP-'+runId);writeFileSync(path.join(evidence,'browser-ready.json'),JSON.stringify({origin,loginFile,stopFile,runId,serverPid:server.pid},null,2));console.log('BROWSER_READY '+origin);ledger.browserReady=true;save();
 const end=Date.now()+1200000;while(!existsSync(stopFile)&&Date.now()<end){if(server.exitCode!==null||server.signalCode!==null)throw Error('Server stopped unexpectedly');await new Promise(r=>setTimeout(r,1000))}
 async function stopServer(child){child.kill();await new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();child.once('exit',resolve);setTimeout(()=>{child.kill();resolve()},5000)})}
 const afterNormal=await contentSnapshot();ledger.normalContentUnchanged=JSON.stringify(before)===JSON.stringify(afterNormal);await stopServer(server);if(!ledger.normalContentUnchanged)throw Error('Normal browser changed content');
 const faultEnv={...childEnv,NODE_OPTIONS:childEnv.NODE_OPTIONS+' --require '+path.join(root,'docs/admin-dashboard-dot1/review-fix-20261123/aggregate-fault.cjs'),DASHBOARD_FAULT_RUN_ID:runId,DASHBOARD_FAULT_EVIDENCE:path.join(evidence,'fault-injection.json')};
 const faultServer=spawn(process.execPath,['C:/Users/THAI/Websites/website-demo/node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:faultEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});testChild=faultServer;let faultLog='';for(const s of [faultServer.stdout,faultServer.stderr])s.on('data',b=>{faultLog+=clean(b.toString());writeFileSync(path.join(evidence,'fault-server.log'),faultLog)});
 const faultDeadline=Date.now()+60000;let faultReady=false;while(Date.now()<faultDeadline){if(faultServer.exitCode!==null||faultServer.signalCode!==null)throw Error('Fault server exited');try{const r=await fetch(origin+'/admin/login',{signal:AbortSignal.timeout(3000)});if(r.ok){faultReady=true;break}}catch{}await new Promise(r=>setTimeout(r,1000))}if(!faultReady)throw Error('Fault ready deadline');
 const faultStop=path.join(evidence,'FAULT-STOP-'+runId);writeFileSync(path.join(evidence,'fault-ready.json'),JSON.stringify({origin,loginFile,stopFile:faultStop,runId,serverPid:faultServer.pid},null,2));console.log('FAULT_READY '+origin);ledger.faultBrowserReady=true;save();
 const faultEnd=Date.now()+600000;while(!existsSync(faultStop)&&Date.now()<faultEnd){if(faultServer.exitCode!==null||faultServer.signalCode!==null)throw Error('Fault server stopped unexpectedly');await new Promise(r=>setTimeout(r,1000))}
 if(!existsSync(path.join(evidence,'fault-injection.json')))throw Error('No fault target was injected');
 const after=await contentSnapshot();writeFileSync(path.join(evidence,'browser-content-after.json'),JSON.stringify(after,null,2));ledger.browserContentUnchanged=JSON.stringify(before)===JSON.stringify(after);await stopServer(faultServer);rmSync(loginFile);rmdirSync(loginDir);if(!ledger.browserContentUnchanged)throw Error('Browser modified content');exitCode=0;
 writeFileSync(path.join(evidence,'RUN-COMPLETE.json'),JSON.stringify({runId,integration:ledger.integration,build:ledger.build,browserContentUnchanged:ledger.browserContentUnchanged,completedAt:new Date().toISOString()},null,2));
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







