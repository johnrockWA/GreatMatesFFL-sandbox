/* Plans corrected match-stat ingestion. No spreadsheet/network/write side effects.
   Host must stage, audit and commit atomically before publishing the new snapshot. */
'use strict';
const key=r=>[r[0],r[1],r[16]].map(v=>String(v??'').trim().toLowerCase()).join('|');
function validate(row){
 if(!Array.isArray(row)||row.length!==17||![0,1,16].every(i=>typeof row[i]==='string'&&row[i].trim()))throw Error('17-column match row and verified identity/date required');
 for(const i of [2,3,4,5,6,7,10,11])if(!Number.isFinite(row[i])||row[i]<0)throw Error('Scoring statistics must be explicit non-negative numbers');
 if(row[2]+row[3]!==row[4])throw Error('Disposals must equal kicks plus handballs');
}
function planRefresh(existing,expectedUrls,batches){
 if(!Array.isArray(expectedUrls)||!expectedUrls.length||new Set(expectedUrls).size!==expectedUrls.length)throw Error('Unique expected completed-match URLs required');
 if(batches.length!==expectedUrls.length||new Set(batches.map(b=>b.url)).size!==batches.length)throw Error('Incomplete or duplicate match batch');
 const fresh=new Map();
 for(const url of expectedUrls){const b=batches.find(b=>b.url===url);if(!b||b.error||!Array.isArray(b.rows)||!b.rows.length)throw Error('Incomplete scrape: '+url);
  for(const row of b.rows){validate(row);const k=key(row);if(fresh.has(k)&&JSON.stringify(fresh.get(k))!==JSON.stringify(row))throw Error('Conflicting source rows for one player/match');fresh.set(k,row);}
 }
 const indices=new Map();existing.forEach((r,i)=>{validate(r);if(indices.has(key(r)))throw Error('Duplicate existing player/match needs review');indices.set(key(r),i);});
 const updated=[],inserted=[];let unchanged=0;
 for(const [k,r] of fresh){const i=indices.get(k);if(i===undefined)inserted.push([...r]);else if(JSON.stringify(existing[i])!==JSON.stringify(r))updated.push({index:i,key:k,before:[...existing[i]],after:[...r]});else unchanged++;}
 return {inserted,updated,unchanged,complete:true,canPublish:false,note:'A verified host transaction, audit and rollback are still required.'};
}
module.exports={planRefresh};
