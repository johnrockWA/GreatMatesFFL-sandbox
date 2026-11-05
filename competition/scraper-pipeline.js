/* Server-side scraper coordinator; injected provider/storage adapters only.
   No live providers, scheduler, Google adapter or credentials are included. */
'use strict';
const {createHash}=require('node:crypto');
const copy=v=>JSON.parse(JSON.stringify(v));
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const transient=s=>s===429||s>=500&&s<=599;
const identity=r=>r[0].trim().toLowerCase()+'|'+r[1].trim().toLowerCase();
function validateMatch(match,expected){
 if(!match||match.id!==expected.id||match.season!==expected.season||match.completed!==true||match.home!==expected.home||match.away!==expected.away||match.playedAt!==expected.playedAt)throw Error('Match identity, date, season or completion mismatch');
 if(!expected.rowDate||!expected.venue)throw Error('Verified row date and venue required');
 if(!Array.isArray(match.rows))throw Error('Player rows missing');
 const seen=new Set(),counts=new Map([[expected.home,0],[expected.away,0]]);
 for(const r of match.rows){
  if(!Array.isArray(r)||r.length!==17||typeof r[0]!=='string'||!r[0].trim()||!counts.has(r[1])||typeof r[16]!=='string'||!r[16].trim())throw Error('Malformed player identity/club/date');
  if(r[14]!== (r[1]===expected.home?expected.away:expected.home)||r[15]!==expected.venue||r[16]!==expected.rowDate)throw Error('Player row opponent, venue or date mismatch');
  const k=identity(r);if(seen.has(k))throw Error('Duplicate player');seen.add(k);counts.set(r[1],counts.get(r[1])+1);
  for(let i=2;i<=13;i++){
   // Provider ratings are not used for FFL scoring. Their absence must be explicit.
   if(i===13&&r[i]===null&&match.unavailableStatistics?.length===1&&match.unavailableStatistics[0]==='rating')continue;
   if(!Number.isFinite(r[i])||r[i]<0)throw Error('Invalid or missing statistics');
  }
  if(r[2]+r[3]!==r[4])throw Error('Disposal consistency failure');
 }
 for(const club of counts.keys())if(!Number.isInteger(expected.playerCounts?.[club])||expected.playerCounts[club]<=0||counts.get(club)!==expected.playerCounts[club])throw Error('Incomplete team/player coverage');
 return copy(match);
}
function scoringSignature(m){return m.rows.map(r=>[identity(r),...[2,3,4,5,6,7,10,11].map(i=>r[i])]).sort((a,b)=>a[0].localeCompare(b[0]));}
async function retrieve(provider,expected,services){
 const attempts=3;
 for(let attempt=1;attempt<=attempts;attempt++){
  let response;
  try{response=await provider.fetch(expected);}catch(e){if(e.retryable!==true||attempt===attempts)throw e;await services.backoff(250*2**(attempt-1));continue;}
  if(response.status!==200){if(transient(response.status)&&attempt<attempts){await services.backoff(250*2**(attempt-1));continue;}throw Error(provider.id+' HTTP '+response.status);}
  // A 200 challenge/login page must fail parsing/validation, never become success.
  return validateMatch(await provider.parse(response.body,expected),expected);
 }
 throw Error('Retrieval attempts exhausted');
}
async function refresh(manifest,providers,services,{requireCrossCheck=true,allowSingleSource=false}={}){
 let staged=null,commitAttempted=false,committedHash=null;
 try{
  if(!manifest?.id||!Number.isInteger(manifest.season)||!Array.isArray(manifest.matches)||!manifest.matches.length)throw Error('Verified round manifest required');
  if(new Set(manifest.matches.map(m=>m.id)).size!==manifest.matches.length)throw Error('Duplicate expected match');
  if(!providers.length||providers.some(p=>!p.id)||new Set(providers.map(p=>p.id)).size!==providers.length)throw Error('Distinct provider identities required');
  const matches=[],failures=[];let degraded=false;
  for(const expected of manifest.matches){
   if(expected.season!==manifest.season||expected.home===expected.away||!Number.isFinite(Date.parse(expected.playedAt)))throw Error('Invalid manifest match');
   const successes=[];
   for(const provider of providers){try{successes.push({source:provider.id,match:await retrieve(provider,expected,services)});}catch(e){failures.push({match:expected.id,source:provider.id,error:e.message});}}
   if(!successes.length)throw Error('No validated source for match '+expected.id);
   if(successes.some(s=>JSON.stringify(scoringSignature(s.match))!==JSON.stringify(scoringSignature(successes[0].match))))throw Error('Provider disagreement: '+expected.id);
   if(successes.length<2){degraded=true;if(requireCrossCheck||!allowSingleSource)throw Error('Independent cross-check unavailable: '+expected.id);}
   matches.push({...successes[0].match,sources:successes.map(s=>s.source)});
  }
  const payload={schema:1,round:manifest.id,season:manifest.season,matches:matches.sort((a,b)=>a.id.localeCompare(b.id))};
  const hash=digest(payload);
  staged=await services.stage(copy(payload),hash);
  const readback=await services.readStage(staged);if(digest(readback)!==hash)throw Error('Staged snapshot verification failed');
  const committed=await services.withLock(async()=>{
   const previous=await services.readPublished(manifest.id);
   const missing=(previous?.payload?.matches||[]).filter(m=>!manifest.matches.some(n=>n.id===m.id));if(missing.length)throw Error('Manifest would remove an already published match');
   if(previous?.hash===hash)return {changed:false,revision:previous.revision};
   // Host must implement an atomic durable pointer swap + audit under this lease.
   // It must reject stale revisions and must not mutate the previous snapshot.
   commitAttempted=true;committedHash=hash;
   const result=await services.commit({round:manifest.id,stage:staged,hash,expectedRevision:previous?.revision??0,previousHash:previous?.hash??null});
   const verified=await services.readPublished(manifest.id);if(verified?.hash!==hash||digest(verified.payload)!==hash)throw Error('Publication readback failed');
   return result;
  });
  const status={status:degraded?'degraded':'ok',round:manifest.id,hash,failures,committed};await services.recordStatus(status);return status;
 }catch(e){
  // Failed staging/commit leaves last good published pointer intact by host contract.
  const status={status:'error',round:manifest?.id||null,error:e.message,staged,publication:commitAttempted?'unknown':'unchanged'};
  if(commitAttempted){try{const published=await services.readPublished(manifest.id);if(published?.hash===committedHash&&digest(published.payload)===committedHash)status.publication='verified-committed';}catch(readError){status.reconciliationError=readError.message;}}
  try{await services.recordStatus(status);}catch(statusError){status.statusWriteError=statusError.message;}
  return status;
 }
}
function freshness(published,now,maxAgeMs){
 if(!Number.isFinite(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<=0)throw Error('Verified clock and freshness limit required');
 const last=Date.parse(published?.lastSuccessAt);return !Number.isFinite(last)?{status:'missing'}:now<last?{status:'error',reason:'Future success timestamp'}:now-last>maxAgeMs?{status:'stale',ageMs:now-last}:{status:'fresh',ageMs:now-last};
}
module.exports={refresh,validateMatch,freshness,digest};
