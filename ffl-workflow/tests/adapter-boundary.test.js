const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture,start}=require('./helpers.cjs');
const {prepared,E}=require('./helpers.cjs');
const {createSharedDraftClient}=require('../shared-client');
const {createDraftStore}=require('../draft-store');
const {createDraftService}=require('../draft-service');
const grant={email:'coach@example.invalid',teams:[{id:'a',name:'Alpha'}],role:'coach',capabilities:[]};
function adapter(grants=[]){
 const props={FFL_DRAFT_IDENTITIES:JSON.stringify(grants)},c={Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,s)=>s,base64EncodeWebSafe:s=>'key-'+s},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null})}};vm.createContext(c);
 for(const name of ['draft-engine.js','notifications.js','draft-store.js','draft-access.js','api/DraftWorkflow.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),c);
 return c;
}
test('real adapter recovers a lost pick reply after another identity advances the turn exactly once',async()=>{
 const second={email:'second@example.invalid',teams:[{id:'b',name:'Beta'}],role:'coach',capabilities:[]};
 const c=adapter([grant,second]);c.Date=class extends Date{static now(){return start+172800000;}};
 let head=null,row=2;const rows=new Map(),copy=x=>JSON.parse(JSON.stringify(x));
 const store=createDraftStore({hash:s=>require('node:crypto').createHash('sha256').update(s).digest('hex'),readHead:()=>copy(head),readRecord:r=>copy(rows.get(r)),appendRecord:r=>{rows.set(++row,copy(r));return row;},writeHead:h=>head=copy(h),flush(){},withLock:fn=>fn()});
 store.initialize({...prepared(),revision:0});c.draftWorkflowStore_=()=>store;c.draftWorkflowAssertWrites_=()=>{};
 c.draftWorkflowResponse_=function(state,actor,now){return {...E.view(state,actor,now),instanceId:'test',principalKey:actor.id,managingTeam:actor.team,managedTeams:actor.managedTeams,serverNow:new Date(now).toISOString()};};
 const tokens={a:{valid:true,email:grant.email,team:'Alpha'},b:{valid:true,email:second.email,team:'Beta'}};
 const service=createDraftService({assertEnvironment(){},validateToken:t=>tokens[t],actor:c.draftWorkflowActor_,instance:()=> 'test',principalKey:a=>a.id,authorize:c.authorizeDraftAction,assertWrites(){},read:c.getDraftWorkflow_,write:c.postDraftWorkflow_});
 const saved=new Map();let lost=true;
 const options={instanceId:'test',token:()=> 'a',requestId:()=> 'lost-pick',storage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},send:async p=>{const result=service(p);if(p.action==='writeDraftWorkflow'&&lost){lost=false;throw Error('Reply lost after commit');}return result;}};
 const a=createSharedDraftClient(options);await a.refresh();await assert.rejects(a.dispatch('pick',{player:'p20',expectedPick:0}),/Reply lost/);
 assert.equal(store.read().data.state.picks.length,1);
 // Stale pick gets a useful message; a current wrong-team pick is still denied.
 assert.throws(()=>c.postDraftWorkflow_(tokens.a,{type:'pick',revision:0,requestId:'stale',player:'p21',expectedPick:0}),/review the current turn/);
 assert.throws(()=>c.postDraftWorkflow_(tokens.a,{type:'pick',revision:1,requestId:'wrong-turn',player:'p21',expectedPick:1}),/not been granted/);
 const bv=c.getDraftWorkflow_(tokens.b);assert.equal(bv.choices.a,undefined);assert.equal(bv.queues.a,undefined);
 c.postDraftWorkflow_(tokens.b,{type:'pick',revision:1,requestId:'second-pick',player:'p0',expectedPick:1});
 const resumed=createSharedDraftClient(options);await resumed.refresh();assert.ok(resumed.snapshot().pending);await resumed.retry();
 assert.equal(resumed.snapshot().receipt.replayed,true);assert.equal(resumed.snapshot().receipt.revision,1);assert.equal(resumed.snapshot().view.revision,2);
 assert.equal(store.read().data.state.picks.length,2);assert.equal(store.read().data.state.audit.filter(x=>x.type==='pick').length,2);assert.equal(saved.size,0);
});
test('missing explicit identity mappings fail closed',()=>{
 const c=adapter();assert.throws(()=>c.draftWorkflowActor_({valid:true,email:'coach@example.invalid',team:'Alpha'}),/verified coach mapping/);
 assert.throws(()=>c.draftWorkflowActor_({valid:false,email:'coach@example.invalid',team:'Alpha'}),/Authenticated/);
});
test('legacy client role cannot grant committee powers',()=>{
 assert.equal(adapter([grant]).draftWorkflowActor_({valid:true,email:'coach@example.invalid',team:'Alpha',role:'admin'}).role,'coach');
});
test('adapter read returns only the managing team private projection',()=>{
 const c=adapter([grant]);c.draftWorkflowStore_=()=>({read:()=>({data:{state:fixture()}})});c.Date=class extends Date {static now(){return start;}};
 const v=c.getDraftWorkflow_({valid:true,email:'coach@example.invalid',team:'Alpha'});
 assert.equal(v.choices.b,undefined);assert.equal(v.audit,undefined);assert.equal(v.managingTeam,'a');
});
test('finalisation is blocked before storage even for an explicitly granted Commissioner',()=>{
 const c=adapter([{...grant,role:'commissioner'}]);let read=false;c.draftWorkflowStore_=()=>{read=true;throw Error('Storage must not be read');};
 assert.throws(()=>c.postDraftWorkflow_({valid:true,email:'coach@example.invalid',team:'Alpha'},{type:'finalize'}),/Finalization is disabled/);assert.equal(read,false);
});
test('adapter writes consult the write gate before opening storage',()=>{
 const c=adapter([grant]);let opened=false;c.draftWorkflowAssertWrites_=()=>{throw Error('Writes disabled');};c.draftWorkflowStore_=()=>{opened=true;};
 assert.throws(()=>c.postDraftWorkflow_({valid:true,email:'coach@example.invalid',team:'Alpha'},{type:'submit'}),/Writes disabled/);assert.equal(opened,false);
});

