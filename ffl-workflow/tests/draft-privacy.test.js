const test=require('node:test'),assert=require('node:assert/strict');
const {E,start,admin,coach,other,fixture,act}=require('./helpers.cjs');
test('coach payload excludes another team working and submitted choices before approval',()=>{
 let s=act(fixture(),'save',{value:{normal:['p20'],fookies:[],delists:[]}},other);
 s=act(s,'submit',{},other);
 for(const now of [start,start+86400000]){
  const v=E.view(s,coach,now);
  assert.deepEqual(Object.keys(v.choices),['a']);assert.equal(v.choices.b,undefined);
  assert.equal(v.locked,null);assert.equal(v.audit,undefined);
  assert.deepEqual(v.submissionProgress,[{team:'a',submitted:false},{team:'b',submitted:true}]);
 }
});
test('committee approval publishes locked choices but never later working edits to other coaches',()=>{
 let s=act(fixture(),'submit',{},coach);
 s=act(s,'save',{value:{normal:['p20'],fookies:[],delists:[]}},other);s=act(s,'submit',{},other);
 s=act(s,'save',{value:{normal:['p21'],fookies:[],delists:[]}},other);
 s=act(s,'prepare',{},admin,start+86400000);
 const v=E.view(s,coach,start+86400000);
 assert.deepEqual(v.locked.b.normal,['p20']);assert.equal(v.choices.b,undefined);
 assert.deepEqual(E.view(s,other,start+86400000).choices.b.working.normal,['p21']);
});
test('queues stay private even from committee audit responses',()=>{
 let s=act(fixture(),'queue',{players:['p1','p2']},other);
 const v=E.view(s,admin,start);assert.equal(v.queues.b,undefined);assert.deepEqual(v.audit,[]);
 assert.deepEqual(E.view(s,other,start).queues.b,['p1','p2']);
});
test('unknown internal fields are excluded from projected responses',()=>{
 const s=fixture();s.internalSecret='top-level-private';s.config.internalSecret='config-private';
 s.players[0].internalSecret='player-private';s.players[0].history.a.internalSecret='history-private';
 s.choices.a.internalSecret='choice-private';s.choices.a.working.internalSecret='selection-private';
 const json=JSON.stringify(E.view(s,coach,start));assert.doesNotMatch(json,/top-level-private|config-private|player-private|history-private|choice-private|selection-private/);
});
test('views are detached from committed state and other views',()=>{
 const s=fixture(),v=E.view(s,coach,start);v.officialSquads.a=[];v.players[0].history.a.retains=99;v.queues.a.push('p2');
 assert.equal(s.officialSquads.a.length,20);assert.equal(s.players[0].history.a.retains,0);assert.deepEqual(E.view(s,coach,start).queues.a,[]);
});
test('a private response requires identity, a recognised role and a real coach team',()=>{
 const s=fixture();assert.throws(()=>E.view(s,null,start),/Authentication/);
 assert.throws(()=>E.view(s,{id:'x',role:'admin',team:'a'},start),/Verified draft role/);
 assert.throws(()=>E.view(s,{id:'x',role:'coach',team:'unknown'},start),/Unknown team/);
 assert.throws(()=>E.view(s,coach,NaN),/Server time/);
});
