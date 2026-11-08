const test=require('node:test'),assert=require('node:assert/strict');const S=require('../../competition/scraper-pipeline');
const clone=v=>JSON.parse(JSON.stringify(v));
function setup(){
 const expected={id:'m1',season:2026,home:'A',away:'B',playedAt:'2026-03-12T11:30:00Z',playerCounts:{A:1,B:1},venue:'Ground',rowDate:'Mar 12 2026 (Thu 7:30pm)'},manifest={id:'round1',season:2026,matches:[expected]};
 const row=club=>['Player '+club,club,10,10,20,1,0,2,0,0,1,0,0,0,club==='A'?'B':'A','Ground','Mar 12 2026 (Thu 7:30pm)'];
 const match={...expected,completed:true,rows:[row('A'),row('B')]};
 const stages=new Map(),statuses=[];let pointer=null,revision=0,backoffs=0;
 const services={async backoff(){backoffs++;},async stage(p,h){stages.set(h,clone(p));return h;},async readStage(id){return clone(stages.get(id));},async withLock(fn){return fn();},async readPublished(){return clone(pointer);},async commit(p){if(p.expectedRevision!==revision)throw Error('Stale revision');revision++;pointer={hash:p.hash,revision,payload:clone(stages.get(p.stage)),lastSuccessAt:'2026-03-12T15:00:00Z'};return {changed:true,revision};},async recordStatus(s){statuses.push(clone(s));}};
 const provider=id=>({id,async fetch(){return {status:200,body:'html'};},async parse(){return clone(match);}});
 return {expected,manifest,match,services,provider,statuses,get pointer(){return pointer;},get backoffs(){return backoffs;}};
}
test('validated cross-source snapshot publishes once; identical retry is idempotent',async()=>{
 const x=setup(),ps=[x.provider('primary'),x.provider('secondary')];assert.equal((await S.refresh(x.manifest,ps,x.services)).status,'ok');assert.equal(x.pointer.revision,1);
 const r=await S.refresh(x.manifest,ps,x.services);assert.equal(r.committed.changed,false);assert.equal(x.pointer.revision,1);
});
test('timeouts and rate limits retry with bounded backoff',async()=>{
 const x=setup(),a=x.provider('primary');let calls=0;a.fetch=async()=>{calls++;if(calls===1){const e=Error('timeout');e.retryable=true;throw e;}return {status:calls===2?429:200,body:'html'};};
 assert.equal((await S.refresh(x.manifest,[a,x.provider('secondary')],x.services)).status,'ok');assert.equal(calls,3);assert.equal(x.backoffs,2);
});
test('changed HTML, partial team rows, wrong season and duplicate players retain last good data',async()=>{
 for(const failure of ['html','partial','season','duplicate']){
  const x=setup();await S.refresh(x.manifest,[x.provider('a'),x.provider('b')],x.services);const before=JSON.stringify(x.pointer),bad=x.provider('broken');
  bad.parse=async()=>{if(failure==='html')throw Error('Unrecognised match page');const m=clone(x.match);if(failure==='partial')m.rows.pop();if(failure==='season')m.season=2025;if(failure==='duplicate')m.rows[1]=m.rows[0];return m;};
  const r=await S.refresh(x.manifest,[bad,x.provider('backup')],x.services);assert.equal(r.status,'error');assert.equal(JSON.stringify(x.pointer),before);
 }
});
test('official primary wins within tolerance and both values are audit logged',async()=>{
 const x=setup(),verifier=x.provider('verifier');verifier.parse=async()=>{const m=clone(x.match);m.rows[0][10]=0;m.rows[1][10]=2;return m;};
 const result=await S.refresh(x.manifest,[verifier,x.provider('official')],x.services,{primarySourceId:'official'});
 assert.equal(result.status,'ok');assert.equal(x.pointer.payload.matches[0].rows[0][10],1);assert.equal(x.pointer.payload.matches[0].primarySource,'official');
 assert.deepEqual(result.verificationDifferences,[
  {player:'player a|a',source:'verifier',stat:'goals',primaryValue:1,verifierValue:0,signedDifference:-1,match:'m1',primarySource:'official'},
  {player:'player b|b',source:'verifier',stat:'goals',primaryValue:1,verifierValue:2,signedDifference:1,match:'m1',primarySource:'official'}
 ]);
});
test('difference above tolerance blocks publication and records exact values',async()=>{
 const x=setup(),bad=x.provider('verifier');bad.parse=async()=>{const m=clone(x.match);m.rows[0][10]=3;return m;};
 const result=await S.refresh(x.manifest,[x.provider('official'),bad],x.services,{primarySourceId:'official'});
 assert.match(result.error,/exceeds tolerance/);assert.equal(x.pointer,null);assert.deepEqual(result.verificationDifferences,[{player:'player a|a',source:'verifier',stat:'goals',primaryValue:1,verifierValue:3,signedDifference:2}]);
});
test('identity mismatch still blocks publication before tolerance is considered',async()=>{
 const x=setup(),bad=x.provider('verifier');bad.parse=async()=>{const m=clone(x.match);m.rows[0][0]='Different player';return m;};
 assert.match((await S.refresh(x.manifest,[x.provider('official'),bad],x.services,{primarySourceId:'official'})).error,/identity or coverage/);assert.equal(x.pointer,null);
});
test('single-source fallback requires explicit policy',async()=>{
 const y=setup();const r=await S.refresh(y.manifest,[y.provider('backup')],y.services,{requireCrossCheck:false,allowSingleSource:true});assert.equal(r.status,'degraded');assert.equal(y.statuses.at(-1).status,'degraded');
});
test('corrected statistics create a new snapshot without mutating the prior release',async()=>{
 const x=setup();await S.refresh(x.manifest,[x.provider('a'),x.provider('b')],x.services);const prior=x.pointer,before=JSON.stringify(prior);x.match.rows[0][2]=11;x.match.rows[0][4]=21;
 assert.equal((await S.refresh(x.manifest,[x.provider('a'),x.provider('b')],x.services)).status,'ok');assert.equal(x.pointer.revision,2);assert.equal(x.pointer.payload.matches[0].rows[0][4],21);assert.equal(JSON.stringify(prior),before);
});
test('stage corruption, stale lease and failed pointer commit preserve last good release',async()=>{
 for(const failure of ['stage','stale','commit']){
  const x=setup();await S.refresh(x.manifest,[x.provider('a'),x.provider('b')],x.services);const before=JSON.stringify(x.pointer);x.match.rows[0][10]=2;
  if(failure==='stage')x.services.readStage=async()=>({corrupt:true});else x.services.commit=async()=>{throw Error(failure==='stale'?'Stale revision':'Storage failure');};
  const r=await S.refresh(x.manifest,[x.provider('a'),x.provider('b')],x.services);assert.equal(r.status,'error');assert.equal(JSON.stringify(x.pointer),before);
 }
});
test('manifest cannot drop a previously published match or contain duplicate matches',async()=>{
 const x=setup();await S.refresh(x.manifest,[x.provider('a'),x.provider('b')],x.services);const before=JSON.stringify(x.pointer);
 const m={...x.manifest,matches:[{...x.expected,id:'m2'}]},providers=['a','b'].map(id=>({...x.provider(id),parse:async()=>({...clone(x.match),id:'m2'})}));
 assert.match((await S.refresh(m,providers,x.services)).error,/remove/);assert.equal(JSON.stringify(x.pointer),before);
 assert.match((await S.refresh({...x.manifest,matches:[x.expected,x.expected]},providers,x.services)).error,/Duplicate/);
});
test('freshness never treats missing or future success timestamps as healthy',()=>{
 const now=Date.parse('2026-03-12T15:00:00Z');assert.equal(S.freshness(null,now,3600000).status,'missing');assert.equal(S.freshness({lastSuccessAt:'2026-03-12T13:00:00Z'},now,3600000).status,'stale');assert.equal(S.freshness({lastSuccessAt:'2026-03-12T16:00:00Z'},now,3600000).status,'error');
});

test('lost commit response is reported as committed after verified readback, without another publish',async()=>{
 const x=setup(),realCommit=x.services.commit;let calls=0;x.services.commit=async p=>{calls++;await realCommit(p);throw Error('Response lost');};
 const result=await S.refresh(x.manifest,[x.provider('a'),x.provider('b')],x.services);assert.equal(result.publication,'verified-committed');assert.equal(x.pointer.revision,1);
 const retry=await S.refresh(x.manifest,[x.provider('a'),x.provider('b')],x.services);assert.equal(retry.committed.changed,false);assert.equal(calls,1);
});
test('wrong row dates and opponents cannot be hidden by valid match metadata',()=>{
 const x=setup();x.match.rows[0][14]='Other club';assert.throws(()=>S.validateMatch(x.match,x.expected),/opponent/);
});