test('isolated draft write gate refuses the wrong project, an absent grant, and operational writes',()=>{
 const c=adapter(),props={FFL_DRAFT_PROJECT_ID:'development-project',FFL_DRAFT_WRITES_ENABLED:'true',FFL_SANDBOX_WRITES_ENABLED:'false'};
 c.sandboxAssertProject_=()=>{};let project='development-project';c.ScriptApp={getScriptId:()=>project};c.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]})};
 assert.doesNotThrow(()=>c.draftWorkflowAssertWrites_());delete props.FFL_DRAFT_PROJECT_ID;assert.throws(()=>c.draftWorkflowAssertWrites_(),/disabled/);props.FFL_DRAFT_PROJECT_ID='development-project';project='different';assert.throws(()=>c.draftWorkflowAssertWrites_(),/disabled/);project='development-project';
 props.FFL_DRAFT_WRITES_ENABLED='false';assert.throws(()=>c.draftWorkflowAssertWrites_(),/disabled/);props.FFL_DRAFT_WRITES_ENABLED='true';props.FFL_SANDBOX_WRITES_ENABLED='true';assert.throws(()=>c.draftWorkflowAssertWrites_(),/disabled/);
});
test('a committee role does not itself disclose private selections or queues',()=>{
 const c=adapter([{...grant,role:'president',capabilities:['pause']}]);c.draftWorkflowStore_=()=>({read:()=>({data:{state:fixture()}})});
 let v=c.getDraftWorkflow_({valid:true,email:grant.email,team:'Alpha'});assert.equal(v.choices.b,undefined);assert.equal(v.audit,undefined);
 const reviewed=adapter([{...grant,role:'president',capabilities:['review']}]);reviewed.draftWorkflowStore_=c.draftWorkflowStore_;v=reviewed.getDraftWorkflow_({valid:true,email:grant.email,team:'Alpha'});assert.ok(v.choices.b);assert.equal(v.queues.b,undefined);
});

test('storage opens its sheet under the lock for every operation, never before waiting',()=>{
 const c=adapter();let held=false,opens=0,failOpen=false;const calls=[];
 c.LockService={getScriptLock:()=>({waitLock(){assert.equal(held,false);held=true;calls.push('lock');},releaseLock(){assert.equal(held,true);held=false;calls.push('release');}})};
 c.draftWorkflowSheet_=()=>{assert.equal(held,true);opens++;calls.push('open');if(failOpen)throw Error('Sheet unavailable');return {getRange:cell=>({getValue(){assert.equal(held,true);assert.equal(cell,'B1');return '';}})};};
 const store=c.draftWorkflowStore_();assert.equal(opens,0);
 assert.equal(store.read(),null);assert.equal(store.read(),null);
 assert.deepEqual(calls,['lock','open','release','lock','open','release']);assert.equal(opens,2);
 failOpen=true;assert.throws(()=>store.read(),/Sheet unavailable/);assert.equal(held,false);
});
