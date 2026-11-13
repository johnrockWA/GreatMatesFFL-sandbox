const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../../competition/score-status');
const now=Date.parse('2026-11-06T02:00:00Z');
const clockedStatus={...S,describe:(p,o)=>S.describe(p,{...o,now}),render:(p,o)=>S.render(p,{...o,now})};
function fixture(overrides={}){return {round:'round1',scoreSnapshotId:'hash1',scoreState:{schema:1,snapshotId:'hash1',round:'round1',phase:'live',verification:'pending',source:'OfficialAFL',verifier:'AFLTables',coverageComplete:false,finalised:false,correctionPending:false,collectedAt:new Date(now-60000).toISOString(),sourceUpdatedAt:new Date(now-120000).toISOString(),refreshMinutes:5,collectorActive:true,...overrides}};}
test('live, finished pending, disputed, approved final and correction states stay distinct',()=>{
 const variants=[['live',{}],['awaiting-verification',{phase:'finished'}],['held',{phase:'finished',verification:'disputed'}],['correction',{phase:'finished',verification:'verified',correctionPending:true}],['awaiting-finalisation',{phase:'finished',verification:'verified'}],['final',{phase:'finished',verification:'verified',coverageComplete:true,finalised:true}]];
 for(const [expected,meta] of variants){const r=S.describe(fixture(meta),{now,hasScores:true});assert.equal(r.code,expected);assert.equal(r.canDeclareResult,expected==='final');}
});
test('partial coverage, live phase or pending approval cannot declare a winner even with a final flag',()=>{
 for(const overrides of [{coverageComplete:false},{phase:'live'},{verification:'pending'},{correctionPending:true}]){
  const r=S.describe(fixture({phase:'finished',verification:'verified',coverageComplete:true,finalised:true,...overrides}),{now,hasScores:true});assert.equal(r.canDeclareResult,false);
 }
 assert.equal(S.describe(fixture({phase:'finished',verification:'verified',coverageComplete:true,finalised:true}),{now,hasScores:false}).canDeclareResult,false);
 assert.equal(S.describe(fixture({phase:'finished',verification:'verified',coverageComplete:true,finalised:true}),{now,hasScores:true,scoresComplete:false}).canDeclareResult,false);
 assert.equal(S.describe({...fixture({phase:'finished',verification:'verified',coverageComplete:true,finalised:true}),complete:false},{now,hasScores:true}).canDeclareResult,false);
});
test('delayed and paused collection retain provisional scores and show a separate warning',()=>{
 const old=fixture({collectedAt:new Date(now-11*60000).toISOString()});const r=S.describe(old,{now,hasScores:true});assert.equal(r.code,'live');assert.match(r.warnings[0],/Updates delayed/);
 assert.match(S.render({...old,scores:{A:0}},{now,hasScores:true}),/provisional/);
 assert.match(S.describe(fixture({collectorActive:false}),{now}).warnings[0],/Collection paused/);
});
test('old published finals remain final without an irrelevant live freshness warning',()=>{
 const r=S.describe(fixture({phase:'finished',verification:'verified',coverageComplete:true,finalised:true,collectedAt:'2026-03-12T00:00:00Z'}),{now,hasScores:true});assert.equal(r.code,'final');assert.deepEqual(r.warnings,[]);
});
test('unknown/mismatched snapshots, future clocks and unsupported verifiers fail closed',()=>{
 for(const damage of ['snapshot','round','future','missing-time','verifier','schema']){
  const p=fixture();if(damage==='snapshot')p.scoreSnapshotId='different';if(damage==='round')p.round='other';if(damage==='future')p.scoreState.collectedAt=new Date(now+1).toISOString();
  if(damage==='missing-time')p.scoreState.collectedAt=null;if(damage==='verifier')p.scoreState.verifier='Archive';if(damage==='schema')p.scoreState.schema=2;
  const r=S.describe(p,{now,hasScores:true});assert.equal(r.code,'unavailable');assert.equal(r.canDeclareResult,false);
 }
});
test('legacy scores are labelled recorded without inventing verification or live status',()=>{
 assert.equal(S.describe({}, {hasScores:true}).label,'Recorded scores');assert.equal(S.describe({}, {hasScores:true}).canDeclareResult,false);
 assert.equal(S.describe({}, {hasScores:true,legacyComplete:true}).canDeclareResult,true);assert.equal(S.describe({}, {hasScores:false}).label,'Scores pending');
 assert.equal(S.finiteScore(0),true);assert.equal(S.finiteScore(null),false);assert.equal(S.finiteScore('0'),false);
});
test('malicious source strings cannot enter status markup',()=>{
 const p=fixture({source:'<img src=x onerror=alert(1)>'});assert.doesNotMatch(S.render(p,{now}),/<img/);assert.match(S.render(fixture(),{now}),/AWST/);
});
const index=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
test('all app inline scripts parse with the shared state module loaded before them',()=>{
 for(const [,script] of index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script);
 assert(index.indexOf('<script src="competition/score-status.js"></script>')<index.indexOf('async function renderResultsFixtures()'));
});
function runFunction(name,next,context){const start=index.indexOf(name),end=index.indexOf(next,start);assert(start>=0&&end>start);vm.createContext(context);vm.runInContext(index.slice(index.indexOf('const SCORE_STATE_LABELS'),index.indexOf('async function renderResultsFixtures()')),context);vm.runInContext(index.slice(start,end),context);return context;}
test('actual results renderer preserves numeric zero and leaves missing values as dashes',async()=>{
 const card={innerHTML:''},ctx=runFunction('async function renderResultsFixtures()','// ─── FINALS TAB',{state:{fixtures:{currentRound:'Rd01',fixtures:[{round:'Rd01',home:'A',away:'B'}]}},document:{getElementById:()=>card},apiGet:async()=>({scores:{A:0}}),FFLScoreStatus:S,roundDisplay:x=>x});
 await ctx.renderResultsFixtures();assert.match(card.innerHTML,/Recorded scores/);assert.match(card.innerHTML,/fixture-team-score">0</);assert.match(card.innerHTML,/fixture-team-score[^>]*>–</);
});
test('actual finals renderer withholds winners for unverified scores and keeps missing totals empty',()=>{
 const ctx=runFunction('function renderFinalMatch(','// Promote the Finals',{FFLScoreStatus:clockedStatus,formatLockAWST:x=>x});
 const m={...fixture({phase:'finished'}),complete:true,winner:'A',team1:'A',team2:'B',team1Score:2,team2Score:null};
 const html=ctx.renderFinalMatch('Final',m,null,0,0);assert.doesNotMatch(html,/✓/);assert.match(html,/awaiting verification/);assert.match(html,/fixture-team-score[^>]*>–</);
});
test('Grand Final URL parameters cannot crown an unfinished or unverified game',async()=>{
 const card={innerHTML:''},ctx=runFunction('async function renderGrandFinalView(','// ---- animations',{FFLScoreStatus:clockedStatus,gfParams:()=>new URLSearchParams('gfstate=done'),gfShort:x=>x,gfNum:x=>typeof x==='number'?x:null,apiGet:async()=>({hasData:false}),POSITIONS:[],gfRoadFor:()=>[],gfStartAnims:()=>{},formatLockAWST:x=>x});
 await ctx.renderGrandFinalView({bracket:[]},{...fixture({phase:'finished'}),team1:'A',team2:'B',team1Score:10,team2Score:2,winner:'A',complete:true},card,{innerHTML:''});
 assert.doesNotMatch(card.innerHTML,/are Premiers/);assert.match(card.innerHTML,/awaiting verification/);assert.doesNotMatch(card.innerHTML,/Scores update live/);
 assert.doesNotMatch(card.innerHTML,/gf-ribbon/);
});
test('Grand Final does not combine position detail from a different snapshot',async()=>{
 const card={innerHTML:''},ctx=runFunction('async function renderGrandFinalView(','// ---- animations',{FFLScoreStatus:clockedStatus,gfShort:x=>x,gfNum:x=>typeof x==='number'?x:null,apiGet:async()=>({hasData:true,scoreSnapshotId:'older',homeTotal:999,awayTotal:888}),POSITIONS:[],gfRoadFor:()=>[],gfStartAnims:()=>{}});
 await ctx.renderGrandFinalView({bracket:[]},{...fixture(),team1:'A',team2:'B',team1Score:null,team2Score:null,complete:false},card,{innerHTML:''});
 assert.doesNotMatch(card.innerHTML,/999|888|gf-panel-head/);
});
test('shadow projection keeps scores, identity and status in one response and never finalises',()=>{
 const p={source:'OfficialAFL',verifier:'AFLTables',canPublish:false,round:'2026-round-1',season:2026,matches:[{completed:true,sourceUpdatedAt:'2026-03-12T00:00:00Z'}],teams:[{team:'A',total:0}],assessments:[{status:'final-candidate'}],corrections:{approvalRequired:false}};
 const response=S.fromShadow(p,{snapshotId:'h',collectedAt:new Date(now).toISOString()});assert.equal(response.scores.A,0);assert.equal(response.scoreSnapshotId,response.scoreState.snapshotId);assert.equal(response.scoreState.finalised,false);assert.equal(S.describe(response,{now,hasScores:true}).canDeclareResult,false);
 assert.equal(response.scoreState.verifier,'AFLTables');
 p.verifier='FinalSiren';assert.equal(S.fromShadow(p,{snapshotId:'old',collectedAt:new Date(now).toISOString()}).scoreState.verifier,'FinalSiren');
 p.verifier='Archive';assert.throws(()=>S.fromShadow(p,{snapshotId:'h',collectedAt:new Date(now).toISOString()}),/shadow payload/);
});
