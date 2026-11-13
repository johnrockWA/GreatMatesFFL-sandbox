/* Complete-round development preview: validated source, existing scoring, no final publication. */
'use strict';
const provider=require('./official-afl-provider'),scoring=require('./scoring'),{POLICY,assessCompletedMatch}=require('./afl-source-policy');
function buildPreview(manifest,projected,registry,nominations,{verifierMatches=[]}={}){
 if(manifest?.closedRound!==true||!Array.isArray(manifest.matches)||!manifest.matches.length||
  new Set(manifest.matches.map(x=>x.id)).size!==manifest.matches.length||projected.length!==manifest.matches.length)throw Error('Complete explicitly closed round required');
 if(!Array.isArray(verifierMatches)||verifierMatches.some(x=>!x?.match?.id)||new Set(verifierMatches.map(x=>x.match.id)).size!==verifierMatches.length||verifierMatches.some(x=>!manifest.matches.some(e=>e.id===x.match.id)))throw Error('Unique expected verifier matches required');
 const seen=new Set(),byCanonical=new Map(registry.map(p=>[p.id,p])),players=new Map(),clubOrder=new Map();
 const matches=manifest.matches.map(expected=>{
  if(expected.season!==manifest.season)throw Error('Manifest season mismatch');
  const input=projected.find(x=>x.metadata.id===expected.official.id);if(!input||seen.has(input.metadata.id))throw Error('Missing or duplicate official match');seen.add(input.metadata.id);
  return provider.normalize(input,expected,registry);
 });
 for(const match of matches.slice().sort((a,b)=>a.playedAt.localeCompare(b.playedAt))){
  for(const [i,r] of match.rows.entries()){
   const person=byCanonical.get(match.playerIds[i]);if(!person?.archiveName)throw Error('Explicit scoring-name mapping required');
   const key=scoring.identity(person.archiveName,r[1]);if(players.has(key))throw Error('Duplicate player appearance in round');
   players.set(key,{K:r[2],H:r[3],D:r[4],M:r[5],HO:r[6],T:r[7],G:r[10],B:r[11]});
   if(!clubOrder.has(r[1]))clubOrder.set(r[1],clubOrder.size);
  }
 }
 if(new Set(nominations.map(n=>n.team)).size!==nominations.length)throw Error('Duplicate nominated team');
 const teams=nominations.map(n=>({team:n.team,...scoring.resolve(n.nomination,players,clubOrder,{complete:true})}));
 const assessments=manifest.matches.map((e,i)=>({matchId:e.id,...assessCompletedMatch(e,{primary:{source:'OfficialAFL',match:matches[i]},
  verifier:verifierMatches.find(x=>x.match.id===e.id)})}));
 const status=assessments.some(a=>a.status==='held')?'held':assessments.every(a=>a.status==='final-candidate')?'verified-shadow':'awaiting-verification';
 return {schema:1,round:manifest.id,season:manifest.season,status,canPublish:false,source:POLICY.primary,verifier:POLICY.verifier,
  matches,teams,assessments:assessments.map(({matchId,status,reason,comparison,verificationRequired})=>({match:matchId,status,...(reason?{reason}:{}),...(comparison?{comparison}:{}),...(verificationRequired?{verificationRequired}:{} )}))};
}
module.exports={buildPreview};
