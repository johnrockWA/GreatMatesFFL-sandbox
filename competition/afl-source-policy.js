/* Agreed source policy. Pure assessment of completed, canonicalised matches.
   No transport, scheduler, live feed, UI, approval or publication side effects. */
'use strict';
const {validateMatch}=require('./scraper-pipeline');
const POLICY=Object.freeze({primary:'OfficialAFL',verifier:'AFLTables',liveEnabled:false,
 regularRefreshMinutes:5,finalsRefreshMinutes:1,
 maxStatisticDifference:1,
 preserveCanonicalNames:true,preserveClosedResults:true,correctionsRequireApproval:true});
const scoringFields=[[2,'kicks'],[3,'handballs'],[4,'disposals'],[5,'marks'],[6,'hitouts'],[7,'tackles'],[10,'goals'],[11,'behinds']];
const identity=row=>JSON.stringify([row[0].trim().toLowerCase(),row[1].trim().toLowerCase()]);
const signature=match=>JSON.stringify(match.rows.map(row=>[
 row[0].trim().toLowerCase(),row[1].trim().toLowerCase(),
 ...[2,3,4,5,6,7,10,11].map(i=>row[i])
]).sort((a,b)=>JSON.stringify(a.slice(0,2)).localeCompare(JSON.stringify(b.slice(0,2)))));

// Separately fetched websites check transport/parsing, not independent statistical
// collection: AFL Tables lists AFL among its upstream sources. Archives do not count.
function assessCompletedMatch(expected,{primary,verifier,previousPublished}={}){
 const base={primary:POLICY.primary,verifier:POLICY.verifier,canPublish:false};
 if(primary?.source!==POLICY.primary)return {...base,status:'held',reason:'Official AFL primary unavailable'};
 let official;
 try{official=validateMatch(primary.match,expected);}catch(error){
  return {...base,status:'held',reason:error.message};
 }
 if(verifier?.source!==POLICY.verifier)return {...base,status:'awaiting-verification',reason:'AFL Tables verification unavailable'};
 let checked;
 try{checked=validateMatch(verifier.match,expected);}catch(error){
  return {...base,status:'awaiting-verification',reason:error.message};
 }
 const verifierRows=new Map(checked.rows.map(row=>[identity(row),row])),differences=[];
 for(const row of official.rows){
  const other=verifierRows.get(identity(row));
  if(!other)return {...base,status:'held',reason:'Provider player identities disagree'};
  for(const [column,statistic] of scoringFields){
   const difference=row[column]-other[column];
   if(difference!==0)differences.push({player:row[0],club:row[1],statistic,official:row[column],verifier:other[column],difference,
    requiresVerification:Math.abs(difference)>POLICY.maxStatisticDifference});
  }
 }
 const comparison={sourceOfTruth:POLICY.primary,maxStatisticDifference:POLICY.maxStatisticDifference,differences};
 if(differences.some(d=>d.requiresVerification))return {...base,status:'held',reason:'Scoring statistic difference exceeds tolerance',verificationRequired:true,comparison};
 if(previousPublished){
  let previous;
  try{previous=validateMatch(previousPublished,expected);}catch(error){
   return {...base,status:'held',reason:'Previous published match is invalid: '+error.message};
  }
  if(signature(previous)!==signature(official))return {...base,status:'correction-proposed',
   approvalRequired:true,before:previous,after:official,comparison};
 }
 // A candidate still needs the host's identity/freshness, storage, audit and
 // approval gates. It must never directly overwrite historical results.
 return {...base,status:'final-candidate',match:official,comparison};
}
module.exports={POLICY,assessCompletedMatch};
