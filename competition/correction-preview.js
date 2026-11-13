/* Evidence-only historical correction proposal. Never applies or approves changes. */
'use strict';
const {validateMatch}=require('./scraper-pipeline'),scoring=require('./scoring');
const fields=['K','H','D','M','HO','T','FF','FA','G','B'];
function correctionPreview(manifest,previousMatches,current,registry,nominations){
 if(manifest.closedRound!==true||previousMatches.length!==manifest.matches.length)throw Error('Complete historical baseline required');
 const byId=new Map(registry.map(p=>[p.id,p])),players=new Map(),clubOrder=new Map(),changes=[];
 for(const expected of manifest.matches.slice().sort((a,b)=>a.playedAt.localeCompare(b.playedAt))){
  const old=validateMatch(previousMatches.find(m=>m.id===expected.id),expected),fresh=validateMatch(current.matches.find(m=>m.id===expected.id),expected);
  const newer=new Map(fresh.rows.map(r=>[scoring.identity(r[0],r[1]),r]));
  for(const row of old.rows){
   const candidates=expected.playerIds[row[1]].map(id=>byId.get(id)).filter(p=>p.name===row[0]);
   if(candidates.length!==1)throw Error('Historical canonical identity mismatch');
   const person=candidates[0],next=newer.get(scoring.identity(row[0],row[1]));if(!next)throw Error('Historical roster mismatch');
   const key=scoring.identity(person.archiveName,row[1]);if(players.has(key))throw Error('Duplicate baseline player');
   players.set(key,{K:row[2],H:row[3],D:row[4],M:row[5],HO:row[6],T:row[7],G:row[10],B:row[11]});
   if(!clubOrder.has(row[1]))clubOrder.set(row[1],clubOrder.size);
   for(let i=0;i<fields.length;i++)if(row[i+2]!==next[i+2])changes.push({match:expected.id,playerId:person.id,name:person.name,club:row[1],
    field:fields[i],before:row[i+2],after:next[i+2],affectsScoring:fields[i]!=='FF'&&fields[i]!=='FA'});
  }
 }
 const teams=nominations.map(n=>{
  const before=scoring.resolve(n.nomination,players,clubOrder,{complete:true}),after=current.teams.find(t=>t.team===n.team);if(!after)throw Error('Missing team preview');
  return {team:n.team,before:before.total,after:after.total,delta:after.total-before.total};
 }).filter(t=>t.delta!==0);
 return {status:changes.length?'proposed-not-applied':'unchanged',approvalRequired:changes.some(c=>c.affectsScoring),canPublish:false,
  verification:current.status,statistics:changes,teams};
}
module.exports={correctionPreview};
