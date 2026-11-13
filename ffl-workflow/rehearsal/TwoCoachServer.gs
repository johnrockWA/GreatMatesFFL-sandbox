function draftWorkflowStore_Original_(){return draftWorkflowStore_();}
/* Owner-only, editor-run synthetic two-identity check. No installed route. */
function fflRunTwoCoachRehearsal_(){
 fflOwnerSharedAssert_();
 const protectedBefore=fflOwnerSharedFingerprint_(),originalHead=draftWorkflowStore_Original_().read();
 const run='pair-'+Utilities.getUuid(),now=Date.now(),cache=CacheService.getScriptCache();
 const book=sandboxOpenById_(DRAFT_WORKFLOW_SANDBOX_ID_);
 const sheetName='Rehearsal_'+run.slice(0,18),sheet=book.insertSheet(sheetName);
 sheet.getRange('A1:C2').setValues([['FFL_DRAFT_STORE_V2','','SYNTHETIC_PAIR_ONLY'],['Hash','Chunk count','Two-coach rehearsal']]);SpreadsheetApp.flush();
 function draftWorkflowSheet_(){if(sheet.getRange('C1').getValue()!=='SYNTHETIC_PAIR_ONLY')throw Error('Wrong rehearsal sheet');return sheet;}
 const hash=s=>Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s));
 const grants=[{email:'alpha@example.invalid',role:'coach',teams:[{id:'7',name:'Rockstars'}],capabilities:[]},{email:'beta@example.invalid',role:'coach',teams:[{id:'test-opponent',name:'Test opponent (synthetic)'}],capabilities:[]}];
 function draftWorkflowActor_(auth,team){return draftActor(auth,grants,team);}
 function draftWorkflowResponse_(state,actor,t){const v=FFLDraft.view(state,actor,t);return Object.assign(v,{serverNow:new Date(t).toISOString(),instanceId:run,principalKey:hash(actor.id),managedTeams:actor.managedTeams,managingTeam:actor.team,committeeCapabilities:[]});}
