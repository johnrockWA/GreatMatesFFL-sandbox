/* Public snapshot -> existing frontend response shapes. Pure preparation only;
   authenticated routing and server-supplied finals descriptors are host concerns. */
'use strict';
const number=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
function metadata(read){
 if(!read?.snapshotId||!Array.isArray(read.matches))throw Error('Paired public score snapshot required');
 return {snapshotId:read.snapshotId,scoreSnapshotId:read.snapshotId,lastAttemptAt:read.lastAttemptAt,
  lastSuccessAt:read.lastSuccessAt,publishedAt:read.publishedAt,freshnessMaxAgeMs:read.freshnessMaxAgeMs,
  correctionPending:read.correctionPending===true,collectionPaused:read.collectionPaused===true,updatedAt:read.updatedAt};
}
function roundScores(read,round){
 const scores={},meta=metadata(read),matches=read.matches.filter(m=>m.round===round);
 if(!matches.length)throw Error('Requested round is not in this snapshot');
 for(const match of matches)for(const team of [match.home,match.away]){
  if(Object.prototype.hasOwnProperty.call(scores,team))throw Error('Duplicate team in round snapshot');
  const value=match.scores?.[team];if(value!=null&&!number(value))throw Error('Malformed score');scores[team]=value??null;
 }
 const states=new Set(matches.map(m=>m.scoreState));
 // Mixed states cannot inherit a top-level final label.
 const scoreState=states.size===1?[...states][0]:'provisional';
 return {...meta,round,scores,scoreState};
}
function finalsResponse(read,{seeds,roundMap,descriptors}){
 const meta=metadata(read);
 if(!Array.isArray(seeds)||!Array.isArray(roundMap)||!Array.isArray(descriptors))throw Error('Verified finals descriptors required');
 const used=new Set();
 const bracket=descriptors.map(d=>{
  if(!d?.finalName||!d.matchId||used.has(d.matchId))throw Error('Unique named finals descriptors required');used.add(d.matchId);
  const m=read.matches.find(m=>m.id===d.matchId);if(!m)throw Error('Final missing from score snapshot');
  return {finalName:d.finalName,team1:m.home,team2:m.away,team1Score:m.scores?.[m.home]??null,team2Score:m.scores?.[m.away]??null,
   scoreState:m.scoreState,complete:m.scoreState==='verified-final'&&number(m.scores?.[m.home])&&number(m.scores?.[m.away]),
   verifiedWinner:m.verifiedWinner,...meta};
 });
 return {...meta,seeds,roundMap,bracket};
}
module.exports={roundScores,finalsResponse};
