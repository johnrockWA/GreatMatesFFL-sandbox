const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDraftStore}=require('../draft-store'),{draftActor,authorizeDraftAction}=require('../draft-access');
const {fixture,prepared,coach,other,start,E}=require('./helpers.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function host(){
 const rows=new Map();let head=null,row=2,locked=false,fault=null;
 const io={hash:s=>crypto.createHash('sha256').update(s).digest('hex'),readHead:()=>clone(head),readRecord:n=>clone(rows.get(n)),appendRecord:r=>{rows.set(++row,clone(r));if(fault==='corrupt')rows.get(row).json+='!';return row;},writeHead:h=>{if(fault==='before-head')throw Error('connection lost');head=clone(h);if(fault==='after-head')throw Error('response lost');},flush(){},withLock:fn=>{assert.equal(locked,false);locked=true;try{return fn();}finally{locked=false;}}};
 return {io,store:createDraftStore(io),rows,getHead:()=>clone(head),fault:x=>fault=x};
}
function command(type,revision,id,extra={}){return {type,revision,requestId:id,...extra};}
const grants=[{email:'alpha@example.invalid',role:'coach',teams:[{id:'a',name:'Alpha'},{id:'b',name:'Beta'}],capabilities:[]}];
test('identity registry supports explicitly assigned teams and ignores client roles',()=>{
 const auth={valid:true,email:'ALPHA@example.invalid',team:'Alpha',role:'admin'};
 assert.equal(draftActor(auth,grants,'b').team,'b');assert.equal(draftActor(auth,grants).role,'coach');
 assert.throws(()=>draftActor(auth,grants,'c'),/assigned/);assert.throws(()=>draftActor({...auth,team:'Other'},grants),/not in/);
 assert.throws(()=>draftActor({...auth,email:'unknown@example.invalid'},grants),/Exactly one/);
 assert.throws(()=>draftActor(auth,[...grants,...grants]),/Exactly one/);
});
test('committee powers require explicit action grants; final publication stays disabled',()=>{
 const actor=draftActor({valid:true,email:'owner@example.invalid',team:'Alpha'},[{email:'owner@example.invalid',role:'president',teams:[{id:'a',name:'Alpha'}],capabilities:['pause']}]);
 assert.doesNotThrow(()=>authorizeDraftAction(actor,{type:'pause'}));
 assert.throws(()=>authorizeDraftAction(actor,{type:'override'}),/not been granted/);
 assert.throws(()=>authorizeDraftAction(actor,{type:'finalize'}),/disabled/);
});
test('a new store instance reloads committed state and a repeated click is applied once',()=>{
 const h=host();h.store.initialize(fixture());const a=command('submit',0,'submit-1');
 const first=h.store.dispatch(coach,a,start,E.apply);assert.equal(first.state.revision,1);
 const otherSession=createDraftStore(h.io),repeat=otherSession.dispatch(coach,{requestId:'submit-1',revision:0,type:'submit'},start+1,E.apply);
 assert.equal(repeat.receipt.replayed,true);assert.equal(repeat.receipt.revision,1);assert.equal(repeat.state.audit.length,1);
 assert.deepEqual(otherSession.read().data.state,first.state);
});
test('same identifier cannot be reused for a different action and another coach cannot replay it',()=>{
 const h=host();h.store.initialize(fixture());const a=command('submit',0,'same-id');h.store.dispatch(coach,a,start,E.apply);
 const before=h.getHead();assert.throws(()=>h.store.dispatch(coach,{...a,type:'queue',players:[]},start,E.apply),/already used/);
 assert.throws(()=>h.store.dispatch(other,a,start,E.apply),/draft changed/);assert.deepEqual(h.getHead(),before);
});
test('a late retry returns its original receipt alongside current state without overwriting newer actions',()=>{
 const h=host();h.store.initialize(fixture());const a=command('submit',0,'alpha-submit');h.store.dispatch(coach,a,start,E.apply);
 h.store.dispatch(other,command('submit',1,'beta-submit'),start,E.apply);
 const repeat=h.store.dispatch(coach,a,start+86400000,E.apply);assert.equal(repeat.state.revision,2);assert.equal(repeat.receipt.revision,1);assert.equal(repeat.receipt.replayed,true);
});
test('two stale clients cannot claim the same pick; a current client cannot draft an already-taken player',()=>{
 const h=host(),s=prepared();h.store.initialize({...s,revision:0});const now=start+172800000;
 h.store.dispatch(coach,command('pick',0,'pick-a',{expectedPick:0,player:'p20'}),now,E.apply);
 const before=h.getHead();assert.throws(()=>h.store.dispatch(other,command('pick',0,'pick-b',{expectedPick:0,player:'p20'}),now,E.apply),/draft changed/);
 assert.throws(()=>h.store.dispatch(other,command('pick',1,'pick-b2',{expectedPick:1,player:'p20'}),now,E.apply),/Drafted/);assert.deepEqual(h.getHead(),before);
});
test('stage corruption and a failed pointer write retain the old state',()=>{
 for(const fault of ['corrupt','before-head']){const h=host();h.store.initialize(fixture());const before=h.getHead();h.fault(fault);
 assert.throws(()=>h.store.dispatch(coach,command('submit',0,'submit-a'),start,E.apply));h.fault(null);
 assert.deepEqual(h.getHead(),before);assert.equal(h.store.read().data.state.revision,0);
 }
});
test('response loss after the pointer changes is recovered and a retry does not repeat the action',()=>{
 const h=host();h.store.initialize(fixture());h.fault('after-head');const a=command('submit',0,'submit-a');
 const out=h.store.dispatch(coach,a,start,E.apply);assert.equal(out.receipt.responseRecovered,true);h.fault(null);
 assert.equal(createDraftStore(h.io).dispatch(coach,a,start,E.apply).receipt.replayed,true);assert.equal(h.store.read().data.state.audit.length,1);
});
test('initialisation cannot reset a draft and corrupt committed content cannot be returned',()=>{
 const h=host();h.store.initialize(fixture());assert.throws(()=>h.store.initialize(fixture()),/already initialized/);
 h.rows.get(h.getHead().row).json+='!';assert.throws(()=>h.store.read(),/checksum/);
});
test('unknown request identifiers, wrong-team edits and actions past the lockout cannot save',()=>{
 const h=host();h.store.initialize(fixture());
 assert.throws(()=>h.store.dispatch(coach,{type:'submit',revision:0},start,E.apply),/identifier/);
 assert.throws(()=>h.store.dispatch(coach,command('submit',0,'wrong-team',{team:'b'}),start,E.apply),/own team/);
 assert.throws(()=>h.store.dispatch(coach,command('submit',0,'late'),start+86400000,E.apply),/window is closed/);
 assert.equal(h.store.read().data.state.revision,0);
});
