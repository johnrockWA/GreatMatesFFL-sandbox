const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../../competition/afltables-provider'),extract=require('../../competition/afltables-extract'),S=require('../../competition/scraper-pipeline');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const teams=['Carlton','Richmond'],registry=[],playerIds={},header=['KI','HB','DI','MK','HO','TK','FF','FA','GL','BH'];
 const parsed={title:'AFL Tables - Carlton v Richmond - Thu, 12-Mar-2026 7:30 PM (6:30 PM) - Match Stats',scoreTables:[[['','Round: 2 Venue: M.C.G. Date: Thu, 12-Mar-2026 7:30 PM (6:30 PM) Attendance: 1',''],...teams.map(t=>[t,'5.0. 30','10.0. 60','15.0. 90','23.0. 138'])]],teams:teams.map((team,t)=>{
  playerIds[team]=[];return {team,header,players:Array.from({length:23},(_,i)=>{
   const id='p'+t+'-'+i,profile='https://afltables.com/afl/stats/players/A/Anon_'+t+'_'+i+'.html';
   registry.push({id,name:'Anonymous '+t+' '+i,profile});playerIds[team].push(id);
   return ['Anonymous, '+t+' '+i,profile,i+1,4,4,8,2,0,1,0,0,1,0];
  })};
 })};
 const expected={id:'m1',season:2026,home:teams[0],away:teams[1],venue:'Melbourne Cricket Ground',rowDate:'Mar 12 2026 (Thu 7:30pm)',playedAt:'2026-03-12T08:30:00.000Z',sourceUtcOffsetMinutes:660,aflTablesRound:2,aflTablesUrl:'https://afltables.com/afl/stats/games/2026/031420260312.html',playerCounts:{Carlton:23,Richmond:23},playerIds};
 return {parsed,registry,expected};
}
test('maps explicit provider round, kickoff instant, canonical IDs and derived points',()=>{
 const x=fixture(),m=A.normalize(x.parsed,x.expected,x.registry);S.validateMatch(m,x.expected);
 assert.equal(m.rows.length,46);assert.equal(m.rows[0][12],6);assert.equal(m.rows[0][13],null);assert.deepEqual(m.unavailableStatistics,['rating']);assert.equal(new Set(m.playerIds).size,46);
});
test('unknown or changed identities, duplicate IDs and ambiguous registry entries fail closed',()=>{
 for(const failure of ['unknown','duplicate','foreignRoster','registry']){
  const x=fixture();if(failure==='unknown')x.parsed.teams[0].players[0][1]='../../players/A/Missing.html';
  if(failure==='duplicate')x.parsed.teams[0].players[1][1]=x.parsed.teams[0].players[0][1];
  if(failure==='foreignRoster')x.expected.playerIds.Carlton[0]='other';
  if(failure==='registry')x.registry.push({...x.registry[0],id:'other'});
  assert.throws(()=>A.normalize(x.parsed,x.expected,x.registry),/canonical player|profile/);
 }
});
test('bad fixture round, venue, time zone, home/away, title or quarter totals cannot pass',()=>{
 for(const failure of ['round','venue','timezone','home','date','quarters','score','goals']){
  const x=fixture();if(failure==='round')x.expected.aflTablesRound=1;if(failure==='venue')x.expected.venue='Other';
  if(failure==='timezone')x.expected.sourceUtcOffsetMinutes=600;if(failure==='home')x.expected.home='Other';
  if(failure==='date')x.parsed.title=x.parsed.title.replace('12-Mar','13-Mar');if(failure==='quarters')x.parsed.scoreTables[0][1].pop();
  if(failure==='score')x.parsed.scoreTables[0][1][4]='23.0. 137';if(failure==='goals')x.parsed.teams[0].players[0][11]=0;
  assert.throws(()=>A.normalize(x.parsed,x.expected,x.registry));
 }
});
test('missing scoring fields never inherit the optional rating exception',()=>{
 const x=fixture(),m=A.normalize(x.parsed,x.expected,x.registry);delete m.unavailableStatistics;assert.throws(()=>S.validateMatch(m,x.expected),/statistics/);
 const n=A.normalize(x.parsed,x.expected,x.registry);n.rows[0][2]=null;assert.throws(()=>S.validateMatch(n,x.expected),/statistics/);
 const p=A.normalize(x.parsed,x.expected,x.registry);p.unavailableStatistics.push('kicks');assert.throws(()=>S.validateMatch(p,x.expected),/statistics/);
});
test('challenge pages and malformed source schemas fail extraction',()=>{
 assert.throws(()=>extract('<title>Please sign in</title>'),/TITLE/);
 assert.throws(()=>extract('<title>AFL Tables - A v B - Match Stats</title>'),/TEAMS/);
});
test('HTML extraction and provider parsing preserve source cells and profile IDs',()=>{
 const x=fixture(),row=cells=>'<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
 const html='<title>'+x.parsed.title+'</title><table>'+x.parsed.scoreTables[0].map(row).join('')+'</table>'+x.parsed.teams.map(t=>'<table>'+row([t.team+' Match Statistics'])+row(['#','Player',...t.header])+t.players.map(p=>row([p[2],'<a href="'+p[1]+'">'+p[0]+'</a>',...p.slice(3)])).join('')+'</table>').join('');
 const provider=A.createProvider({registry:x.registry,transport:async()=>({status:200,body:html})});
 const match=provider.parse(html,x.expected);S.validateMatch(match,x.expected);assert.equal(match.playerIds.length,46);assert.equal(match.rows[0][2],4);
 assert.throws(()=>provider.parse(html.replace('<td>KI</td>','<td>?</td>'),x.expected),/HEADERS/);
});
test('fetch uses only the declared public match URL and never forwards credentials',async()=>{
 const x=fixture(),calls=[],p=A.createProvider({registry:x.registry,transport:async url=>{calls.push(url);return {status:403,body:''};}});
 assert.equal((await p.fetch(x.expected)).status,403);assert.deepEqual(calls,[x.expected.aflTablesUrl]);
 for(const u of ['https://other.test/game','https://afltables.com/afl/stats/games/2026/031420260312.html?key=secret'])await assert.rejects(async()=>p.fetch({...x.expected,aflTablesUrl:u}),/Untrusted/);
 assert.equal(calls.length,1);
});
test('real adapter shape disagreement holds publication before staging',async()=>{
 const x=fixture(),match=A.normalize(x.parsed,x.expected,x.registry);const other=clone(match);other.rows[0][7]++;
 const provider=(id,m)=>({id,fetch:async()=>({status:200,body:''}),parse:()=>clone(m)});let stages=0,status;
 const result=await S.refresh({id:'r1',season:2026,matches:[x.expected]},[provider('AFLTables',match),provider('archive',other)],{stage:async()=>{stages++;},recordStatus:async s=>{status=s;}});
 assert.match(result.error,/disagreement/);assert.equal(result.publication,'unchanged');assert.equal(stages,0);assert.equal(status.status,'error');
});
