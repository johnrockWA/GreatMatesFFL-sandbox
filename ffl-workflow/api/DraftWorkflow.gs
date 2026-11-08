/** Prepared authenticated shared-draft adapter. No HTTP route is installed here.
 * Load draft-engine.js, notifications.js, draft-store.js and draft-access.js first.
 * Pass only the result of server-side validateToken; never a client identity/role.
 * FFL_DRAFT_IDENTITIES must be an explicit reviewed server-side JSON registry.
 */
const DRAFT_WORKFLOW_SANDBOX_ID_ = '1kKPBj6Kj0riZ8QyOO0KIgliO9-gyNjZxE4mAc6ZAnDE';
function draftWorkflowActor_(auth,managedTeam) {
  const raw=PropertiesService.getScriptProperties().getProperty('FFL_DRAFT_IDENTITIES');
  return draftActor(auth,JSON.parse(raw||'[]'),managedTeam);
}
function draftWorkflowSheet_() {
  sandboxAssertProject_();
  const book=sandboxOpenById_(DRAFT_WORKFLOW_SANDBOX_ID_);
  const sheet=book.getSheetByName('DraftWorkflow_State');
  if(!sheet||sheet.getRange('A1').getValue()!=='FFL_DRAFT_STORE_V2')throw Error('Draft workflow storage has not been initialized.');
  return sheet;
}
function draftWorkflowStore_() {
  const sheet=draftWorkflowSheet_();
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
    withLock:function(fn){const lock=LockService.getScriptLock();lock.waitLock(10000);try{return fn();}finally{lock.releaseLock();}}
  });
}
function draftWorkflowResponse_(state,actor,now){
  const view=FFLDraft.view(state,actor.capabilities.includes('review')?actor:{...actor,role:'coach'},now);
  view.serverNow=new Date(now).toISOString();
  view.actorRole=actor.role;
  view.principalKey=draftWorkflowPrincipalKey_(actor);
  view.instanceId=PropertiesService.getScriptProperties().getProperty('FFL_DRAFT_INSTANCE');
  view.managedTeams=actor.managedTeams;
  view.managingTeam=actor.team;
  view.committeeCapabilities=actor.capabilities;
  view.notifications=FFLNotifications.draftAlerts(state,now).filter(n=>n.channel==='in-app'&&n.team===actor.team);
  return view;
}
function getDraftWorkflow_(auth,managedTeam) {
  const actor=draftWorkflowActor_(auth,managedTeam),snapshot=draftWorkflowStore_().read();
  if(!snapshot)throw Error('Draft workflow storage has not been initialized.');
  return draftWorkflowResponse_(snapshot.data.state,actor,Date.now());
}
function postDraftWorkflow_(auth,action,managedTeam) {
  const actor=draftWorkflowActor_(auth,managedTeam);authorizeDraftAction(actor,action);
  draftWorkflowAssertWrites_();
  const result=draftWorkflowStore_().dispatch(actor,action,Date.now(),function(state,command,who,now){try{authorizeDraftAction(who,command,state);return FFLDraft.apply(state,command,who,now);}catch(error){error.code='DRAFT_REJECTED';throw error;}});
  const response=draftWorkflowResponse_(result.state,actor,Date.now());response.receipt=result.receipt;return response;
}

// Draft-only writes never enable the legacy competition write switch.
function draftWorkflowAssertWrites_(){
  sandboxAssertProject_();
  const p=PropertiesService.getScriptProperties();
  if(!draftWorkflowProjectMatches_()||p.getProperty('FFL_DRAFT_WRITES_ENABLED')!=='true'||p.getProperty('FFL_SANDBOX_WRITES_ENABLED')==='true')throw Error('Isolated draft writes are disabled.');
}

function draftWorkflowPrincipalKey_(actor){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,actor.id));}

function draftWorkflowProjectMatches_(){
  const expected=PropertiesService.getScriptProperties().getProperty('FFL_DRAFT_PROJECT_ID');
  return typeof expected==='string'&&expected.length>0&&ScriptApp.getScriptId()===expected;
}
