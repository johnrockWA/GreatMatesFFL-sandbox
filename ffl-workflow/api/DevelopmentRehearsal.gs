/* Editor-owned synthetic integration only. No official-sheet or mail writer. */
function fflIntegrationAssert_(){fflOwnerSharedAssert_();}
function fflIntegrationHash_(x){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,x));}
function fflIntegrationGrants_(){return [
 {email:'alpha@example.invalid',role:'coach',teams:[{id:'a',name:'Synthetic Alpha'}],capabilities:[]},
 {email:'beta@example.invalid',role:'coach',teams:[{id:'b',name:'Synthetic Beta'}],capabilities:[]},
 {email:'committee@example.invalid',role:'commissioner',teams:[{id:'a',name:'Synthetic Alpha'}],capabilities:['review','prepare','arm','pause','resume','override']}
];}
function fflIntegrationActor_(a,t){return draftActor(a,fflIntegrationGrants_(),t);}
function fflIntegrationInstance_(){return PropertiesService.getScriptProperties().getProperty('FFL_INTEGRATION_INSTANCE');}
function fflIntegrationAuth_(){
 const cache=CacheService.getScriptCache(),instance=fflIntegrationInstance_();
 return createDraftAuth({assertLogin:fflIntegrationAssert_,accounts:()=>fflIntegrationGrants_().map(g=>({email:g.email,password:'synthetic-only',team:g.teams[0].name})),actor:fflIntegrationActor_,now:Date.now,randomToken:()=>Utilities.getUuid(),hash:fflIntegrationHash_,get:k=>cache.get(instance+':'+k),put:(k,v,t)=>cache.put(instance+':'+k,v,t),remove:k=>cache.remove(instance+':'+k),withLock:fn=>{const l=LockService.getScriptLock();l.waitLock(10000);try{return fn();}finally{l.releaseLock();}}});
}
function fflIntegrationStore_(){
 let sheet;
 function assertSheet(){if(!sheet||sheet.getRange('A1').getValue()!=='FFL_SYNTHETIC_INTEGRATION_V1')throw Error('Wrong synthetic sheet.');}
 return createDraftStore({hash:fflIntegrationHash_,withLock:fn=>{fflIntegrationAssert_();const l=LockService.getScriptLock();l.waitLock(10000);try{const name=PropertiesService.getScriptProperties().getProperty('FFL_INTEGRATION_SHEET');if(!/^Integration_[A-Za-z0-9_-]+$/.test(name||''))throw Error('No isolated integration sheet.');sheet=sandboxOpenById_(DRAFT_WORKFLOW_SANDBOX_ID_).getSheetByName(name);assertSheet();return fn();}finally{sheet=null;l.releaseLock();}},
 readHead:()=>JSON.parse(sheet.getRange('B1').getValue()||'null'),readRecord:row=>{const n=Number(sheet.getRange(row,2).getValue());if(!Number.isInteger(n)||n<1||n>100)throw Error('Invalid snapshot');return {hash:sheet.getRange(row,1).getValue(),json:sheet.getRange(row,3,1,n).getValues()[0].join('')};},
 appendRecord:r=>{assertSheet();const chunks=[];for(let i=0;i<r.json.length;i+=30000)chunks.push(r.json.slice(i,i+30000));if(chunks.length>100)throw Error('Archive required');if(sheet.getMaxColumns()<chunks.length+2)sheet.insertColumnsAfter(sheet.getMaxColumns(),chunks.length+2-sheet.getMaxColumns());const row=Math.max(3,sheet.getLastRow()+1);if(sheet.getMaxRows()<row)sheet.insertRowsAfter(sheet.getMaxRows(),row-sheet.getMaxRows());sheet.getRange(row,1,1,chunks.length+2).setValues([[r.hash,chunks.length,...chunks]]);return row;},writeHead:h=>{assertSheet();sheet.getRange('B1').setValue(JSON.stringify(h));},flush:()=>SpreadsheetApp.flush()});
}
function fflInitializeIntegrationRehearsal(){
 fflIntegrationAssert_();const p=PropertiesService.getScriptProperties();if(p.getProperty('FFL_INTEGRATION_INSTANCE'))throw Error('Existing rehearsal retained; use it or explicitly archive before resetting.');
 const before=fflOwnerSharedFingerprint_(),now=Date.now(),instance='integration-'+Utilities.getUuid();
 const teams=[{id:'a',name:'Synthetic Alpha'},{id:'b',name:'Synthetic Beta'}],players=Array.from({length:44},(_,i)=>({id:'s'+i,name:'Synthetic Player '+String(i+1).padStart(2,'0'),club:'TEST',careerGames:i%10===0?20:100,listStatus:'active',history:{a:{verified:true,retains:0},b:{verified:true,retains:0}}}));
 const draft=FFLDraft.create({kind:'preseason',season:2027,opensAt:new Date(now-60000).toISOString(),locksAt:new Date(now+86400000).toISOString(),draftAt:new Date(now+172800000).toISOString()},teams,players,{a:players.slice(0,20).map(x=>x.id),b:players.slice(20,40).map(x=>x.id)});
 const state=FFLDevelopment.create(draft,new Date(now+180000000).toISOString());state.testNow=now;
 const name='Integration_'+Utilities.getUuid().replace(/-/g,'').slice(0,12),sheet=sandboxOpenById_(DRAFT_WORKFLOW_SANDBOX_ID_).insertSheet(name);sheet.getRange('A1').setValue('FFL_SYNTHETIC_INTEGRATION_V1');SpreadsheetApp.flush();p.setProperty('FFL_INTEGRATION_INSTANCE',instance);p.setProperty('FFL_INTEGRATION_SHEET',name);fflIntegrationStore_().initialize(state);
 if(before!==fflOwnerSharedFingerprint_())throw Error('Protected data changed.');Logger.log(JSON.stringify({status:'initialized',instance,sheet:name,protectedDataUnchanged:true}));
}
function fflIntegrationProjection_(state,actor){
 const v=FFLDraft.view(state.draft,actor,state.testNow);return Object.assign(v,{revision:state.revision,serverNow:new Date(state.testNow).toISOString(),instanceId:fflIntegrationInstance_(),principalKey:fflIntegrationHash_(actor.id),managedTeams:actor.managedTeams,managingTeam:actor.team,committeeCapabilities:actor.capabilities,notifications:[],integration:FFLDevelopment.view(state,actor)});
}
function fflIntegrationRequest(payload){
 fflIntegrationAssert_();let writing=false;
 try{
  if(payload?.instanceId!==fflIntegrationInstance_()||!payload.instanceId)throw Error('Wrong synthetic instance.');
  const auth=fflIntegrationAuth_();
  if(payload.action==='loginDraftWorkflow'){const session=auth.login(payload);PropertiesService.getScriptProperties().setProperty('FFL_ACCEPTANCE_SESSION_'+String(payload.email).trim().toLowerCase(),fflIntegrationInstance_()+':draft-session:'+fflIntegrationHash_(session.token));return {ok:true,session};}
  if(payload.action==='logoutDraftWorkflow')return {ok:true,...auth.logout(payload.token)};
  const a=auth.validate(payload.token);if(!a.valid)return {ok:false,code:'AUTH_REQUIRED',message:'Sign in to the synthetic rehearsal.'};
  const actor=fflIntegrationActor_(a,payload.managingTeam),store=fflIntegrationStore_();
  if(payload.action==='readDraftWorkflow')return {ok:true,view:fflIntegrationProjection_(store.read().data.state,actor)};
  if(payload.action!=='writeDraftWorkflow'||payload.principalKey!==fflIntegrationHash_(actor.id))throw Error('Invalid synthetic request.');
  const command=payload.command;if(['stageScores','restore','advance','completeDraft'].includes(command?.type))throw Error('Editor-only synthetic control.');
  writing=true;
  const result=store.dispatch(actor,command,Date.now(),(s,c,a)=>{
   try{
    if(['stageSquads','publishSquads','nominate','publishScores'].includes(c.type))return FFLDevelopment.apply(s,c,a,s.testNow,fflIntegrationHash_);
    authorizeDraftAction(a,c,s.draft);return FFLDevelopment.apply(s,{type:'draft',revision:c.revision,command:c},a,s.testNow,fflIntegrationHash_);
   }catch(e){e.code='DRAFT_REJECTED';throw e;}
  });
  const flags=PropertiesService.getScriptProperties();if(command.type==='pick'&&!result.receipt.replayed&&flags.getProperty('FFL_ACCEPTANCE_LOST_REPLY')==='armed'){flags.setProperty('FFL_ACCEPTANCE_LOST_REPLY',JSON.stringify({requestId:command.requestId,revision:result.receipt.revision}));return {ok:false,code:'UNCONFIRMED',message:'Synthetic test: reply withheld after saved pick. Retry to recover.'};}
  const view=fflIntegrationProjection_(result.state,actor);view.receipt=result.receipt;return {ok:true,view};
 }catch(e){return {ok:false,code:!writing||e.code==='DRAFT_REJECTED'?'REJECTED':'UNCONFIRMED',message:e.message};}
}
function fflAdvanceIntegrationClock(){
 const store=fflIntegrationStore_(),s=store.read().data.state,actor=fflIntegrationActor_({valid:true,email:'committee@example.invalid',team:'Synthetic Alpha'});
 const next=s.testNow<Date.parse(s.draft.config.locksAt)?Date.parse(s.draft.config.locksAt):s.testNow<Date.parse(s.draft.config.draftAt)?Date.parse(s.draft.config.draftAt):Date.parse(s.round.lockoutAt);
 const r=store.dispatch(actor,{type:'advance',revision:s.revision,requestId:Utilities.getUuid()},Date.now(),(state,c,a)=>{if(c.revision!==state.revision)throw Error('Stale');state.testNow=next;state.revision++;return state;});Logger.log(JSON.stringify({revision:r.state.revision,clock:new Date(r.state.testNow).toISOString(),phase:FFLDraft.phase(r.state.draft,r.state.testNow)}));
}
function fflRunIntegrationCompletion(){
 fflIntegrationAssert_();const before=fflOwnerSharedFingerprint_(),ownerHash=draftWorkflowStore_().read().hash,store=fflIntegrationStore_(),actor=fflIntegrationActor_({valid:true,email:'committee@example.invalid',team:'Synthetic Alpha'});
 const dispatch=(type,data={},who=actor)=>{const s=store.read().data.state;return store.dispatch(who,{type,revision:s.revision,requestId:Utilities.getUuid(),...data},Date.now(),(state,c,a)=>FFLDevelopment.apply(state,c,a,state.testNow,fflIntegrationHash_));};
 let s=store.read().data.state;if(FFLDraft.phase(s.draft,s.testNow)!=='drafting')throw Error('Open the synthetic draft before completing it.');
 if(s.testNow>=Date.parse(s.round.lockoutAt)&&!Object.keys(s.round.nominations).length&&!s.round.published){s=store.dispatch(actor,{type:'scheduleSyntheticRound',revision:s.revision,requestId:Utilities.getUuid()},Date.now(),state=>{state.round.lockoutAt=new Date(state.testNow+7200000).toISOString();state.revision++;return state;}).state;}
 const startingPicks=s.draft.picks.length;
 while(s.draft.picks.length<s.draft.plan.length){
  const team=s.draft.plan[s.draft.picks.length].team,who={id:team+'@example.invalid',team,role:'coach',capabilities:[]};
  const player=s.draft.players.find(p=>FFLDraft.available(s.draft,p.id).ok);if(!player)throw Error('No legal synthetic pick');
  s=dispatch('draft',{command:{type:'pick',player:player.id,expectedPick:s.draft.picks.length}},who).state;
 }
 dispatch('stageSquads');s=store.read().data.state;const proposal=s.proposal.hash;
 const publication={type:'publishSquads',revision:s.revision,requestId:Utilities.getUuid(),approvedHash:proposal};
 const publish=()=>store.dispatch(actor,publication,Date.now(),(state,c,a)=>FFLDevelopment.apply(state,c,a,state.testNow,fflIntegrationHash_));
 publish();const replay=publish();if(!replay.receipt.replayed)throw Error('Publication replay failed');
 s=store.read().data.state;
 // Test outbox delivery to a capture sheet only. There is no MailApp/GmailApp call.
 const book=sandboxOpenById_(DRAFT_WORKFLOW_SANDBOX_ID_),outName=PropertiesService.getScriptProperties().getProperty('FFL_INTEGRATION_SHEET')+'_Outbox';
 const out=book.getSheetByName(outName)||book.insertSheet(outName);out.getRange('A1').setValue('FFL_SYNTHETIC_OUTBOX_V1');
 const context=()=>({now:s.testNow,rounds:[{id:s.round.id,lockoutAt:s.round.lockoutAt,teams:s.draft.teams.map(t=>({...t,submitted:!!s.round.nominations[t.id]}))}]});
 const services={emailEnabled:true,readContext:context,resolveRecipient:t=>t+'@example.invalid',save:l=>{out.getRange('B1').setValue(JSON.stringify(l));SpreadsheetApp.flush();},send:m=>{if(!m.to.endsWith('@example.invalid'))throw Error('Synthetic recipients only');out.appendRow([m.notificationId,m.to,m.subject,'CAPTURED_NOT_SENT']);SpreadsheetApp.flush();return {accepted:true,id:m.notificationId};}};
 let ledger=JSON.parse(out.getRange('B1').getValue()||'null');ledger=FFLNotifications.dispatch(ledger,context(),services);const captures=out.getLastRow();ledger=FFLNotifications.dispatch(ledger,context(),services);if(out.getLastRow()!==captures)throw Error('Duplicate notification capture');
 for(const team of s.draft.teams){const ids=s.squads[team.id];dispatch('nominate',{squadVersion:s.squadVersion,nomination:{starters:ids.slice(0,7),reserves:ids.slice(7,14)}},{id:team.id+'@example.invalid',team:team.id,role:'coach'});}
 fflAdvanceIntegrationClock();s=store.read().data.state;
 const evidence={sourceVersion:'synthetic-rehearsal-v1',complete:true,verified:true,clubOrder:[['TEST',1]],stats:Object.fromEntries(s.draft.players.map((p,i)=>[p.id,{K:10,H:5,D:15,M:3,HO:2,T:4,G:i%3,B:1}]))};
 dispatch('stageScores',{evidence});s=store.read().data.state;dispatch('publishScores',{approvedHash:s.proposal.hash});
 const backup=store.read(),backupState=backup.data.state;
 evidence.stats[backupState.squads.a[0]].G+=2;dispatch('stageScores',{evidence});s=store.read().data.state;dispatch('publishScores',{approvedHash:s.proposal.hash,reason:'Synthetic correction rehearsal'});
 const verifiedBackup=store.readRecord(backup.row,backup.hash).data.state;
 dispatch('restore',{backup:verifiedBackup,backupHash:fflIntegrationHash_(JSON.stringify(verifiedBackup)),reason:'Checksum-verified restore rehearsal'});
 s=store.read().data.state;if(JSON.stringify(s.round)!==JSON.stringify(backupState.round))throw Error('Restore did not reproduce the published round');
 if(before!==fflOwnerSharedFingerprint_()||ownerHash!==draftWorkflowStore_().read().hash)throw Error('Protected or owner data changed');
 const report={status:'passed',startingBrowserPicks:startingPicks,totalPicks:s.draft.picks.length,squadSizes:Object.values(s.squads).map(x=>x.length),weeklySubmissions:Object.keys(s.round.nominations).length,ladderTeams:s.round.published.ladder.length,publicationReplay:true,notificationCaptureRows:captures-1,realEmailsSent:0,correctionAndRestore:true,revision:s.revision,protectedDataUnchanged:true,ownerRehearsalUnchanged:true};
 out.getRange('C1').setValue(JSON.stringify(report));Logger.log('FFL_INTEGRATION '+JSON.stringify(report));return report;
}

