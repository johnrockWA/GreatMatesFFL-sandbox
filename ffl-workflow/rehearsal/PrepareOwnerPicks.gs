/* Temporary editor-only helper for the existing owner-only synthetic host.
 * The trailing underscore prevents calls from google.script.run.
 * Does not alter identity grants, operational writes or official records.
 */
function fflPrepareOwnerPicks_(){
 const owner=fflOwnerSharedAssert_();
 const before=fflOwnerSharedFingerprint_(),store=draftWorkflowStore_(),now=Date.now();
 const template=fflOwnerSharedInitial_(now);
 const actor={id:'synthetic-editor-preparation',role:'commissioner',team:owner.team};
 function assertSynthetic(s){
  for(const key of ['teams','players','baselineSquads','officialSquads']){
   if(JSON.stringify(s[key])!==JSON.stringify(template[key]))throw Error('Unexpected rehearsal data: '+key);
  }
  if(s.config.kind!=='preseason'||s.config.season!==2027||s.picks.length||s.finalizedAt||s.paused)throw Error('Rehearsal already advanced or unexpected.');
  if(s.choices[owner.team].submitted===null)throw Error('Owner selections must already be submitted.');
 }
 let state=store.read().data.state;assertSynthetic(state);
 function step(type,fields){
  const action=Object.assign({type,revision:state.revision,requestId:'owner-pick-prep-'+Utilities.getUuid()},fields||{});
  state=store.dispatch(actor,action,now,function(s,a,u,t){assertSynthetic(s);return FFLDraft.apply(s,a,u,t);}).state;
 }
 if(!state.prepared){
  step('schedule',{dates:{opensAt:new Date(now-120000).toISOString(),locksAt:new Date(now-60000).toISOString(),draftAt:new Date(now-30000).toISOString()},reason:'Owner-only synthetic competing-pick rehearsal'});
  if(state.choices['test-opponent'].submitted===null)step('override',{team:'test-opponent',value:{normal:[],fookies:[],delists:[]},reason:'Synthetic opponent submits no retains for rehearsal'});
  step('prepare');
 }
 if(!state.armed)step('arm');
 if(FFLDraft.phase(state,now)!=='drafting'||state.plan[0].team!==owner.team)throw Error('First pick did not open for owner.');
 if(before!==fflOwnerSharedFingerprint_())throw Error('Protected data changed.');
 const report={status:'ready',revision:state.revision,phase:'drafting',picks:state.picks.length,protectedDataUnchanged:true,coachPermissionsUnchanged:true};
 Logger.log('OWNER_PICK_REHEARSAL '+JSON.stringify(report));return report;
}
