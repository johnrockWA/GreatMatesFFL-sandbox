/* Durable shadow snapshots. One-cell head pointer, immutable rows, injected I/O.
   It cannot write any competition results or certify a final FFL score. */
'use strict';
function createShadowStore(io){
 function readSnapshot(row){
  const record=io.readRecord(row);
  if(!record||typeof record.json!=='string'||io.hash(record.json)!==record.hash)throw Error('Snapshot checksum mismatch');
  return {row,hash:record.hash,payload:JSON.parse(record.json)};
 }
 function read(){
  const head=io.readHead();if(!head)return null;
  if(!Number.isInteger(head.revision)||head.revision<1||!Number.isInteger(head.row)||head.row<2)throw Error('Invalid shadow head');
  const snapshot=readSnapshot(head.row);if(snapshot.hash!==head.hash)throw Error('Head checksum mismatch');
  return {...snapshot,revision:head.revision};
 }
 function stage(payload){
  const json=JSON.stringify(payload),hash=io.hash(json),row=io.appendRecord({hash,json});io.flush();
  const actual=readSnapshot(row);if(actual.hash!==hash)throw Error('Stage readback mismatch');return {row,hash};
 }
 function commit(staged,expectedRevision,reason='refresh'){
  return io.withLock(()=>{
   const prior=read();if((prior?.revision??0)!==expectedRevision)throw Error('Stale shadow revision');
   const candidate=readSnapshot(staged.row);if(candidate.hash!==staged.hash)throw Error('Stage checksum mismatch');
   if(prior?.hash===candidate.hash)return {changed:false,revision:prior.revision};
   const next={row:staged.row,hash:staged.hash,revision:expectedRevision+1};
   // Audit before pointer swap; orphan records are harmless after a failed commit.
   io.appendAudit({phase:'prepared',reason,before:prior?{row:prior.row,hash:prior.hash,revision:prior.revision}:null,after:next});io.flush();
   try{io.writeHead(next);io.flush();}catch(error){
    const recovered=read();
    if(recovered?.revision===next.revision&&recovered.hash===next.hash)return {changed:true,revision:next.revision,responseRecovered:true};
    throw error;
   }
   const check=read();if(check?.revision!==next.revision||check.hash!==next.hash)throw Error('Shadow commit readback mismatch');
   return {changed:true,revision:next.revision};
  });
 }
 return {read,readSnapshot,stage,commit};
}
module.exports={createShadowStore};
