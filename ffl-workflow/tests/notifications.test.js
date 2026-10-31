const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../notifications'),{prepared,E,start,act,coach,admin}=require('./helpers.cjs');
const H=3600000,T=start+172800000;
const context=(now=T)=>({draft:prepared(),now,rounds:[]});
test('current-turn in-app alert is immediate; email waits strictly over one hour',()=>{
 const c=context();assert.deepEqual(N.draftAlerts(c.draft,T).map(i=>i.channel),['in-app']);assert.equal(N.draftAlerts(c.draft,T+H).length,1);assert.equal(N.draftAlerts(c.draft,T+H+1)[1].channel,'email');
 const picked=act(c.draft,'pick',{player:'p20',expectedPick:0},coach,T+H+1);
 const alerts=N.draftAlerts(picked,T+H+2);assert.equal(alerts.length,1);assert.equal(alerts[0].team,'b');assert.match(alerts[0].title,/Beta/);
});
test('paused draft and finished picks have no turn notifications',()=>{
 let c=context(T+2*H);c.draft=act(c.draft,'pause',{reason:'Review'},admin,T);assert.deepEqual(N.draftAlerts(c.draft,c.now),[]);
 c=context();c.draft.picks=c.draft.plan.map(p=>({...p,player:'test',at:new Date(T).toISOString()}));assert.deepEqual(N.draftAlerts(c.draft,T+2*H),[]);
});
test('weekly reminder uses three-hour window, skips submitted/unknown and expires at lockout',()=>{
 const lock=T+10*H,rounds=[{id:'round-1',label:'Round 1',lockoutAt:new Date(lock).toISOString(),teams:[{id:'a',name:'Alpha',submitted:false},{id:'b',name:'Beta',submitted:true},{id:'c',name:'Unknown'}]}];
 assert.equal(N.roundEmails(rounds,lock-3*H-1).length,0);assert.equal(N.roundEmails(rounds,lock-3*H).length,1);assert.equal(N.roundEmails(rounds,lock).length,0);
 assert.equal(N.roundEmails([{...rounds[0],cancelled:true}],lock-H).length,0);
});
test('repeated ticks deduplicate and cancel obsolete queued turns',()=>{
 const c=context(T+H+1),once=N.reconcile(null,c);assert.deepEqual(N.reconcile(once,c),once);assert.equal(Object.keys(once.records).length,1);
 c.draft=act(c.draft,'pick',{player:'p20',expectedPick:0},coach,c.now);const after=N.reconcile(once,c);assert.equal(Object.values(after.records)[0].status,'cancelled');
});
test('preview never resolves recipients, saves ledger or sends email',()=>{
 const c=context(T+H+1);const nope=()=>{throw Error('Unexpected side effect');};const out=N.dispatch(null,c,{emailEnabled:false,send:nope,save:nope,readContext:nope,resolveRecipient:nope});assert.equal(Object.values(out.records)[0].status,'queued');
});
test('durable claim precedes mail and accepted send cannot repeat',()=>{
 const c=context(T+H+1);let saved,sends=0;const services={emailEnabled:true,readContext:()=>c,resolveRecipient:()=> 'coach@example.invalid',save:x=>{saved=x;},send:()=>{assert.equal(Object.values(saved.records)[0].status,'attempting');sends++;return {accepted:true,id:'receipt'};}};
 const out=N.dispatch(null,c,services);assert.equal(Object.values(out.records)[0].status,'sent');N.dispatch(out,c,services);assert.equal(sends,1);
});
test('ambiguous delivery and crash after claim are never retried automatically',()=>{
 const c=context(T+H+1);let saved,sends=0;const services={emailEnabled:true,readContext:()=>c,resolveRecipient:()=> 'coach@example.invalid',save:x=>{saved=x;},send:()=>{sends++;throw Error('Timeout after possible send');}};
 const out=N.dispatch(null,c,services);assert.equal(Object.values(out.records)[0].status,'uncertain');N.dispatch(out,c,services);assert.equal(sends,1);
 const claim=structuredClone(out);Object.values(claim.records)[0].status='attempting';N.dispatch(claim,c,services);assert.equal(sends,1);
});
test('submission made after planning cancels the email before delivery',()=>{
 let c={now:T,rounds:[{id:'r',lockoutAt:new Date(T+H).toISOString(),teams:[{id:'a',name:'Alpha',submitted:false}]}]};const out=N.reconcile(null,c);c.rounds[0].teams[0].submitted=true;
 const sent=N.dispatch(out,c,{emailEnabled:true,readContext:()=>c,save(){},resolveRecipient(){throw Error('No recipient lookup expected');}});assert.equal(Object.values(sent.records)[0].status,'cancelled');
});
test('pause then resume restores an unsent reminder without duplicating a sent one',()=>{
 let c=context(T+H+1),out=N.reconcile(null,c);c.draft=act(c.draft,'pause',{reason:'Review'},admin,c.now);out=N.reconcile(out,c);assert.equal(Object.values(out.records)[0].status,'cancelled');
 c.draft=act(c.draft,'resume',{},admin,c.now);out=N.reconcile(out,c);assert.equal(Object.values(out.records)[0].status,'queued');
 Object.values(out.records)[0].status='sent';c.draft=act(c.draft,'pause',{reason:'Review'},admin,c.now);out=N.reconcile(out,c);c.draft=act(c.draft,'resume',{},admin,c.now);assert.equal(Object.values(N.reconcile(out,c).records)[0].status,'sent');
});
test('changed lockout invalidates old queued reminder and waits for new three-hour window',()=>{
 const r={id:'r',lockoutAt:new Date(T+H).toISOString(),teams:[{id:'a',name:'Alpha',submitted:false}]};let c={rounds:[r],now:T};const old=N.reconcile(null,c);r.lockoutAt=new Date(T+10*H).toISOString();assert.equal(Object.values(N.reconcile(old,c).records)[0].status,'cancelled');
 assert.equal(N.roundEmails([r],T+7*H).length,1);assert.notEqual(N.roundEmails([r],T+7*H)[0].id,Object.keys(old.records)[0]);
});
