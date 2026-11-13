const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createSharedDraftClient}=require('../shared-client'),{createDraftService}=require('../draft-service'),{draftActor,authorizeDraftAction}=require('../draft-access'),{createDraftStore}=require('../draft-store'),{fixture,start,prepared,E}=require('./helpers.cjs');
const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
function host(initial=fixture()){
 let pointer=null,row=2,operationalWrites=false;const records=new Map();
 const store=createDraftStore({hash:s=>crypto.createHash('sha256').update(s).digest('hex'),readHead:()=>copy(pointer),readRecord:r=>copy(records.get(r)),appendRecord:r=>{records.set(++row,copy(r));return row;},writeHead:p=>pointer=copy(p),flush(){},withLock:fn=>fn()});store.initialize({...initial,revision:0});
 const grants=[{email:'a@example.invalid',role:'coach',teams:[{id:'a',name:'Alpha'}],capabilities:[]},{email:'b@example.invalid',role:'coach',teams:[{id:'b',name:'Beta'}],capabilities:[]},{email:'owner@example.invalid',role:'commissioner',teams:[{id:'a',name:'Alpha'}],capabilities:['prepare','arm']}];
 const tokens={alpha:{valid:true,email:'a@example.invalid',team:'Alpha'},beta:{valid:true,email:'b@example.invalid',team:'Beta'},owner:{valid:true,email:'owner@example.invalid',team:'Alpha'}};
 let clock=start;const principal=a=>a.id;
 const actor=(auth,team)=>draftActor(auth,grants,team);
 function view(auth,team){const a=actor(auth,team),v=E.view(store.read().data.state,a.capabilities.includes('review')?a:{...a,role:'coach'},clock);return {...v,serverNow:new Date(clock).toISOString(),instanceId:'test-instance',principalKey:principal(a),managedTeams:a.managedTeams,managingTeam:a.team,actorRole:a.role,committeeCapabilities:a.capabilities};}
 const service=createDraftService({assertEnvironment(){assert.equal(operationalWrites,false);},validateToken:t=>tokens[t]||{valid:false},actor,instance:()=> 'test-instance',principalKey:principal,authorize:authorizeDraftAction,assertWrites(){},read:view,write(auth,command,team){const a=actor(auth,team);const out=store.dispatch(a,command,clock,(s,command,who,now)=>{try{authorizeDraftAction(who,command,s);return E.apply(s,command,who,now);}catch(e){e.code='DRAFT_REJECTED';throw e;}});return {...view(auth,team),receipt:out.receipt};}});
 return {service,store,grants,tokens,clock:x=>clock=x};
}
function client(h,token='alpha',extra={}){
 const saved=new Map();let n=0,active=token;const requests=[];
 const options={instanceId:'test-instance',token:()=>active,requestId:()=>token+'-'+(++n),storage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},send:async body=>{requests.push(copy(body));return h.service(body);},...extra};
 return {c:createSharedDraftClient(options),options,requests,saved,token:x=>active=x};
}
test('two client sessions share submitted state without disclosing private working choices',async()=>{
 const h=host(),a=client(h),b=client(h,'beta');await a.c.refresh();await b.c.refresh();
 await a.c.dispatch('save',{value:{normal:['p0'],fookies:[],delists:[]}});await a.c.dispatch('submit');await b.c.refresh();
 assert.equal(b.c.snapshot().view.submissionProgress[0].submitted,true);assert.equal(b.c.snapshot().view.choices.a,undefined);assert.equal(a.c.snapshot().receipt.revision,2);
 await a.c.dispatch('save',{value:{normal:['p1'],fookies:[],delists:[]}});
 assert.deepEqual(a.c.snapshot().view.choices.a.submitted.normal,['p0']);assert.deepEqual(a.c.snapshot().view.choices.a.working.normal,['p1']);
});
test('lost reply survives new client instance and recovers the identical request exactly once',async()=>{
 const h=host(),a=client(h);await a.c.refresh();let lost=true;
 a.options.send=async body=>{a.requests.push(copy(body));const result=h.service(body);if(body.action==='writeDraftWorkflow'&&lost){lost=false;throw Error('Connection dropped after save');}return result;};
 await assert.rejects(a.c.dispatch('submit'),/dropped/);const pending=a.c.snapshot().pending;assert.ok(pending);assert.equal(h.store.read().data.state.revision,1);
 const resumed=createSharedDraftClient(a.options);await resumed.refresh();assert.deepEqual(resumed.snapshot().pending,pending);
 await resumed.retry();assert.equal(resumed.snapshot().receipt.replayed,true);assert.equal(resumed.snapshot().pending,null);assert.equal(h.store.read().data.state.revision,1);assert.equal(h.store.read().data.state.audit.length,1);
});
test('simultaneous source-client attempts at one pick produce one acceptance and one stale rejection',async()=>{
 const h=host(prepared());h.clock(start+172800000);const a=client(h),b=client(h,'alpha',{requestId:()=> 'other-tab-pick'});await a.c.refresh();await b.c.refresh();
 const results=await Promise.allSettled([a.c.dispatch('pick',{player:'p20',expectedPick:0}),b.c.dispatch('pick',{player:'p21',expectedPick:0})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(h.store.read().data.state.picks.length,1);assert.equal(h.store.read().data.state.audit.filter(a=>a.type==='pick').length,1);
 // This is a source-level serialized host, not simultaneous Apps Script execution.
});
test('stale confirmation, expired window, wrong team and elevated client role cannot save',async()=>{
 const h=host(),a=client(h),b=client(h,'beta');await a.c.refresh();await b.c.refresh();await b.c.dispatch('submit');
 await assert.rejects(a.c.dispatch('submit'),/draft changed/);assert.equal(a.c.snapshot().pending,null);assert.equal(a.c.snapshot().stale,true);
 await a.c.refresh();await assert.rejects(a.c.dispatch('save',{team:'b',role:'commissioner',value:{normal:[],fookies:[],delists:[]}}),/own team/);
 await a.c.refresh();h.clock(start+86400000);await assert.rejects(a.c.dispatch('submit'),/closed/);assert.equal(h.store.read().data.state.revision,1);
});
test('changed signed-in principal is blocked before writing a stored pending action',async()=>{
 const h=host(),a=client(h);await a.c.refresh();const original=a.options.send;a.options.send=async body=>{if(body.action==='writeDraftWorkflow')throw Error('offline');return original(body);};
 await assert.rejects(a.c.dispatch('submit'));h.tokens.other={valid:true,email:'other@example.invalid',team:'Alpha'};h.grants.push({email:'other@example.invalid',role:'coach',teams:[{id:'a',name:'Alpha'}],capabilities:[]});a.token('other');a.options.send=original;
 await assert.rejects(a.c.retry(),/signed-in coach changed/);assert.equal(h.store.read().data.state.revision,0);
});
test('pending actions block double clicks and cannot cross teams; other coach cannot recover them',async()=>{
 const h=host(),a=client(h);await a.c.refresh();const original=a.options.send;a.options.send=async body=>{if(body.action==='writeDraftWorkflow')throw Error('offline');return original(body);};await assert.rejects(a.c.dispatch('submit'));
 await assert.rejects(a.c.dispatch('queue',{players:[]}),/pending/);await assert.rejects(a.c.refresh('b'),/separate/);
 const b=client(h,'beta',{storage:a.options.storage});await b.c.refresh();assert.equal(b.c.snapshot().pending,null);assert.equal(h.store.read().data.state.revision,0);
});
test('storage failure and malformed success cannot masquerade as a saved action',async()=>{
 const h=host();
 const b=client(h,'alpha',{storage:{getItem:()=>null,setItem(){throw Error('full');},removeItem(){}}});await b.c.refresh();await assert.rejects(b.c.dispatch('submit'),/No request was sent/);assert.equal(h.store.read().data.state.revision,0);
 const c=client(h);await c.c.refresh();c.options.send=async body=>{const result=h.service(body);if(body.action==='writeDraftWorkflow')delete result.view.receipt;return result;};await assert.rejects(c.c.dispatch('submit'),/matching receipt/);assert.ok(c.c.snapshot().pending);assert.equal(h.store.read().data.state.revision,1);
});
test('committee review and proxy picks each need an explicit grant',async()=>{
 const h=host(prepared());h.clock(start+172800000);h.grants[2].teams=[{id:'b',name:'Beta'}];h.tokens.owner.team='Beta';const owner=client(h,'owner');await owner.c.refresh();assert.equal(owner.c.snapshot().view.choices.a,undefined);
 await assert.rejects(owner.c.dispatch('pick',{player:'p20',expectedPick:0,reason:'Proxy pick'}),/not been granted/);assert.equal(h.store.read().data.state.picks.length,0);
 h.grants[2].capabilities.push('review','proxyPick');await owner.c.refresh();assert.ok(owner.c.snapshot().view.choices.a);await owner.c.dispatch('pick',{player:'p20',expectedPick:0,reason:'Proxy pick'});assert.equal(h.store.read().data.state.picks.length,1);
});
test('failed reads disable edits while preserving the last checked state',async()=>{
 const h=host(),a=client(h);await a.c.refresh();a.options.send=async()=>{throw Error('disconnected');};await assert.rejects(a.c.refresh(),/disconnected/);assert.ok(a.c.snapshot().view);assert.equal(a.c.snapshot().stale,true);await assert.rejects(a.c.dispatch('submit'),/Refresh/);
});
test('unconfirmed storage failure retains request; malformed auth and instance fail before reads',()=>{
 let read=0,write=0;
 const s=createDraftService({assertEnvironment(){},validateToken:t=>t?{valid:true}:null,actor:()=>({team:'a'}),instance:()=> 'instance',principalKey:()=> 'principal',authorize(){},assertWrites(){},read(){read++;return {};},write(){write++;throw Error('storage failure');}});
 assert.equal(s({action:'readDraftWorkflow'}).code,'AUTH_REQUIRED');assert.equal(s({action:'readDraftWorkflow',token:'yes',instanceId:'wrong'}).code,'REJECTED');assert.equal(read,0);
 assert.equal(s({action:'writeDraftWorkflow',token:'yes',instanceId:'instance',principalKey:'principal'}).code,'UNCONFIRMED');assert.equal(write,1);
});

test('failed receipt cleanup keeps the accepted request recoverable without a second write',async()=>{
 const h=host(),a=client(h);await a.c.refresh();const remove=a.options.storage.removeItem;let fail=true;
 a.options.storage.removeItem=k=>{if(fail)throw Error('Browser recovery storage unavailable');remove(k);};
 await assert.rejects(a.c.dispatch('submit'),/storage unavailable/);assert.ok(a.c.snapshot().pending);assert.equal(h.store.read().data.state.revision,1);
 fail=false;await a.c.retry();assert.equal(a.c.snapshot().pending,null);assert.equal(a.c.snapshot().receipt.replayed,true);assert.equal(h.store.read().data.state.revision,1);
});

test('a timed-out accepted write recovers its receipt while late replies cannot change the client',async()=>{
 const h=host(),a=client(h,'alpha',{timeoutMs:5});await a.c.refresh();const send=a.options.send;let resolve;
 a.options.send=body=>new Promise(done=>{const result=h.service(body);resolve=()=>done(result);});
 await assert.rejects(a.c.dispatch('submit'),/timed out/);assert.equal(h.store.read().data.state.revision,1);assert.ok(a.c.snapshot().pending);
 a.options.send=send;await a.c.retry();resolve();await Promise.resolve();assert.equal(a.c.snapshot().receipt.replayed,true);assert.equal(a.c.snapshot().pending,null);assert.equal(h.store.read().data.state.revision,1);
});

test('background reads leave actions usable and cannot overwrite a newer write receipt',async()=>{
 const h=host(),a=client(h);await a.c.refresh();const send=a.options.send;let finish;
 a.options.send=body=>body.action==='readDraftWorkflow'?new Promise(resolve=>{const old=h.service(body);finish=()=>resolve(old);}):send(body);
 const poll=a.c.refresh(undefined,{background:true});
 assert.equal(a.c.snapshot().refreshing,true);assert.equal(a.c.snapshot().busy,false);
 await a.c.dispatch('queue',{players:['p20']});
 assert.equal(a.c.snapshot().view.revision,1);assert.equal(a.c.snapshot().receipt.revision,1);
 finish();await poll;
 assert.equal(a.c.snapshot().view.revision,1);assert.deepEqual(a.c.snapshot().view.queues.a,['p20']);
 assert.equal(a.c.snapshot().stale,false);assert.match(a.c.snapshot().message,/Saved centrally/);
});
test('a superseded background failure cannot disable a successful write',async()=>{
 const h=host(),a=client(h);await a.c.refresh();const send=a.options.send;let fail;
 a.options.send=body=>body.action==='readDraftWorkflow'?new Promise((resolve,reject)=>{fail=reject;}):send(body);
 const poll=a.c.refresh(undefined,{background:true});await a.c.dispatch('submit');
 fail(Error('Old read disconnected'));await poll;
 assert.equal(a.c.snapshot().stale,false);assert.equal(a.c.snapshot().pending,null);assert.equal(a.c.snapshot().receipt.revision,1);
});
test('background authentication failure hides private state and blocks writes',async()=>{
 const h=host(),a=client(h);await a.c.refresh();delete h.tokens.alpha;
 await assert.rejects(a.c.refresh(undefined,{background:true}));
 assert.equal(a.c.snapshot().authRequired,true);assert.equal(a.c.snapshot().stale,true);
 await assert.rejects(a.c.dispatch('submit'),/Refresh/);assert.equal(h.store.read().data.state.revision,0);
});
test('only one read runs at a time and foreground refresh still blocks writes',async()=>{
 const h=host(),a=client(h);await a.c.refresh();const send=a.options.send;let finish;
 a.options.send=body=>new Promise(resolve=>{finish=()=>resolve(h.service(body));});
 const poll=a.c.refresh(undefined,{background:true});
 await assert.rejects(a.c.refresh(undefined,{background:true}),/Wait/);finish();await poll;
 const refresh=a.c.refresh();assert.equal(a.c.snapshot().busy,true);
 await assert.rejects(a.c.dispatch('submit'),/pending request/);finish();await refresh;
 a.options.send=send;await a.c.dispatch('submit');assert.equal(a.c.snapshot().view.revision,1);
});
test('a background read cannot clear an in-flight write or its recovery record',async()=>{
 const h=host(),a=client(h);await a.c.refresh();let finishRead,finishWrite;
 a.options.send=body=>new Promise(resolve=>{const result=h.service(body);if(body.action==='readDraftWorkflow')finishRead=()=>resolve(result);else finishWrite=()=>resolve(result);});
 const poll=a.c.refresh(undefined,{background:true});const write=a.c.dispatch('submit');
 finishRead();await poll;assert.equal(a.c.snapshot().busy,true);assert.ok(a.c.snapshot().pending);
 finishWrite();await write;assert.equal(a.c.snapshot().busy,false);assert.equal(a.c.snapshot().pending,null);
});
test('acknowledged sign-out discards private state and ignores an in-flight old session read',async()=>{
 const h=host(),a=client(h);await a.c.refresh();let resolve;
 a.options.send=body=>new Promise(r=>{resolve=()=>r(h.service(body));});
 const old=a.c.refresh(undefined,{background:true});a.c.signedOut();resolve();await old;
 assert.equal(a.c.snapshot().view,null);assert.equal(a.c.snapshot().authRequired,true);assert.equal(a.c.snapshot().refreshing,false);
 a.options.send=async body=>h.service(body);a.token('beta');await a.c.refresh();assert.equal(a.c.snapshot().view.managingTeam,'b');
});
