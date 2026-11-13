/* Shared presentation contract. It never calculates, approves or publishes scores. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FFLScoreStatus=api;
})(typeof window==='object'?window:this,function(){
 'use strict';
 const finiteScore=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stamp=value=>typeof value==='string'&&value.trim()?Date.parse(value):NaN;
 const at=value=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Perth',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value))+' AWST';
 function describe(payload,{now=Date.now(),hasScores=false,scoresComplete=hasScores,legacyComplete=false}={}){
  const meta=payload?.scoreState;
  const unavailable=reason=>({code:'unavailable',label:'Status unavailable',tone:'neutral',canDeclareResult:false,detail:reason,warnings:[]});
  if(!meta){
   return {code:hasScores?'recorded':'pending',label:hasScores?'Recorded scores':'Scores pending',tone:'neutral',
    canDeclareResult:legacyComplete===true&&scoresComplete,detail:hasScores?'Live update status is not supplied for these recorded scores.':'No scores have been received.',warnings:[]};
  }
  if(meta.schema!==1||typeof meta.snapshotId!=='string'||!meta.snapshotId||payload.scoreSnapshotId!==meta.snapshotId||
   !['scheduled','live','finished'].includes(meta.phase)||!['pending','verified','disputed'].includes(meta.verification)||
   ['coverageComplete','finalised','correctionPending','collectorActive'].some(key=>typeof meta[key]!=='boolean')||
   (payload.round&&meta.round&&payload.round!==meta.round)||!Number.isFinite(now))return unavailable('Score and status snapshots could not be matched.');
  // Existing snapshots keep their original verifier; never relabel old scores.
  if(meta.source!=='OfficialAFL'||!['AFLTables','FinalSiren'].includes(meta.verifier))return unavailable('The statistics sources could not be confirmed.');
  const collected=stamp(meta.collectedAt),sourceUpdated=stamp(meta.sourceUpdatedAt),warnings=[];
  if(!Number.isFinite(collected)||collected>now||Number.isFinite(sourceUpdated)&&sourceUpdated>now)return unavailable('The update time could not be confirmed.');
  let code,label,tone='neutral',canDeclareResult=false;
  const final=meta.phase==='finished'&&meta.verification==='verified'&&meta.coverageComplete===true&&
   meta.finalised===true&&meta.correctionPending===false&&scoresComplete&&payload.complete!==false;
  if(final){code='final';label='Final — verified';tone='final';canDeclareResult=true;}
  else if(meta.verification==='disputed'){code='held';label='Held — statistics differ';tone='warning';}
  else if(meta.phase==='scheduled'){code='scheduled';label='Scheduled';}
  else if(meta.phase==='live'){code='live';label='Live — provisional';tone='live';}
  else if(meta.verification==='pending'){code='awaiting-verification';label='Finished — awaiting verification';tone='warning';}
  else if(meta.correctionPending===true){code='correction';label='Correction awaiting approval';tone='warning';}
  else {code='awaiting-finalisation';label='Verified — awaiting finalisation';tone='warning';}
  if(!final){
   if(meta.correctionPending===true&&code!=='correction')warnings.push('Correction awaiting approval.');
   const interval=meta.refreshMinutes;
   if(!Number.isInteger(interval)||interval<1||interval>30)return unavailable('The update interval could not be confirmed.');
   if(meta.collectorActive===false)warnings.push('Collection paused. Showing the last received scores.');
   else if(now-collected>interval*2*60000)warnings.push('Updates delayed. Showing the last received scores.');
  }
  const detail=['Updated '+at(collected),Number.isFinite(sourceUpdated)?'Source updated '+at(sourceUpdated):null].filter(Boolean).join(' · ');
  return {code,label,tone,canDeclareResult,detail,warnings};
 }
 function render(payload,options){
  const view=describe(payload,options);
  return '<div class="score-state" data-score-state="'+escape(view.code)+'" role="status" aria-live="polite">'+
   (payload?.preview===true?'<span class="score-state-label">Development preview</span>':'')+
   '<span class="score-state-label '+escape(view.tone)+'">'+escape(view.label)+'</span>'+
   '<span class="score-state-detail">'+escape(view.detail)+'</span>'+
   view.warnings.map(w=>'<span class="score-state-warning">'+escape(w)+'</span>').join('')+'</div>';
 }
 function fromShadow(payload,{snapshotId,collectedAt,collectorActive=false,refreshMinutes=5}={}){
  if(payload?.canPublish!==false||payload.source!=='OfficialAFL'||!['AFLTables','FinalSiren'].includes(payload.verifier)||!Array.isArray(payload.matches)||!payload.matches.length||!Array.isArray(payload.teams)||!payload.round||!snapshotId)throw Error('Verified shadow payload and snapshot identity required');
  const allFinished=payload.matches.every(m=>m.completed===true),assessments=payload.assessments||[];
  const verified=assessments.length===payload.matches.length&&assessments.every(a=>a.status==='final-candidate');
  const disputed=assessments.some(a=>a.status==='held'),updates=payload.matches.map(m=>stamp(m.sourceUpdatedAt)).filter(Number.isFinite);
  const scores={};for(const team of payload.teams){if(!team.team||Object.prototype.hasOwnProperty.call(scores,team.team)||!finiteScore(team.total))throw Error('Unique teams and explicit numeric scores required');scores[team.team]=team.total;}
  return {round:payload.round,season:payload.season,scores,preview:true,canPublish:false,scoreSnapshotId:snapshotId,
   scoreState:{schema:1,snapshotId,round:payload.round,phase:allFinished?'finished':'live',verification:disputed?'disputed':verified?'verified':'pending',
    source:payload.source,verifier:payload.verifier,coverageComplete:allFinished,finalised:false,
    correctionPending:payload.corrections?.approvalRequired===true,collectedAt,sourceUpdatedAt:updates.length?new Date(Math.max(...updates)).toISOString():null,
    collectorActive,refreshMinutes}};
 }
 return {describe,render,fromShadow,finiteScore};
});
