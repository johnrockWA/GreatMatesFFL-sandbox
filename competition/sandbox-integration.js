/* Explicitly invoked sandbox integration. Injected storage only; no routes,
   network, schedules, mail or competition writer. Shadow data cannot be final. */
'use strict';
const {buildPreview}=require('./official-round-preview');
const {correctionPreview}=require('./correction-preview');
const status=require('./score-status'),states=require('./score-state'),finals=require('./finals');
function prepareRound({manifest,projected,registry,nominations,verifierMatches,baseline,store,expectedRevision,collectedAt,fixtures=[]}){
 if(!Number.isFinite(Date.parse(collectedAt)))throw Error('Successful collection time required');
 const payload=buildPreview(manifest,projected,registry,nominations,{verifierMatches});
 if(payload.status==='held')return {status:'held',canPublish:false,assessments:payload.assessments,committed:false};
 if(baseline)payload.corrections=correctionPreview(manifest,baseline,payload,registry,nominations);
 const staged=store.stage(payload),commit=store.commit(staged,expectedRevision),saved=store.read();
 if(saved.hash!==staged.hash)throw Error('Committed round changed during read');
 const response=status.fromShadow(saved.payload,{snapshotId:saved.hash,collectedAt,collectorActive:false});
 const view=status.describe(response,{now:Date.parse(collectedAt),hasScores:true,scoresComplete:true});
 const state=view.code==='correction'?'correction-pending':view.code==='awaiting-finalisation'?'awaiting-finalisation':'awaiting-verification';
 const publicSnapshot={snapshotId:saved.hash,status:state,updatedAt:collectedAt,lastAttemptAt:collectedAt,
  lastSuccessAt:collectedAt,publishedAt:null,freshnessMaxAgeMs:600000,correctionPending:response.scoreState.correctionPending,
  collectionPaused:true,matches:fixtures.map(f=>({id:f.id,round:manifest.id,home:f.home,away:f.away,
   scores:{[f.home]:response.scores[f.home]??null,[f.away]:response.scores[f.away]??null},scoreState:state,updatedAt:collectedAt}))};
 return {status:payload.status,canPublish:false,committed:true,commit,response,publicSnapshot,assessments:payload.assessments};
}
function evaluateVerifiedFinals({seeds,matches,snapshots,tiePolicy,now}){
 const scores={};let snapshotId=null;
 for(const m of matches){
  if(m.a.bye||m.b.bye)continue;
  const evidence=snapshots[m.id];
  if(!evidence?.snapshotId||!evidence.match||evidence.match.snapshotId!==evidence.snapshotId)throw Error('Paired finals snapshot required: '+m.id);
  if(snapshotId&&snapshotId!==evidence.snapshotId)throw Error('Finals snapshots disagree');snapshotId=evidence.snapshotId;
  if(evidence.correctionPending||evidence.collectionPaused||states.freshnessView(evidence,now).stale)throw Error('Finals evidence needs verification: '+m.id);
  const view=states.matchView(evidence.match);if(!view.canDeclareWinner||!view.winner)throw Error('Verified final required: '+m.id);
  scores[m.id]={[view.home]:view.homeScore,[view.away]:view.awayScore};
 }
 const result=finals.evaluate({seeds,matches,scores,tiePolicy});
 for(const m of result.matches)if(!m.bye&&states.matchView(snapshots[m.id].match).winner!==m.winner.team)throw Error('Verified winner disagrees with finals progression: '+m.id);
 return {...result,snapshotId,canPublish:false};
}
module.exports={prepareRound,evaluateVerifiedFinals};
