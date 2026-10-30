const test=require('node:test'),assert=require('node:assert/strict');
const {E,start,admin,coach,fixture,act,prepared}=require('./helpers.cjs');
test('correction records exact before/after evidence, actor, reason and versions',()=>{
 const original=fixture();const next=act(original,'override',{team:'a',value:{normal:['p2'],fookies:[],delists:[]},reason:'Correct approved omission',requestId:'correction-test-1'},admin,start+86400000);
 const e=next.audit.at(-1);assert.equal(e.type,'override');assert.equal(e.actor,admin.id);assert.equal(e.team,'a');assert.equal(e.reason,'Correct approved omission');
 assert.deepEqual(e.before,original.choices.a);assert.deepEqual(e.after,next.choices.a);
 assert.equal(e.requestId,'correction-test-1');assert.equal(e.ruleVersion,E.ruleVersion);assert.equal(e.softwareVersion,E.softwareVersion);
 assert.equal(e.at,new Date(start+86400000).toISOString());assert.deepEqual(original.audit,[]);
});
test('pick evidence uses the validated turn even when a misleading team is requested',()=>{
 const before=prepared();const s=act(before,'pick',{team:'b',player:'p20',expectedPick:0},coach,start+172800000);
 const e=s.audit.at(-1);assert.equal(e.team,'a');assert.equal(e.before.pick,null);assert.equal(e.after.pick.player,'p20');assert.equal(e.after.pick.team,'a');
});
test('failed requests and stale retries cannot append events or change state',()=>{
 const before=fixture(),snapshot=JSON.stringify(before);
 assert.throws(()=>act(before,'override',{team:'a',value:{normal:['p1'],fookies:[],delists:[]}},coach),/access/);
 assert.equal(JSON.stringify(before),snapshot);
 const s=act(before,'submit',{},coach);
 assert.throws(()=>E.apply(s,{type:'submit',revision:0},coach,start),/changed/);
 assert.equal(s.audit.length,1);
});
test('accepted actions append events while preserving previous evidence',()=>{
 const one=act(fixture(),'save',{value:{normal:['p2'],fookies:[],delists:[]}},coach);
 const first=JSON.stringify(one.audit[0]);const two=act(one,'submit',{},coach);
 assert.equal(two.audit.length,2);assert.equal(JSON.stringify(two.audit[0]),first);assert.notEqual(two.audit[0].eventId,two.audit[1].eventId);
});
test('bad roles, oversized reasons and malformed request identifiers fail closed',()=>{
 const s=fixture();assert.throws(()=>act(s,'submit',{}, {...coach,role:'visitor'}),/Verified/);
 assert.throws(()=>act(s,'submit',{reason:'x'.repeat(1001)},coach),/1000/);
 assert.throws(()=>act(s,'submit',{requestId:'../../bad'},coach),/identifier/);
});