function draftWorkflowStore_() {
  // Open and validate the sheet only after acquiring the transaction lock.
  // Even the marker read can populate Sheets' read-ahead cache before a wait.
  let sheet=null;
  const hash=json=>Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,json));
  return createDraftStore({hash,
    readHead:function(){return JSON.parse(sheet.getRange('B1').getValue()||'null');},
    readRecord:function(row){
      if(!Number.isInteger(row)||row<3||row>sheet.getLastRow())throw Error('Invalid draft snapshot row.');
      const header=sheet.getRange(row,1,1,2).getValues()[0],count=header[1];
      if(!Number.isInteger(count)||count<1||count>100||count+2>sheet.getMaxColumns())throw Error('Invalid draft snapshot chunks.');
      return {hash:header[0],json:sheet.getRange(row,3,1,count).getValues()[0].join('')};
    },
    appendRecord:function(record){
      draftWorkflowAssertWrites_();
      const chunks=[];for(let i=0;i<record.json.length;i+=30000)chunks.push(record.json.slice(i,i+30000));
      if(!chunks.length||chunks.length>100)throw Error('Draft snapshot needs archival before further writes.');
      const row=Math.max(3,sheet.getLastRow()+1),values=[record.hash,chunks.length,...chunks];
      if(sheet.getMaxColumns()<values.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),values.length-sheet.getMaxColumns());
      if(sheet.getMaxRows()<row)sheet.insertRowsAfter(sheet.getMaxRows(),row-sheet.getMaxRows());
      sheet.getRange(row,1,1,values.length).setValues([values]);return row;
    },
    writeHead:function(head){draftWorkflowAssertWrites_();sheet.getRange('B1').setValue(JSON.stringify(head));},
    flush:function(){SpreadsheetApp.flush();},
    withLock:function(fn){
      const lock=LockService.getScriptLock();lock.waitLock(10000);
      try{sheet=draftWorkflowSheet_();return fn();}
      finally{sheet=null;lock.releaseLock();}
    }
  });
}
function postDraftWorkflow_(auth,action,managedTeam) {
  const actor=draftWorkflowActor_(auth,managedTeam);authorizeDraftAction(actor,action);
  draftWorkflowAssertWrites_();
  const result=draftWorkflowStore_().dispatch(actor,action,Date.now(),function(state,command,who,now){try{if(command.revision!==state.revision)throw Error(command.type==='pick'?'The draft changed. Refresh and review the current turn before picking.':'The draft changed. Refresh and try again.');authorizeDraftAction(who,command,state);return FFLDraft.apply(state,command,who,now);}catch(error){error.code='DRAFT_REJECTED';throw error;}});
  const response=draftWorkflowResponse_(result.state,actor,Date.now());response.receipt=result.receipt;return response;
}


 const store=draftWorkflowStore_();let state=fflOwnerSharedInitial_(now);
 state.config={kind:'preseason',season:2027,opensAt:new Date(now-120000).toISOString(),locksAt:new Date(now-60000).toISOString(),draftAt:new Date(now-30000).toISOString()};
 const committee={id:'synthetic-preparation',team:'7',role:'commissioner'};
 for(const t of state.teams)state=FFLDraft.apply(state,{type:'override',team:t.id,value:{normal:[],fookies:[],delists:[]},reason:'Synthetic fixture',revision:state.revision},committee,now);
 for(const type of ['prepare','arm'])state=FFLDraft.apply(state,{type,revision:state.revision},committee,now);
 state.revision=0;state.audit=[];store.initialize(state);
 const passwords=[Utilities.getUuid(),Utilities.getUuid()],accounts=grants.map((g,i)=>({email:g.email,password:passwords[i],team:g.teams[0].name}));
 const keys=[];
 const auth=createDraftAuth({assertLogin:fflOwnerSharedAssert_,accounts:()=>accounts,actor:draftWorkflowActor_,now:Date.now,randomToken:()=>Utilities.getUuid(),hash,
 get:k=>cache.get(run+':'+k),put:(k,v,ttl)=>{keys.push(run+':'+k);cache.put(run+':'+k,v,ttl);},remove:k=>cache.remove(run+':'+k),withLock:fn=>{const l=LockService.getScriptLock();l.waitLock(10000);try{return fn();}finally{l.releaseLock();}}});
 const service=createDraftService({assertEnvironment:fflOwnerSharedAssert_,validateToken:auth.validate,actor:draftWorkflowActor_,instance:()=>run,principalKey:a=>hash(a.id),authorize:authorizeDraftAction,assertWrites:draftWorkflowAssertWrites_,
 login:auth.login,read:(a,t)=>draftWorkflowResponse_(store.read().data.state,draftWorkflowActor_(a,t),Date.now()),write:postDraftWorkflow_});
 const check=(ok,msg)=>{if(!ok)throw Error(msg);};
 try{
  const sessions=accounts.map(a=>{const r=service({action:'loginDraftWorkflow',instanceId:run,email:a.email,password:a.password});check(r.ok,'Synthetic login failed');return r.session;});
  const read=i=>service({action:'readDraftWorkflow',instanceId:run,token:sessions[i].token});
  const write=(i,command)=>service({action:'writeDraftWorkflow',instanceId:run,token:sessions[i].token,principalKey:hash(grants[i].email),command});
  const action=(i,type,fields)=>{const v=read(i);check(v.ok,'Read failed');return write(i,Object.assign({type,revision:v.view.revision,requestId:Utilities.getUuid()},fields));};
  check(action(0,'queue',{players:['test-player-24']}).ok,'Alpha queue failed');
  check(action(1,'queue',{players:['test-player-0']}).ok,'Beta queue failed');
  check(read(0).view.queues['test-opponent']===undefined&&read(1).view.queues['7']===undefined,'Private queue disclosed');
  const denied=action(1,'pick',{player:'test-player-0',expectedPick:0});check(!denied.ok&&denied.code==='REJECTED','Out-of-turn pick accepted');
  const first={type:'pick',revision:read(0).view.revision,requestId:Utilities.getUuid(),player:'test-player-24',expectedPick:0};
  const accepted=write(0,first);check(accepted.ok,'First pick failed');
  check(action(1,'pick',{player:'test-player-0',expectedPick:1}).ok,'Second coach pick failed');
  const replay=write(0,first);check(replay.ok&&replay.view.receipt.replayed===true&&replay.view.receipt.revision===accepted.view.receipt.revision,'Original receipt not recovered');
  const stale=write(0,Object.assign({},first,{requestId:Utilities.getUuid()}));check(!stale.ok&&/current turn/.test(stale.message),'Stale pick not clearly rejected');
  const cross=service({action:'readDraftWorkflow',instanceId:run,token:sessions[0].token,managingTeam:'test-opponent'});check(!cross.ok,'Other team access allowed');
  const final=store.read().data.state;check(final.picks.length===2&&final.audit.filter(a=>a.type==='pick').length===2,'Duplicate picks');
  check(JSON.stringify(final.officialSquads)===JSON.stringify(state.officialSquads),'Synthetic official squads changed');
  check(fflOwnerSharedFingerprint_()===protectedBefore,'Protected records changed');
  check(draftWorkflowStore_Original_().read().hash===originalHead.hash,'Owner rehearsal changed');
  const report={status:'passed',sheet:sheetName,revision:final.revision,picks:2,authenticatedSyntheticIdentities:2,checks:['separate-token-login','private-queues','out-of-turn-denial','alternating-picks','receipt-replay-after-next-turn','stale-pick-message','cross-team-denial'],ownerRehearsalUnchanged:true,protectedDataUnchanged:true,browserSessions:false};
  Logger.log('TWO_COACH_REHEARSAL '+JSON.stringify(report));return report;
 }finally{cache.removeAll(keys);PropertiesService.getScriptProperties().deleteProperty('FFL_OWNER_LOST_REPLY_20261113');}
}
