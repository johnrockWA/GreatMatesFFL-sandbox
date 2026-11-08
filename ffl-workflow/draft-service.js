/* Authenticated POST dispatcher; host supplies token validation and isolated storage. */
'use strict';
function createDraftService(host){
 return function request(payload){
  let writing=false;
  try{
   host.assertEnvironment();
   if(!payload||!['readDraftWorkflow','writeDraftWorkflow'].includes(payload.action))throw Error('Unknown shared draft request.');
   const auth=host.validateToken(payload.token);
   if(auth?.valid!==true)return {ok:false,code:'AUTH_REQUIRED',message:'Please sign in again.'};
   const actor=host.actor(auth,payload.managingTeam);
   const instance=host.instance();
   if(typeof instance!=='string'||!instance||payload.instanceId!==instance)throw Error('This draft connection is not configured for the current instance.');
   if(payload.action==='readDraftWorkflow')return {ok:true,view:host.read(auth,actor.team)};
   if(payload.principalKey!==host.principalKey(actor))throw Error('The signed-in coach changed. Reopen the shared draft.');
   host.authorize(actor,payload.command);
   host.assertWrites();writing=true;
   return {ok:true,view:host.write(auth,payload.command,actor.team)};
  }catch(error){
   const rejected=!writing||error.code==='DRAFT_REJECTED';
   // Storage/response faults may follow a committed write. Never claim rejection.
   return {ok:false,code:rejected?'REJECTED':'UNCONFIRMED',message:rejected?error.message:'The result could not be confirmed. Retry the same request to recover its receipt.'};
  }
 };
}
if(typeof module!=='undefined')module.exports={createDraftService};
