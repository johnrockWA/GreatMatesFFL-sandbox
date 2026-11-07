const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../../competition/score-state');

test('zero is retained while a missing score stays missing',()=>{
 assert.equal(S.teamScore({A:0},'A'),0);
 assert.equal(S.teamScore({A:0},'B'),null);
 assert.throws(()=>S.teamScore({A:-1},'A'),/non-negative/);
});

test('only an explicitly verified final may declare a winner',()=>{
 for(const scoreState of ['provisional','awaiting-verification','disputed','correction-pending','collection-paused','recorded']){
  const view=S.matchView({home:'A',away:'B',scores:{A:90,B:80},scoreState});
  assert.equal(view.winner,null,scoreState);assert.equal(view.canDeclareWinner,false,scoreState);
 }
 const final=S.matchView({home:'A',away:'B',scores:{A:90,B:80},scoreState:'verified-final'});
 assert.equal(final.winner,'A');assert.equal(final.canDeclareWinner,true);
});

test('a tied verified final needs an explicit verified winner',()=>{
 const match={home:'A',away:'B',scores:{A:80,B:80},scoreState:'verified-final'};
 assert.throws(()=>S.matchView(match),/explicit verified winner/);
 assert.equal(S.matchView({...match,verifiedWinner:'B'}).winner,'B');
});

test('detail can be combined only from the exact same snapshot',()=>{
 assert.equal(S.sameSnapshot({snapshotId:'one'},{snapshotId:'one'}),true);
 assert.equal(S.sameSnapshot({snapshotId:'one'},{snapshotId:'two'}),false);
 assert.equal(S.sameSnapshot({snapshotId:'one'},{}),false);
});

test('freshness uses the verified success time and retains distinct timestamps',()=>{
 const meta={lastAttemptAt:'2026-11-06T00:02:00Z',lastSuccessAt:'2026-11-06T00:00:00Z',publishedAt:'2026-11-06T00:01:00Z',freshnessMaxAgeMs:3600000};
 const fresh=S.freshnessView(meta,Date.parse('2026-11-06T00:30:00Z'));
 assert.equal(fresh.status,'fresh');assert.equal(fresh.stale,false);assert.equal(fresh.publishedAt,meta.publishedAt);
 const stale=S.freshnessView(meta,Date.parse('2026-11-06T02:00:00Z'));
 assert.equal(stale.status,'stale');assert.equal(stale.stale,true);
 assert.equal(S.freshnessView({...meta,lastSuccessAt:null},Date.parse('2026-11-06T02:00:00Z')).status,'missing');
 assert.equal(S.freshnessView({...meta,lastSuccessAt:'2026-11-06T03:00:00Z'},Date.parse('2026-11-06T02:00:00Z')).status,'error');
});
