/** Prepared sandbox adapter. Not connected to deployed routes yet.
 * Install the shared engine as DraftEngine.gs first.
 * Never accept actor, role, clock or initial state from an HTTP payload.
 * Call getDraftWorkflow_ / postDraftWorkflow_ only AFTER validateToken in Code.gs.
 */
const DRAFT_WORKFLOW_SANDBOX_ID_ = '1kKPBj6Kj0riZ8QyOO0KIgliO9-gyNjZxE4mAc6ZAnDE';
function draftWorkflowActor_(auth) {
  if (!auth || auth.valid !== true || !auth.email || !auth.team) throw new Error('Authenticated coach mapping required.');
  const props=PropertiesService.getScriptProperties(),email=String(auth.email).trim().toLowerCase();
  const teamIds=JSON.parse(props.getProperty('FFL_TEAM_IDS')||'{}');
  if(!Object.prototype.hasOwnProperty.call(teamIds,auth.team))throw new Error('Verified team mapping required.');
  const commissioner=props.getProperty('FFL_COMMISSIONER_EMAIL'),president=props.getProperty('FFL_PRESIDENT_EMAIL');
  return {id:email,team:String(teamIds[auth.team]),role:email===(commissioner||'').toLowerCase()?'commissioner':email===(president||'').toLowerCase()?'president':'coach'};
}
function draftWorkflowSheet_() {
  sandboxAssertProject_();
  const book=SpreadsheetApp.openById(DRAFT_WORKFLOW_SANDBOX_ID_);
  const sheet=book.getSheetByName('DraftWorkflow_State');
  if(!sheet)throw new Error('Draft workflow storage has not been initialized.');
  return sheet;
}
function draftWorkflowRead_() {
  const sheet=draftWorkflowSheet_(),row=Number(sheet.getRange('A1').getValue());
  if(!Number.isInteger(row)||row<3)throw new Error('No committed draft workflow.');
  const head=sheet.getRange(row,1,1,3).getValues()[0],count=Number(head[1]);
  if(!Number.isInteger(count)||count<1||count>100)throw new Error('Invalid draft snapshot.');
  const json=sheet.getRange(row,4,1,count).getValues()[0].join('');
  const digest=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,json));
  if(digest!==head[2])throw new Error('Draft snapshot checksum mismatch.');
  const state=JSON.parse(json);if(state.revision!==Number(head[0]))throw new Error('Draft revision mismatch.');return state;
}
function draftWorkflowWrite_(state) {
  sandboxAssertWritesEnabled_();
  const sheet=draftWorkflowSheet_(),json=JSON.stringify(state),chunks=[];
  for(let i=0;i<json.length;i+=30000)chunks.push(json.slice(i,i+30000));
  if(chunks.length>100)throw new Error('Draft snapshot needs archival before further writes.');
  const row=Math.max(3,sheet.getLastRow()+1),values=[state.revision,chunks.length,Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,json)),...chunks];
  if(sheet.getMaxColumns()<values.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),values.length-sheet.getMaxColumns());
  if(sheet.getMaxRows()<row)sheet.insertRowsAfter(sheet.getMaxRows(),row-sheet.getMaxRows());
  sheet.getRange(row,1,1,values.length).setValues([values]);SpreadsheetApp.flush();
  // Publish only a fully written snapshot. A failed write leaves the old pointer intact.
  sheet.getRange('A1').setValue(row);SpreadsheetApp.flush();
}
function getDraftWorkflow_(auth) {
  const actor=draftWorkflowActor_(auth),lock=LockService.getScriptLock();lock.waitLock(10000);
  try{return FFLDraft.view(draftWorkflowRead_(),actor,Date.now());}finally{lock.releaseLock();}
}
function postDraftWorkflow_(auth,action) {
  const actor=draftWorkflowActor_(auth),lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    // Finalization must also switch the squad reader used by weekly selection.
    // This guard stays until that integration is implemented and rollback-tested.
    if(action.type==='finalize')throw new Error('Shared squad publication is not connected yet. Finalization is disabled.');
    const state=FFLDraft.apply(draftWorkflowRead_(),action,actor,Date.now());
    draftWorkflowWrite_(state);return FFLDraft.view(state,actor,Date.now());
  }finally{lock.releaseLock();}
}
