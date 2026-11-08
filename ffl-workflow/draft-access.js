/* Only a server-validated identity and an explicit server registry grant access. */
'use strict';
const DRAFT_ADMIN_ACTIONS=['schedule','override','prepare','arm','pause','resume','trade'];
function draftActor(auth,identities,managedTeam){
 if(!auth||auth.valid!==true||typeof auth.email!=='string'||typeof auth.team!=='string')throw Error('Authenticated coach mapping required.');
 if(!Array.isArray(identities))throw Error('Verified identity registry required.');
 const email=auth.email.trim().toLowerCase(),matches=identities.filter(x=>typeof x?.email==='string'&&x.email.trim().toLowerCase()===email);
 if(matches.length!==1)throw Error('Exactly one verified coach mapping required.');
 const grant=matches[0];
 if(!['coach','commissioner','president'].includes(grant.role)||!Array.isArray(grant.teams)||!grant.teams.length||!Array.isArray(grant.capabilities)||grant.capabilities.some(x=>!DRAFT_ADMIN_ACTIONS.includes(x)))throw Error('Invalid draft access grant.');
 const ids=new Set(),names=new Set();
 for(const t of grant.teams){if(typeof t?.id!=='string'||!t.id||typeof t.name!=='string'||!t.name||ids.has(t.id)||names.has(t.name))throw Error('Invalid or duplicate team mapping.');ids.add(t.id);names.add(t.name);}
 if(!names.has(auth.team))throw Error('Authenticated team is not in the verified mapping.');
 const selected=managedTeam===undefined?grant.teams.find(t=>t.name===auth.team):grant.teams.find(t=>t.id===managedTeam);
 if(!selected)throw Error('You can only manage an assigned team.');
 return {id:email,team:selected.id,role:grant.role,managedTeams:[...ids],capabilities:grant.role==='coach'?[]:[...new Set(grant.capabilities)]};
}
function authorizeDraftAction(actor,action){
 if(!action||typeof action!=='object'||Array.isArray(action))throw Error('Invalid action.');
 if(action.type==='finalize')throw Error('Shared squad publication is not connected yet. Finalization is disabled.');
 if(DRAFT_ADMIN_ACTIONS.includes(action.type)&&!actor.capabilities.includes(action.type))throw Error('This committee action has not been granted.');
}
if(typeof module!=='undefined')module.exports={draftActor,authorizeDraftAction,DRAFT_ADMIN_ACTIONS};
