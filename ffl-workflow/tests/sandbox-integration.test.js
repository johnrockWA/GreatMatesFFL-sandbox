const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const I=require('../../competition/sandbox-integration'),P=require('../../competition/official-afl-provider'),F=require('../../competition/finals'),R=require('../api/ScoreRead.gs'),S=require('../../competition/score-status'),{createShadowStore}=require('../../competition/shadow-store');
const clone=x=>JSON.parse(JSON.stringify(x));
const now=Date.parse('2026-11-08T01:00:00Z'),at=new Date(now).toISOString();
function fixture(){
 const row=(id,name,team,j)=>[id,name,j,team,10,10,20,3,0,4,0,0,1,0,at];
 const projected=[{metadata:{id:1,providerId:'CD_M20260140101',season:85,round:1,home:['CD_T1','A',{goals:1,behinds:0,totalScore:6}],away:['CD_T2','B',{goals:1,behinds:0,totalScore:6}],venue:['CD_V1','Ground'],playedAt:'2026-03-12T11:30:00Z',status:'CONCLUDED'},rows:[row('CD_I1','Person A','CD_T1',1),row('CD_I2','Person B','CD_T2',2)]}];
 const registry=[{id:'a',name:'Canonical A',archiveName:'Person A',officialPlayerId:'CD_I1',officialNames:['Person A']},{id:'b',name:'Canonical B',archiveName:'Person B',officialPlayerId:'CD_I2',officialNames:['Person B']}];
 const expected={id:'game1',season:2026,home:'A',away:'B',playedAt:'2026-03-12T11:30:00.000Z',venue:'Ground',rowDate:'Mar 12 2026',playerCounts:{A:1,B:1},playerIds:{A:['a'],B:['b']},jumperNumbers:{a:1,b:2},official:{id:1,providerId:'CD_M20260140101',seasonId:85,round:1,homeTeamId:'CD_T1',awayTeamId:'CD_T2',venueId:'CD_V1'}};
 const nomination={starters:Array.from({length:7},(_,i)=>({name:i===6?'Person A':'Absent '+i,club:'A'})),reserves:Array.from({length:7},(_,i)=>({name:'Reserve '+i,club:'B'}))};
 const records=new Map();let head=null,rowNumber=1;
 const store=createShadowStore({hash:s=>crypto.createHash('sha256').update(s).digest('hex'),readHead:()=>clone(head),readRecord:r=>clone(records.get(r)),appendRecord:r=>{records.set(++rowNumber,clone(r));return rowNumber;},flush(){},withLock:fn=>fn(),appendAudit(){},writeHead:h=>head=clone(h)});
 return {manifest:{id:'R1',season:2026,closedRound:true,matches:[expected]},projected,registry,nominations:[{team:'Home',nomination},{team:'Away',nomination}],verifierMatches:[{source:'AFLTables',match:P.normalize(projected[0],expected,registry)}],store,expectedRevision:0,collectedAt:at,fixtures:[{id:'ffl1',home:'Home',away:'Away'}]};
}
test('source comparison, scoring, durable readback and public projection work together without finalising',()=>{
 const x=fixture();x.verifierMatches[0].match.rows[0][7]--;
 const out=I.prepareRound(x);assert.equal(out.status,'verified-shadow');assert.equal(out.canPublish,false);assert.equal(out.response.scores.Home,30);
 assert.equal(out.assessments[0].comparison.differences[0].statistic,'tackles');assert.equal(out.assessments[0].comparison.differences[0].official,4);
 assert.equal(out.response.scoreState.finalised,false);assert.equal(S.describe(out.response,{now,hasScores:true}).canDeclareResult,false);
 const snap=out.publicSnapshot,h={version:1,snapshotId:snap.snapshotId,hash:'checked'};
 const read=R.read({email:'coach@example.invalid',role:'coach',team:'Home'},{loadHead:()=>h,loadSnapshot:()=>snap,hash:()=>h.hash});
 assert.equal(read.snapshotId,out.response.scoreSnapshotId);assert.equal(read.matches[0].scoreState,'awaiting-finalisation');assert.equal(read.matches[0].scores.Home,30);
 assert.equal(read.assessments,undefined);assert.equal(read.matches[0].verificationDifferences,undefined);
 const repeat=I.prepareRound({...x,expectedRevision:1});assert.equal(repeat.commit.changed,false);assert.equal(repeat.commit.revision,1);
});
test('greater discrepancy retains last stored round and never stages a replacement',()=>{
 const x=fixture();I.prepareRound(x);const before=x.store.read();x.verifierMatches[0].match.rows[0][7]+=2;
 let stages=0;const real=x.store.stage;x.store.stage=p=>{stages++;return real(p);};
 const out=I.prepareRound({...x,expectedRevision:1});assert.equal(out.status,'held');assert.equal(out.committed,false);assert.equal(stages,0);assert.deepEqual(x.store.read(),before);
});
test('missing verification can store an explicitly pending preview but cannot advance finals',()=>{
 const x=fixture(),out=I.prepareRound({...x,verifierMatches:[]});assert.equal(out.status,'awaiting-verification');assert.equal(out.publicSnapshot.status,'awaiting-verification');
 assert.throws(()=>I.evaluateVerifiedFinals({seeds:['Home','Away'],matches:[{id:'GF',a:F.seed(1),b:F.seed(2)}],snapshots:{GF:{...out.publicSnapshot,match:{...out.publicSnapshot.matches[0],snapshotId:out.publicSnapshot.snapshotId}}},now}),/verification/);
});
function finalsInput(){
 const scores={EF:{D:70,E:60},QF:{B:80,C:75},SF1:{C:85,D:82},SF2:{A:90,B:88},PF:{C:92,B:89},GF:{A:100,C:98}};
 return {seeds:['A','B','C','D','E'],matches:F.finalFive(),now,snapshots:Object.fromEntries(Object.entries(scores).map(([id,scores])=>[id,{snapshotId:'release1',lastSuccessAt:at,freshnessMaxAgeMs:600000,match:{snapshotId:'release1',home:Object.keys(scores)[0],away:Object.keys(scores)[1],scores,scoreState:'verified-final'}}]))};
}
test('Final Five progresses from paired verified snapshots and keeps source data immutable',()=>{
 const x=finalsInput(),before=JSON.stringify(x);assert.equal(I.evaluateVerifiedFinals(x).champion,'A');assert.equal(JSON.stringify(x),before);
});
test('finals refuses pending, stale, missing-score, mixed-snapshot and correction-pending evidence',()=>{
 for(const fault of ['pending','stale','missing','mixed','correction']){
  const x=finalsInput(),m=x.snapshots.GF;if(fault==='pending')m.match.scoreState='awaiting-verification';if(fault==='stale')m.lastSuccessAt=new Date(now-600001).toISOString();if(fault==='missing')delete m.match.scores.C;if(fault==='mixed')m.snapshotId=m.match.snapshotId='other';if(fault==='correction')m.correctionPending=true;
  assert.throws(()=>I.evaluateVerifiedFinals(x));
 }
});
test('tied final requires matching explicit winner and the incumbent ACPF evidence',()=>{
 const x=finalsInput();x.snapshots.GF.match.scores.C=100;assert.throws(()=>I.evaluateVerifiedFinals(x),/explicit verified winner/);
 x.snapshots.GF.match.verifiedWinner='A';assert.throws(()=>I.evaluateVerifiedFinals(x),/tie policy/);
 x.tiePolicy={rule:'acpf-then-seed',values:{GF:{A:93,C:93}}};assert.equal(I.evaluateVerifiedFinals(x).champion,'A');
 x.snapshots.GF.match.verifiedWinner='C';assert.throws(()=>I.evaluateVerifiedFinals(x),/disagrees/);
});
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
function render(){const ctx=vm.createContext({FFLScoreStatus:S,formatLockAWST:x=>x});vm.runInContext(html.slice(html.indexOf('const SCORE_STATE_LABELS'),html.indexOf('async function renderResultsFixtures()'))+html.slice(html.indexOf('function renderFinalMatch('),html.indexOf('// Promote the Finals')),ctx);return ctx;}
test('actual final renderer honours both status formats and blocks false or incomplete winners',()=>{
 const ctx=render(),base={snapshotId:'release1',scoreState:'verified-final',lastSuccessAt:new Date().toISOString(),freshnessMaxAgeMs:600000,team1:'A',team2:'B',team1Score:0,team2Score:2,complete:true,winner:'A'};
 assert.match(ctx.renderFinalMatch('Final',base,null,0,0),/✓ B/);assert.doesNotMatch(ctx.renderFinalMatch('Final',base,null,0,0),/✓ A/);
 for(const change of [{team1Score:null},{collectionPaused:true},{correctionPending:true},{snapshotId:null},{lastSuccessAt:'2020-01-01T00:00:00Z'}])assert.doesNotMatch(ctx.renderFinalMatch('Final',{...base,...change},null,0,0),/✓/);
 const shadow={...base,scoreSnapshotId:'release1',scoreState:{schema:1,snapshotId:'release1',phase:'finished',verification:'verified',coverageComplete:true,finalised:false,correctionPending:false,collectorActive:false,source:'OfficialAFL',verifier:'AFLTables',collectedAt:new Date().toISOString(),refreshMinutes:5}};
 assert.doesNotMatch(ctx.renderFinalMatch('Final',shadow,null,0,0),/✓/);assert.match(ctx.renderFinalMatch('Final',shadow,null,0,0),/awaiting finalisation/);
});

test('public read bridges into existing round and finals response shapes without inventing final approval',()=>{
 const bridge=require('../../competition/app-score-adapter'),x=fixture(),out=I.prepareRound(x),snapshot=out.publicSnapshot;
 const head={version:1,snapshotId:snapshot.snapshotId,hash:'checked'},read=R.read({email:'c@example.invalid',role:'coach',team:'Home'},{loadHead:()=>head,loadSnapshot:()=>snapshot,hash:()=>head.hash});
 const round=bridge.roundScores(read,'R1');assert.equal(round.scores.Home,30);assert.equal(round.scoreState,'awaiting-finalisation');
 const finals=bridge.finalsResponse(read,{seeds:[],roundMap:[],descriptors:[{matchId:'ffl1',finalName:'Grand Final'}]});
 assert.equal(finals.bracket[0].team1,'Home');assert.equal(finals.bracket[0].complete,false);assert.equal(finals.bracket[0].snapshotId,read.snapshotId);
 assert.throws(()=>bridge.roundScores(read,'missing'),/not in/);
 read.matches.push(clone(read.matches[0]));assert.throws(()=>bridge.roundScores(read,'R1'),/Duplicate/);
});
