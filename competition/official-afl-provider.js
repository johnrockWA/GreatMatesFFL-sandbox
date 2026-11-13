/* Official AFL completed-match adapter. No credentials, storage or live publishing. */
'use strict';
const fields=['kicks','handballs','disposals','marks','hitouts','tackles','freesFor','freesAgainst','goals','behinds'];
function project(metadata,statistics){
 if(!Array.isArray(metadata?.matches)||metadata.matches.length!==1)throw Error('Official metadata coverage mismatch');
 const m=metadata.matches[0],rows=[];
 for(const side of ['home','away']){
  const team=m[side]?.team,list=statistics?.[side+'TeamPlayerStats'];
  if(!team?.providerId||!Array.isArray(list))throw Error('Official team/player schema mismatch');
  for(const entry of list){
   const person=entry.playerStats?.player,other=entry.player?.player?.player,stats=entry.playerStats?.stats;
   if(!person?.playerId||person.playerId!==other?.playerId||entry.teamId!==team.providerId||entry.playerStats.teamId!==entry.teamId)throw Error('Official player/team identity mismatch');
   rows.push([person.playerId,person.playerName.givenName+' '+person.playerName.surname,
    entry.player.jumperNumber,entry.teamId,...fields.map(f=>stats?.[f]),entry.playerStats.lastUpdated]);
  }
 }
 return {metadata:{id:m.id,providerId:m.providerId,season:m.compSeason?.id,round:m.round?.roundNumber,
  home:[m.home.team.providerId,m.home.team.name,m.home.score],away:[m.away.team.providerId,m.away.team.name,m.away.score],
  venue:[m.venue?.providerId,m.venue?.name],playedAt:m.utcStartTime,status:m.status},rows};
}
function registryIndex(registry){
 const index=new Map(),canonical=new Set();
 for(const p of registry){
  if(typeof p.id!=='string'||!p.id||typeof p.name!=='string'||!p.name.trim()||!/^CD_I\d+$/.test(p.officialPlayerId)||
   index.has(p.officialPlayerId)||canonical.has(p.id)||!Array.isArray(p.officialNames)||!p.officialNames.length)throw Error('Unique explicit official/canonical player mapping required');
  index.set(p.officialPlayerId,p);canonical.add(p.id);
 }
 return index;
}
function normalize(projected,expected,registry){
 const {metadata:m,rows:input}=projected||{},o=expected?.official;
 if(!o||!m||!Number.isInteger(expected.season)||!m.providerId?.startsWith('CD_M'+expected.season)||m.id!==o.id||m.providerId!==o.providerId||m.season!==o.seasonId||m.round!==o.round||m.status!=='CONCLUDED'||
  !Number.isFinite(Date.parse(m.playedAt))||new Date(m.playedAt).toISOString()!==expected.playedAt||
  m.home?.[0]!==o.homeTeamId||m.away?.[0]!==o.awayTeamId||m.venue?.[0]!==o.venueId)throw Error('Official fixture identity/date/completion mismatch');
 if(!expected.rowDate||!expected.venue||!Array.isArray(input))throw Error('Verified fixture row metadata required');
 const index=registryIndex(registry),seen=new Set(),rows=[],playerIds=[],updates=[];
 for(const [club,side] of [[expected.home,'home'],[expected.away,'away']]){
  const team=m[side],roster=expected.playerIds?.[club],count=expected.playerCounts?.[club],sourceRows=input.filter(r=>r[3]===team[0]);
  if(!Number.isInteger(count)||count<=0||!Array.isArray(roster)||roster.length!==count||new Set(roster).size!==count||sourceRows.length!==count)throw Error('Official match roster coverage mismatch');
  let goals=0,behinds=0;
  for(const r of sourceRows){
   const p=index.get(r[0]);
   if(r.length!==15||!p||!roster.includes(p.id)||seen.has(p.id)||!p.officialNames.includes(r[1])||
    !Number.isInteger(r[2])||expected.jumperNumbers?.[p.id]!==r[2])throw Error('Unknown, duplicate or mismatched official player');
   if(r.slice(4,14).some(v=>!Number.isInteger(v)||v<0)||r[4]+r[5]!==r[6])throw Error('Invalid official statistic/disposal identity');
   if(typeof r[14]!=='string'||!Number.isFinite(Date.parse(r[14])))throw Error('Official source update timestamp required');
   const values=r.slice(4,14);goals+=values[8];behinds+=values[9];seen.add(p.id);playerIds.push(p.id);updates.push(new Date(r[14]).toISOString());
   rows.push([p.name,club,...values,6*values[8]+values[9],null,club===expected.home?expected.away:expected.home,expected.venue,expected.rowDate]);
  }
  const score=team[2];
  if(!score||![score.goals,score.behinds,score.totalScore].every(Number.isInteger)||score.goals<0||score.behinds<0||
   6*score.goals+score.behinds!==score.totalScore||goals!==score.goals||behinds>score.behinds)throw Error('Official player/team score mismatch');
 }
 if(rows.length!==input.length)throw Error('Unknown official club rows');
 return {id:expected.id,season:expected.season,home:expected.home,away:expected.away,playedAt:expected.playedAt,completed:true,
  rows,playerIds,provider:'OfficialAFL',officialMatchId:m.id,sourceUpdatedAt:updates.sort()[updates.length-1],
  unavailableStatistics:['rating'],derivedStatistics:{scorePoints:'6*goals+behinds'}};
}
module.exports={project,normalize,registryIndex};