function fflStartMidseasonAcceptance(){
 fflIntegrationAssert_();const p=PropertiesService.getScriptProperties();if(p.getProperty('FFL_ACCEPTANCE_ARCHIVE'))throw Error('Acceptance already initialized; preserve evidence.');
 const previous=fflIntegrationStore_().read();if(!previous.data.state.squads||!previous.data.state.round.published)throw Error('Complete preseason integration first');
 const prior=previous.data.state,now=Date.now(),archive={instance:p.getProperty('FFL_INTEGRATION_INSTANCE'),sheet:p.getProperty('FFL_INTEGRATION_SHEET'),hash:previous.hash,protectedHash:fflOwnerSharedFingerprint_(),ownerHash:draftWorkflowStore_().read().hash};
 const draft=FFLDraft.create({kind:'midseason',season:2027,opensAt:new Date(now-60000).toISOString(),locksAt:new Date(now+86400000).toISOString(),draftAt:new Date(now+172800000).toISOString()},prior.draft.teams,prior.draft.players,prior.squads),state=FFLDevelopment.create(draft,new Date(now+180000000).toISOString());state.testNow=now;
 const name='Integration_'+Utilities.getUuid().replace(/-/g,'').slice(0,12),sheet=sandboxOpenById_(DRAFT_WORKFLOW_SANDBOX_ID_).insertSheet(name);sheet.getRange('A1').setValue('FFL_SYNTHETIC_INTEGRATION_V1');SpreadsheetApp.flush();
 p.setProperty('FFL_ACCEPTANCE_ARCHIVE',JSON.stringify(archive));p.setProperty('FFL_INTEGRATION_INSTANCE','midseason-'+Utilities.getUuid());p.setProperty('FFL_INTEGRATION_SHEET',name);fflIntegrationStore_().initialize(state);p.setProperty('FFL_INTEGRATION_BROWSER','true');
 Logger.log(JSON.stringify({status:'midseason-ready',revision:0,previousEvidencePreserved:true,teams:draft.teams.map(t=>({team:t.id,players:state.draft.baselineSquads[t.id]}))}));
}
function fflArmAcceptanceLostReply(){fflIntegrationAssert_();PropertiesService.getScriptProperties().setProperty('FFL_ACCEPTANCE_LOST_REPLY','armed');Logger.log('One synthetic pick reply will be withheld after its save.');}
function fflExpireAcceptanceAlpha(){
 fflIntegrationAssert_();const key=PropertiesService.getScriptProperties().getProperty('FFL_ACCEPTANCE_SESSION_alpha@example.invalid');if(!key||!key.startsWith(fflIntegrationInstance_()+':'))throw Error('Sign in Alpha first');const cache=CacheService.getScriptCache(),raw=cache.get(key);if(!raw)throw Error('Session already absent');const auth=JSON.parse(raw);auth.expiresAt=0;cache.put(key,JSON.stringify(auth),600);Logger.log('Synthetic Alpha session expired; Beta untouched.');
}
function fflReportAcceptance(){
 fflIntegrationAssert_();const p=PropertiesService.getScriptProperties(),s=fflIntegrationStore_().read().data.state,a=JSON.parse(p.getProperty('FFL_ACCEPTANCE_ARCHIVE')||'null');if(!a)throw Error('No acceptance archive');
 const previous=sandboxOpenById_(DRAFT_WORKFLOW_SANDBOX_ID_).getSheetByName(a.sheet),head=JSON.parse(previous.getRange('B1').getValue());
 const report={kind:s.draft.config.kind,phase:FFLDraft.phase(s.draft,s.testNow),revision:s.revision,picks:s.draft.picks,privateQueues:s.draft.queues,uniquePlayers:new Set(s.draft.picks.map(x=>x.player)).size,lostReply:JSON.parse(p.getProperty('FFL_ACCEPTANCE_LOST_REPLY')||'null'),protectedDataUnchanged:a.protectedHash===fflOwnerSharedFingerprint_(),ownerUnchanged:a.ownerHash===draftWorkflowStore_().read().hash,preseasonEvidenceUnchanged:a.hash===head.hash};
 if(report.phase==='validation')report.squadSizes=Object.values(FFLDraft.finalSquads(s.draft)).map(x=>x.length);
 Logger.log(JSON.stringify(report));return report;
}
function fflPrepareMidseasonAcceptance(){
 fflIntegrationAssert_();const store=fflIntegrationStore_(),actor=fflIntegrationActor_({valid:true,email:'committee@example.invalid',team:'Synthetic Alpha'});let s=store.read().data.state;
 if(s.draft.config.kind!=='midseason'||s.draft.prepared||s.draft.teams.some(t=>s.draft.choices[t.id].submitted===null))throw Error('Both synthetic midseason submissions required.');
 fflAdvanceIntegrationClock();for(const type of ['prepare','arm']){s=store.read().data.state;store.dispatch(actor,{type,revision:s.revision,requestId:Utilities.getUuid()},Date.now(),(state,c,a)=>FFLDevelopment.apply(state,{type:'draft',revision:c.revision,command:c},a,state.testNow,fflIntegrationHash_));}
 fflAdvanceIntegrationClock();fflArmAcceptanceLostReply();Logger.log('Midseason draft armed with one lost-reply test.');
}
