const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const P=require('../../competition/official-afl-provider'),{buildPreview}=require('../../competition/official-round-preview'),{createShadowStore}=require('../../competition/shadow-store');
const {correctionPreview}=require('../../competition/correction-preview');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const r=(id,name,jumper,team)=>[id,name,jumper,team,10,10,20,3,0,4,0,0,1,0,'2026-03-12T14:00:00Z'];
 const input={metadata:{id:1,providerId:'CD_M20260140101',season:85,round:1,home:['CD_T1','A',{goals:1,behinds:0,totalScore:6}],away:['CD_T2','B',{goals:1,behinds:0,totalScore:6}],venue:['CD_V1','Ground'],playedAt:'2026-03-12T11:30:00Z',status:'CONCLUDED'},rows:[r('CD_I1','Person A',1,'CD_T1'),r('CD_I2','Person B',2,'CD_T2')]};
 const registry=[{id:'a',name:'Canonical A',archiveName:'Person A',officialPlayerId:'CD_I1',officialNames:['Person A']},{id:'b',name:'Canonical B',archiveName:'Person B',officialPlayerId:'CD_I2',officialNames:['Person B']}];
 const expected={id:'game1',season:2026,home:'A',away:'B',playedAt:'2026-03-12T11:30:00.000Z',venue:'Ground',rowDate:'Mar 12 2026',playerCounts:{A:1,B:1},playerIds:{A:['a'],B:['b']},jumperNumbers:{a:1,b:2},official:{id:1,providerId:'CD_M20260140101',seasonId:85,round:1,homeTeamId:'CD_T1',awayTeamId:'CD_T2',venueId:'CD_V1'}};
 return {input,registry,expected};
}
test('official IDs preserve canonical names and unavailable incumbent rating',()=>{
 const x=fixture(),m=P.normalize(x.input,x.expected,x.registry);
 assert.deepEqual(m.playerIds,['a','b']);assert.equal(m.rows[0][0],'Canonical A');assert.equal(m.rows[0][13],null);
 assert.equal(m.rows[0][12],6);assert.deepEqual(m.unavailableStatistics,['rating']);
});
test('wrong game, season, club, time, venue and completion fail closed',()=>{
 for(const damage of ['id','season','club','time','venue','live']){
  const x=fixture(),m=x.input.metadata;
  if(damage==='id')m.id=2;if(damage==='season')x.expected.season=2025;if(damage==='club')m.home[0]='other';
  if(damage==='time')m.playedAt='2026-03-12T11:31:00Z';if(damage==='venue')m.venue[0]='other';if(damage==='live')m.status='LIVE';
  assert.throws(()=>P.normalize(x.input,x.expected,x.registry),/fixture/);
 }
});
test('unknown IDs, unapproved aliases, wrong jumpers and duplicate players cannot map',()=>{
 for(const damage of ['id','alias','jumper','duplicate']){
  const x=fixture();if(damage==='id')x.input.rows[0][0]='CD_I3';if(damage==='alias')x.input.rows[0][1]='Other A';
  if(damage==='jumper')x.input.rows[0][2]=9;if(damage==='duplicate')x.input.rows[1]=x.input.rows[0];
  assert.throws(()=>P.normalize(x.input,x.expected,x.registry));
 }
});
test('missing, noninteger, negative or inconsistent statistics cannot become zero',()=>{
 for(const value of [null,undefined,'10',-1,1.2]){const x=fixture();x.input.rows[0][4]=value;assert.throws(()=>P.normalize(x.input,x.expected,x.registry),/statistic/);}
 const x=fixture();x.input.rows[0][6]=21;assert.throws(()=>P.normalize(x.input,x.expected,x.registry),/disposal/);
});
test('missing players, unknown clubs, impossible goal totals and timestamps reject',()=>{
 for(const damage of ['coverage','club','goals','date']){
  const x=fixture();if(damage==='coverage')x.input.rows.pop();if(damage==='club')x.input.rows.push([...x.input.rows[0].slice(0,3),'UNKNOWN',...x.input.rows[0].slice(4)]);
  if(damage==='goals')x.input.metadata.home[2].goals=2;if(damage==='date')x.input.rows[0][14]=null;
  assert.throws(()=>P.normalize(x.input,x.expected,x.registry));
 }
});
test('raw website projection checks duplicated source IDs before normalisation',()=>{
 const x=fixture(),person={playerId:'CD_I1',playerName:{givenName:'Person',surname:'A'}};
 const entry={teamId:'CD_T1',player:{jumperNumber:1,player:{player:person}},playerStats:{player:person,teamId:'CD_T1',stats:{},lastUpdated:'2026-03-12T14:00:00Z'}};
 const meta={matches:[{id:1,providerId:x.input.metadata.providerId,compSeason:{id:85},round:{roundNumber:1},home:{team:{providerId:'CD_T1',name:'A'},score:{}},away:{team:{providerId:'CD_T2',name:'B'},score:{}},venue:{providerId:'CD_V1',name:'Ground'},utcStartTime:x.expected.playedAt,status:'CONCLUDED'}]};
 assert.equal(P.project(meta,{homeTeamPlayerStats:[entry],awayTeamPlayerStats:[]}).rows[0][0],'CD_I1');
 entry.playerStats.player={...person,playerId:'CD_I99'};assert.throws(()=>P.project(meta,{homeTeamPlayerStats:[entry],awayTeamPlayerStats:[]}),/identity/);
});
test('closed-round preview uses original scorer while holding unavailable verification',()=>{
 const x=fixture(),manifest={id:'round1',season:2026,closedRound:true,matches:[x.expected]};
 const r=buildPreview(manifest,[x.input],x.registry,[]);assert.equal(r.status,'awaiting-verification');assert.equal(r.canPublish,false);
 assert.equal(r.matches.length,1);assert.equal(r.assessments[0].match,'game1');
 assert.throws(()=>buildPreview({...manifest,closedRound:false},[x.input],x.registry,[]),/closed/);
 assert.throws(()=>buildPreview(manifest,[],x.registry,[]),/closed/);
});
test('AFL Tables agreement verifies only the shadow; disagreement and duplicates fail closed',()=>{
 const x=fixture(),manifest={id:'round1',season:2026,closedRound:true,matches:[x.expected]};
 const verifier={source:'AFLTables',match:P.normalize(x.input,x.expected,x.registry)};
 const r=buildPreview(manifest,[x.input],x.registry,[],{verifierMatches:[verifier]});
 assert.equal(r.status,'verified-shadow');assert.equal(r.verifier,'AFLTables');assert.equal(r.canPublish,false);
 verifier.match.rows[0][7]++;
 const tolerated=buildPreview(manifest,[x.input],x.registry,[],{verifierMatches:[verifier]});
 assert.equal(tolerated.status,'verified-shadow');assert.equal(tolerated.assessments[0].comparison.differences[0].difference,-1);
 assert.deepEqual(tolerated.matches[0],r.matches[0]);
 verifier.match.rows[0][7]++;const held=buildPreview(manifest,[x.input],x.registry,[],{verifierMatches:[verifier]});
 assert.equal(held.status,'held');assert.equal(held.assessments[0].verificationRequired,true);
 assert.throws(()=>buildPreview(manifest,[x.input],x.registry,[],{verifierMatches:[verifier,verifier]}),/Unique/);
 assert.throws(()=>buildPreview(manifest,[x.input],x.registry,[],{verifierMatches:[{source:'AFLTables',match:{id:'unexpected'}}]}),/Unique/);
 verifier.source='FinalSiren';assert.equal(buildPreview(manifest,[x.input],x.registry,[],{verifierMatches:[verifier]}).status,'awaiting-verification');
});
test('historical corrections carry before/after values and team impact without applying them',()=>{
 const x=fixture(),manifest={id:'round1',season:2026,closedRound:true,matches:[x.expected]},nomination={
  starters:Array.from({length:7},(_,i)=>i===6?{name:'Person A',club:'A'}:{name:'Absent '+i,club:'B'}),
  reserves:Array.from({length:7},(_,i)=>({name:'Reserve '+i,club:'B'}))};
 const nominations=[{team:'Example',nomination}],latest=buildPreview(manifest,[x.input],x.registry,nominations),old=clone(latest.matches);
 old[0].rows[0][2]=9;old[0].rows[0][4]=19;const before=JSON.stringify(old);
 const proposal=correctionPreview(manifest,old,latest,x.registry,nominations);
 assert.equal(proposal.statistics.length,2);assert.equal(proposal.teams[0].delta,1);assert.equal(proposal.approvalRequired,true);
 assert.equal(proposal.canPublish,false);assert.equal(proposal.verification,'awaiting-verification');assert.equal(JSON.stringify(old),before);
 assert.throws(()=>correctionPreview(manifest,[],latest,x.registry,nominations),/baseline/);
});
function storage(){
 const records=new Map(),audit=[];let head=null,row=1,mode=null;
 const io={hash:s=>crypto.createHash('sha256').update(s).digest('hex'),readHead:()=>clone(head),readRecord:r=>clone(records.get(r)),
  appendRecord:r=>{records.set(++row,clone(r));return row;},flush:()=>{},withLock:fn=>fn(),
  appendAudit:a=>{if(mode==='audit-fail')throw Error('audit failed');audit.push(clone(a));},writeHead:h=>{if(mode==='before-head')throw Error('write failed');head=clone(h);if(mode==='after-head')throw Error('reply lost');}};
 return {store:createShadowStore(io),records,audit,setMode:v=>{mode=v;}};
}
test('durable stage/readback, duplicate commit and reload retain an immutable snapshot',()=>{
 const x=storage(),a={canPublish:false,value:1},stage=x.store.stage(a);assert.equal(x.store.read(),null);
 assert.equal(x.store.commit(stage,0).revision,1);a.value=99;assert.equal(x.store.read().payload.value,1);
 assert.equal(x.store.commit(x.store.stage({canPublish:false,value:1}),1).changed,false);assert.equal(x.audit.length,1);
});
test('corrupt stage, stale revision and audit/write failure preserve the good head',()=>{
 for(const fault of ['corrupt','stale','audit-fail','before-head']){
  const x=storage();x.store.commit(x.store.stage({v:1}),0);const before=x.store.read(),next=x.store.stage({v:2});
  if(fault==='corrupt')x.records.get(next.row).json='broken';else x.setMode(fault);
  assert.throws(()=>x.store.commit(next,fault==='stale'?0:1));assert.deepEqual(x.store.read(),before);
 }
});
test('lost commit response is recovered by verified readback without another revision',()=>{
 const x=storage(),stage=x.store.stage({v:1});x.setMode('after-head');
 const r=x.store.commit(stage,0);assert.equal(r.responseRecovered,true);assert.equal(x.store.read().revision,1);
});
test('restore publishes a new shadow revision without rewriting older records',()=>{
 const x=storage(),original=x.store.stage({v:1});x.store.commit(original,0);const first=clone(x.records.get(original.row));
 x.store.commit(x.store.stage({v:2}),1);x.store.commit(x.store.stage(x.store.readSnapshot(original.row).payload),2,'recovery-drill');
 assert.equal(x.store.read().revision,3);assert.equal(x.store.read().payload.v,1);assert.deepEqual(x.records.get(original.row),first);
});
