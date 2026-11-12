const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {E,fixture,start}=require('./helpers.cjs');
test('owner rehearsal preparation preserves submitted choices and refuses changed synthetic data',()=>{
 const initial=JSON.parse(JSON.stringify(fixture()).replaceAll('"a"','"7"').replaceAll('"b"','"test-opponent"'));
 let state=E.apply(initial,{type:'submit',revision:0},{id:'owner-test',role:'coach',team:'7'},start),writes=0;
 const c={FFLDraft:E,Date:{now:()=>start},JSON,Utilities:{getUuid:()=>String(++writes)},Logger:{log(){}},
  fflOwnerSharedAssert_:()=>({id:'owner-test',team:'7'}),fflOwnerSharedFingerprint_:()=> 'unchanged',
  fflOwnerSharedInitial_:()=>JSON.parse(JSON.stringify(initial)),
  draftWorkflowStore_:()=>({read:()=>({data:{state}}),dispatch:(u,a,t,apply)=>({state:state=apply(state,a,u,t)})})};
 c.Date=class extends Date{static now(){return start;}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../rehearsal/PrepareOwnerPicks.gs'),'utf8'),c);
 const submitted=JSON.stringify(state.choices['7'].submitted),official=JSON.stringify(state.officialSquads);
 const result=c.fflPrepareOwnerPicks_();assert.equal(result.phase,'drafting');assert.equal(state.picks.length,0);
 assert.equal(JSON.stringify(state.choices['7'].submitted),submitted);assert.equal(JSON.stringify(state.officialSquads),official);
 const revision=state.revision;c.fflPrepareOwnerPicks_();assert.equal(state.revision,revision);
 state.players[0].name='Unexpected player';assert.throws(()=>c.fflPrepareOwnerPicks_(),/Unexpected rehearsal data/);
});
