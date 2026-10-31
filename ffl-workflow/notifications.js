/* Notification policy and durable-outbox state machine. No network or selection advice. */
var FFLNotifications=(function(){
'use strict';
const HOUR=3600000,clone=x=>JSON.parse(JSON.stringify(x));
const stamp=x=>{const n=typeof x==='number'?x:Date.parse(x);if(!Number.isFinite(n))throw Error('Verified server time required.');return n;};
function draftAlerts(s,now){
 now=stamp(now);const E=typeof FFLDraft!=='undefined'?FFLDraft:require('./draft-engine');
 if(E.phase(s,now)!=='drafting')return [];
 const turn=s.plan[s.picks.length];if(!turn)return [];
 const team=s.teams.find(t=>t.id===turn.team);if(!team)throw Error('Verified turn team required.');
 const epoch=[...s.audit].reverse().find(e=>['arm','override','schedule'].includes(e.type));
 const opened=Math.max(stamp(s.config.draftAt),epoch?stamp(epoch.at):stamp(s.config.draftAt));
 const since=s.picks.length?stamp(s.picks.at(-1).at):opened;
 const key=['draft',s.config.kind,s.config.season,s.config.opensAt,epoch?.eventId||epoch?.at||'initial',s.picks.length,turn.team].join(':');
 const common={team:turn.team,teamName:team.name,pick:turn.label,context:'draft',turnKey:key};
 const alert={...common,id:key+':in-app',channel:'in-app',title:team.name+' — your pick '+turn.label,text:'Your turn is ready in the draft room. You make the selection; Katy handles the rules.',notBefore:since};
 // User requested OVER one hour, not at precisely 60 minutes. One email per turn.
 if(now<=since+HOUR)return [alert];
 return [alert,{...common,id:key+':email',channel:'email',title:'Your FFL draft pick is waiting — '+team.name,text:'Pick '+turn.label+' is yours. It has been over an hour since '+(s.picks.length?'the last recorded selection.':'the draft opened.')+' Open the draft room to select your player.',notBefore:since+HOUR+1}];
}
function roundEmails(rounds,now){
 now=stamp(now);const out=[];
 for(const r of rounds||[]){
  if(!r.id||r.cancelled===true)continue;const lockout=stamp(r.lockoutAt);
  if(now<lockout-3*HOUR||now>=lockout)continue;
  for(const t of r.teams||[]){
   // Missing/unknown submission status is not permission to send a reminder.
   if(!t.id||t.submitted!==false)continue;
   out.push({id:['round',r.id,lockout,t.id,'3h-email'].join(':'),channel:'email',context:'round',round:r.id,team:t.id,teamName:t.name,title:'Team selections due — '+t.name,text:'Your '+(r.label||r.id)+' team has not been submitted. Lockout: '+new Date(lockout).toLocaleString('en-AU',{timeZone:r.timeZone||'Australia/Perth',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' ('+(r.timeZone||'Australia/Perth')+'). Open team selections to review and submit.',notBefore:lockout-3*HOUR,expiresAt:lockout});
  }
 }
 return out;
}
function intents(context){return [...(context.draft?draftAlerts(context.draft,context.now):[]),...roundEmails(context.rounds,context.now)];}
function reconcile(input,context){
 const out=clone(input||{schema:1,records:{}});if(out.schema!==1||!out.records)throw Error('Invalid notification ledger.');
 const active=new Map(intents(context).filter(i=>i.channel==='email').map(i=>[i.id,i]));
 for(const [id,r] of Object.entries(out.records))if(r.status==='queued'&&!active.has(id)){r.status='cancelled';r.finishedAt=new Date(stamp(context.now)).toISOString();}
 for(const [id,i] of active){if(!out.records[id]||out.records[id].status==='cancelled')out.records[id]={...i,status:'queued',queuedAt:new Date(stamp(context.now)).toISOString()};}
 return out;
}
function dispatch(input,context,services){
 let out=reconcile(input,context);
 if(services.emailEnabled!==true)return out; // Preview: no writes, recipients or mail.
 for(const r of Object.values(out.records)){
  if(r.status!=='queued')continue;
  const latest=services.readContext();
  if(!intents(latest).some(i=>i.channel==='email'&&i.id===r.id)){r.status='cancelled';services.save(clone(out));continue;}
  const to=services.resolveRecipient(r.team);
  if(typeof to!=='string'||!/^\S+@\S+\.\S+$/.test(to))throw Error('Verified coach email required.');
  r.status='attempting';r.attemptedAt=new Date(stamp(latest.now)).toISOString();
  services.save(clone(out)); // Must commit durably under a server lock BEFORE sending.
  try{
   // Recheck after the claim; never dispatch an obsolete turn/round knowingly.
   if(!intents(services.readContext()).some(i=>i.channel==='email'&&i.id===r.id)){r.status='cancelled';services.save(clone(out));continue;}
   const receipt=services.send({to,subject:r.title,text:r.text,notificationId:r.id});
   if(!receipt||receipt.accepted!==true)throw Error('Delivery acknowledgement unavailable.');
   r.status='sent';r.receiptId=receipt.id||null;
  }catch(e){r.status='uncertain';r.error='Delivery needs manual review; do not retry automatically.';}
  services.save(clone(out));
 }
 return out;
}
return Object.freeze({draftAlerts,roundEmails,reconcile,dispatch});
})();
if(typeof module!=='undefined')module.exports=FFLNotifications;
