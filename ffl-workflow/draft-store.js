/* Durable shared draft state. I/O and authentication are supplied by the host. */
'use strict';
function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
function createDraftStore(io){
 const clone=x=>JSON.parse(JSON.stringify(x));
 function record(row,hash){
  const r=io.readRecord(row);
  if(!r||typeof r.json!=='string'||io.hash(r.json)!==r.hash||(hash&&hash!==r.hash))throw Error('Draft snapshot checksum mismatch.');
  const data=JSON.parse(r.json);
  if(data.schema!==2||!data.state||!Number.isInteger(data.state.revision)||data.state.revision<0||!Array.isArray(data.receipts))throw Error('Invalid draft snapshot.');
  return {row,hash:r.hash,data};
 }
 function read(){
  const head=io.readHead();if(head===null)return null;
  if(!head||head.schema!==2||!Number.isInteger(head.row)||head.row<3||!Number.isInteger(head.revision)||head.revision<0||typeof head.hash!=='string'||!head.hash)throw Error('Invalid draft head.');
  const current=record(head.row,head.hash);
  if(current.data.state.revision!==head.revision)throw Error('Draft revision mismatch.');
  if(canonical(head)!==canonical(io.readHead()))throw Error('Draft changed during read. Retry.');
  return current;
 }
 function commit(data){
  const json=JSON.stringify(data),hash=io.hash(json),row=io.appendRecord({json,hash});io.flush();
  const staged=record(row,hash);
  if(staged.data.state.revision!==data.state.revision)throw Error('Draft stage readback mismatch.');
  const head={schema:2,row,hash,revision:data.state.revision};
  try{io.writeHead(head);io.flush();}catch(error){
   const actual=read();
   if(actual&&actual.row===row&&actual.hash===hash)return {responseRecovered:true};
   throw error;
  }
  const actual=read();if(actual?.row!==row||actual.hash!==hash)throw Error('Draft commit readback mismatch.');
  return {responseRecovered:false};
 }
 function initialize(state){return io.withLock(()=>{
  if(read())throw Error('Draft storage already initialized.');
  if(state?.revision!==0)throw Error('Initial draft revision must be zero.');
  return commit({schema:2,state:clone(state),receipts:[]});
 });}
 function dispatch(actor,action,now,apply){return io.withLock(()=>{
  if(!actor||typeof actor.id!=='string'||!actor.id||typeof actor.team!=='string'||!actor.team)throw Error('Verified draft identity required.');
  if(!action||typeof action!=='object'||Array.isArray(action)||typeof action.requestId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(action.requestId))throw Error('A unique request identifier is required.');
  const current=read();if(!current)throw Error('Draft storage is not initialized.');
  const key=canonical([actor.id,actor.team,action.requestId]),digest=io.hash(canonical(action));
  const prior=current.data.receipts.find(r=>r.key===key);
  if(prior){
   if(prior.digest!==digest)throw Error('Request identifier was already used for another action.');
   return {state:clone(current.data.state),receipt:{requestId:action.requestId,revision:prior.revision,replayed:true}};
  }
  if(current.data.receipts.length>=10000)throw Error('Draft request history needs archival before further writes.');
  const state=apply(clone(current.data.state),clone(action),clone(actor),now);
  if(state.revision!==current.data.state.revision+1)throw Error('Invalid next draft revision.');
  const receipt={key,digest,revision:state.revision};
  const result=commit({schema:2,state,receipts:[...current.data.receipts,receipt]});
  return {state:clone(state),receipt:{requestId:action.requestId,revision:state.revision,replayed:false,...result}};
 });}
 return {initialize,dispatch,read:()=>io.withLock(()=>read()),readRecord:record};
}
if(typeof module!=='undefined')module.exports={createDraftStore,canonical};
