/* Shared screen state: server views only, durable request IDs, no demo fallback. */
'use strict';
function createSharedDraftClient(options){
 const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
 let view=null,pending=null,receipt=null,busy=false,refreshing=false,readGeneration=0,stale=true,message='Connecting…',key=null,authRequired=false;
 const changed=()=>options.changed?.(snapshot());
 function snapshot(){return copy({view,pending,receipt,busy,refreshing,stale,message,authRequired});}
 function stash(){if(key){if(pending)options.storage.setItem(key,JSON.stringify(pending));else options.storage.removeItem(key);}}
 function accept(next){
  if(next?.viewSchema!==1||next.instanceId!==options.instanceId||!Array.isArray(next.managedTeams)||!next.managedTeams.includes(next.managingTeam)||typeof next.principalKey!=='string'||!next.principalKey||!Number.isInteger(next.revision)||!next.choices?.[next.managingTeam])throw Error('Invalid shared draft response.');
  if(view&&(next.managingTeam!==view.managingTeam||next.principalKey!==view.principalKey))throw Error('The signed-in coach or managing team changed. Reopen the shared draft.');
  if(view&&next.revision<view.revision)throw Error('An older draft response was refused.');
  view=copy(next);stale=false;authRequired=false;
 }
 function body(action,team){return {action,token:options.token(),instanceId:options.instanceId,principalKey:view?.principalKey,managingTeam:team};}
 async function exchange(payload){
  let timer;try{return await Promise.race([options.send(payload),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Connection timed out.')),options.timeoutMs||15000);})]);}finally{clearTimeout(timer);}
 }
 function fail(result){const error=Error(result?.message||'The shared draft could not be reached.');error.code=result?.code;if(error.code==='AUTH_REQUIRED')authRequired=true;throw error;}
 async function refresh(team,{background=false}={}){
  if(busy||refreshing)throw Error('Wait for the current request.');
  if(view&&team&&team!==view.managingTeam)throw Error('Open the assigned team in a separate shared draft screen.');
  const generation=++readGeneration,quiet=background&&!!view&&!stale&&!pending;
  refreshing=true;if(!quiet)busy=true;changed();
  try{
   const result=await exchange(body('readDraftWorkflow',team||view?.managingTeam||options.managingTeam));
   // A write started after this read: its response/receipt owns the newer state.
   if(generation!==readGeneration)return snapshot();
   if(!result?.ok)fail(result);
   accept(result.view);
   if(!key){key=['ffl-shared-v1',view.instanceId,view.principalKey,view.managingTeam].join(':');const saved=options.storage.getItem(key);if(saved){pending=JSON.parse(saved);if(!pending||pending.team!==view.managingTeam||pending.instanceId!==view.instanceId||typeof pending.command?.requestId!=='string')throw Error('Stored request needs review.');}}
   message=pending?'A request is awaiting confirmation. Retry it to recover the saved result.':'Up to date with the shared draft.';
  }catch(error){if(generation!==readGeneration)return snapshot();stale=true;message=error.message;throw error;}finally{if(generation===readGeneration){refreshing=false;if(!quiet)busy=false;changed();}}
  return snapshot();
 }
 async function deliver(){
  ++readGeneration;refreshing=false;
  busy=true;message='Confirming with the shared draft…';changed();
  try{
   const result=await exchange({...body('writeDraftWorkflow',pending.team),command:copy(pending.command)});
   if(!result?.ok)fail(result);
   // A generic success or a receipt for another request is not an acknowledgement.
   if(result.view?.receipt?.requestId!==pending.command.requestId||!Number.isInteger(result.view.receipt.revision)||result.view.receipt.revision>result.view.revision)throw Error('A matching receipt was not returned.');
   accept(result.view);
   // Keep the request recoverable if clearing browser storage fails after acceptance.
   if(key)options.storage.removeItem(key);
   receipt=copy(result.view.receipt);pending=null;
   message='Saved centrally · receipt '+receipt.requestId+' · revision '+receipt.revision+'.';
  }catch(error){
   if(error.code==='REJECTED'){pending=null;stash();message='Not saved: '+error.message;}
   else message='Confirmation pending. '+error.message;
   stale=true;throw error;
  }finally{busy=false;changed();}
  return snapshot();
 }
 async function dispatch(type,data={}){
  if(busy||pending)throw Error('Resolve the pending request before making another change.');
  if(!view||stale)throw Error('Refresh the shared draft before making a change.');
  const command={...copy(data),type,revision:view.revision,requestId:options.requestId()};
  if(typeof command.requestId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(command.requestId))throw Error('A unique request identifier is required.');
  pending={instanceId:view.instanceId,team:view.managingTeam,command};
  try{stash();}catch(error){pending=null;throw Error('Recovery storage is unavailable. No request was sent.');}
  return deliver();
 }
 async function retry(){if(busy||!pending)throw Error('No pending request to retry.');return deliver();}
 function signedOut(){if(pending)throw Error('Recover the pending request before signing out.');++readGeneration;view=null;receipt=null;key=null;busy=false;refreshing=false;stale=true;authRequired=true;message='Signed out. Sign in to your draft.';changed();}
 return {snapshot,refresh,dispatch,retry,signedOut};
}
if(typeof module!=='undefined')module.exports={createSharedDraftClient};
