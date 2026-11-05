/* Read-only AFL Tables provider. Explicit fixture/identity mapping; no storage writes.
   Transport is injected. Rating is unavailable, never copied from another source. */
'use strict';
const extract=require('./afltables-extract');
const MONTHS={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
const CLUBS={'Greater Western Sydney':'GWS Giants'};
const VENUES={'M.C.G.':'Melbourne Cricket Ground',Docklands:'Marvel Stadium','Kardinia Park':'GMHBA Stadium','S.C.G.':'Sydney Cricket Ground',Carrara:'People First Stadium'};
const profile=value=>{
 if(typeof value!=='string')throw Error('Untrusted player profile');
 const url=value.startsWith('../../players/')?'https://afltables.com/afl/stats/'+value.slice(6):value;
 if(!/^https:\/\/afltables\.com\/afl\/stats\/players\/[A-Z]\/[A-Za-z0-9_-]+\.html$/.test(url))throw Error('Untrusted player profile');
 return url;
};
function registryIndex(registry){
 const index=new Map(),ids=new Set();
 for(const p of registry){
  if(!p.id||!p.name?.trim()||ids.has(p.id))throw Error('Unique canonical player identity required');
  const key=profile(p.profile);if(index.has(key))throw Error('Duplicate source player profile');
  ids.add(p.id);index.set(key,{id:p.id,name:p.name});
 }
 return index;
}
function normalize(parsed,expected,registry){
 const meta=parsed.scoreTables?.[0]?.[0]?.[1]||'';
 const source=/^Round: (\d+) Venue: (.+?) Date: \w{3}, (\d{2})-(\w{3})-(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)/.exec(meta);
 if(!source||Number(source[1])!==expected.aflTablesRound||Number(source[5])!==expected.season)throw Error('Provider round/date identity mismatch');
 const venue=VENUES[source[2]];if(!venue||venue!==expected.venue)throw Error('Unmapped or mismatched venue');
 if(!Number.isInteger(expected.sourceUtcOffsetMinutes)||!Number.isInteger(expected.playerCounts?.[expected.home])||!Number.isInteger(expected.playerCounts?.[expected.away]))throw Error('Verified fixture time zone and coverage required');
 const month=MONTHS[source[4]],hour=Number(source[6])%12+(source[8]==='PM'?12:0);
 if(!month||Number(source[6])<1||Number(source[6])>12||Number(source[7])>59)throw Error('Invalid source time');
 const kickoff=new Date(Date.UTC(Number(source[5]),month-1,Number(source[3]),hour,Number(source[7]))-expected.sourceUtcOffsetMinutes*60000).toISOString();
 if(kickoff!==expected.playedAt)throw Error('Kickoff instant mismatch');
 const clubs=parsed.teams.map(t=>CLUBS[t.team]||t.team);
 if(clubs.length!==2||clubs[0]!==expected.home||clubs[1]!==expected.away)throw Error('Fixture home/away mismatch');
 const dateToken=source[3]+'-'+source[4]+'-'+source[5];
 if(!parsed.title.includes(dateToken)||!expected.rowDate)throw Error('Match title/row date mismatch');
 const index=registryIndex(registry),rows=[],playerIds=[],sourceProfiles=[],seen=new Set();
 for(const [i,team] of parsed.teams.entries()){
  const club=clubs[i],required=['KI','HB','DI','MK','HO','TK','FF','FA','GL','BH'];
  const roster=expected.playerIds?.[club];
  if(!Array.isArray(roster)||roster.length!==expected.playerCounts[club]||new Set(roster).size!==roster.length)throw Error('Verified canonical match roster required');
  if(JSON.stringify(team.header)!==JSON.stringify(required)||team.players.length!==expected.playerCounts[club])throw Error('Player/statistic coverage mismatch');
  const scoreRow=parsed.scoreTables[0].find(r=>r[0]===team.team);
  if(!scoreRow||scoreRow.length!==5||scoreRow.slice(1).some(v=>!/^\d+\.\d+\.\s*\d+$/.test(v)))throw Error('Four completed quarters required');
  let previous=0;
  for(const text of scoreRow.slice(1)){
   const [goals,behinds,points]=text.split('.').map(Number);
   if(goals*6+behinds!==points||points<previous)throw Error('Invalid quarter score');previous=points;
  }
  const [finalGoals,finalBehinds]=scoreRow[4].split('.').map(Number);let goals=0,behinds=0;
  for(const p of team.players){
   if(p.length!==13||!p[0]?.includes(', ')||!Number.isInteger(p[2])||p.slice(3).some(v=>!Number.isInteger(v)||v<0)||p[3]+p[4]!==p[5])throw Error('Malformed source player/statistics');
   const sourceProfile=profile(p[1]),person=index.get(sourceProfile);
   if(!person||!roster.includes(person.id)||seen.has(person.id))throw Error('Unknown or duplicate canonical player');
   seen.add(person.id);playerIds.push(person.id);sourceProfiles.push(sourceProfile);
   const values=p.slice(3);goals+=values[8];behinds+=values[9];
   rows.push([person.name,club,...values,6*values[8]+values[9],null,clubs[1-i],expected.venue,expected.rowDate]);
  }
  if(goals!==finalGoals||behinds>finalBehinds)throw Error('Player/team goal totals mismatch');
 }
 return {id:expected.id,season:expected.season,home:expected.home,away:expected.away,playedAt:kickoff,completed:true,rows,playerIds,sourceProfiles,
  unavailableStatistics:['rating'],derivedStatistics:{scorePoints:'6*goals+behinds'},provider:'AFLTables',providerRound:Number(source[1])};
}
function createProvider({transport,registry}){
 const frozen=registry.map(p=>({...p}));registryIndex(frozen);
 return {id:'AFLTables',fetch:expected=>{
  const url=expected.aflTablesUrl;
  if(typeof url!=='string'||!/^https:\/\/afltables\.com\/afl\/stats\/games\/\d{4}\/\d{12}\.html$/.test(url))throw Error('Untrusted match URL');
  return transport(url);
 },parse:(body,expected)=>normalize(extract(body),expected,frozen)};
}
module.exports={createProvider,normalize,registryIndex};
