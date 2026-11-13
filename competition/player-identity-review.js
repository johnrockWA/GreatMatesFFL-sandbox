/* Pure Development identity reconciliation. No name guessing or registry writes. */
'use strict';
const {registryIndex}=require('./afltables-provider');
const normal=name=>name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function reconcile({players,existingRegistry,observations,aliases=[]}){
 const catalogue=players.map(p=>({id:p.id,name:p.name,profile:p.statsSource,sourceNames:p.sourceNames||[]}));
 registryIndex(catalogue);registryIndex(existingRegistry);
 const byProfile=new Map(catalogue.map(p=>[p.profile,p])),byId=new Map(catalogue.map(p=>[p.id,p]));
 const ids=new Map(),officialIds=new Map(),result=new Map(),occurrences=new Set(),aliasKeys=new Set();
 for(const p of existingRegistry){
  const canonical=byProfile.get(p.profile);
  if(!canonical||canonical.id!==p.id||canonical.name!==p.name)throw Error('Existing canonical identity conflict');
  if(!/^CD_I\d+$/.test(p.officialPlayerId)||officialIds.has(p.officialPlayerId))throw Error('Existing official identity conflict');
  ids.set(p.id,p.officialPlayerId);officialIds.set(p.officialPlayerId,p.id);
  result.set(p.id,{...p,officialNames:[...p.officialNames]});
 }
 for(const a of aliases){
  const key=JSON.stringify([a.profile,a.officialPlayerId,a.sourceName,a.officialName]);
  if(aliasKeys.has(key)||!byProfile.has(a.profile)||!/^CD_I\d+$/.test(a.officialPlayerId)||!a.sourceName?.trim()||!a.officialName?.trim())throw Error('Invalid explicit identity alias');
  aliasKeys.add(key);
 }
 for(const o of observations){
  const p=byProfile.get(o.profile),key=JSON.stringify([o.matchId,o.profile]);
  if(!p||!byId.has(p.id)||!/^CD_I\d+$/.test(o.officialPlayerId)||!o.matchId||!o.club||!Number.isInteger(o.jumper)||o.jumper<1||
   occurrences.has(key)||!o.sourceName?.trim()||!o.officialName?.trim()||(normal(p.name)!==normal(o.sourceName)&&!p.sourceNames.includes(o.sourceName)))throw Error('Unknown, duplicate or mismatched identity observation: '+o.profile+' / '+p?.name+' / '+o.sourceName);
  occurrences.add(key);
  if(ids.has(p.id)&&ids.get(p.id)!==o.officialPlayerId||officialIds.has(o.officialPlayerId)&&officialIds.get(o.officialPlayerId)!==p.id)throw Error('Cross-match official identity conflict');
  const prior=result.get(p.id);
  const exact=normal(o.sourceName)===normal(o.officialName),known=prior?.officialNames.includes(o.officialName);
  const explicit=aliasKeys.has(JSON.stringify([o.profile,o.officialPlayerId,o.sourceName,o.officialName]));
  if(!exact&&!known&&!explicit)throw Error('Explicit profile-specific name alias required');
  ids.set(p.id,o.officialPlayerId);officialIds.set(o.officialPlayerId,p.id);
  result.set(p.id,{...prior,id:p.id,name:p.name,profile:p.profile,officialPlayerId:o.officialPlayerId,officialNames:[...new Set([...(prior?.officialNames||[]),o.officialName])]});
 }
 return {registry:[...result.values()],observations:observations.length,additions:[...result.keys()].filter(id=>!existingRegistry.some(p=>p.id===id)),canPublish:false};
}
module.exports={reconcile};
