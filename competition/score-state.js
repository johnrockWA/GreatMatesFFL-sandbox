'use strict';

const STATES={
 provisional:{label:'Provisional scores',tone:'live',final:false},
 'awaiting-verification':{label:'Finished — awaiting verification',tone:'warning',final:false},
 disputed:{label:'Statistics disputed — result on hold',tone:'danger',final:false},
 'correction-pending':{label:'Correction awaiting approval',tone:'warning',final:false},
 'awaiting-finalisation':{label:'Verified — awaiting approval',tone:'warning',final:false},
 'verified-final':{label:'Verified final result',tone:'final',final:true},
 'collection-paused':{label:'Score collection paused',tone:'warning',final:false},
 recorded:{label:'Recorded score — independent verification not recorded',tone:'neutral',final:false}
};

const fail=message=>{throw Error(message);};
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);

function numberOrNull(value){
 if(value===null||value===undefined||value==='')return null;
 if(!Number.isFinite(value)||value<0)fail('Scores must be non-negative finite numbers or null');
 return value;
}

function describe(state){
 const key=String(state||'').trim();
 const found=STATES[key];
 if(!found)fail('Unsupported score state: '+(key||'(missing)'));
 return {state:key,...found,canDeclareWinner:found.final};
}

function teamScore(scores,team){return own(scores,team)?numberOrNull(scores[team]):null;}

function matchView(match){
 if(!match||typeof match!=='object')fail('Match evidence required');
 const status=describe(match.scoreState);
 const home=String(match.home||'').trim(),away=String(match.away||'').trim();
 if(!home||!away||home===away)fail('Two distinct match teams required');
 const homeScore=teamScore(match.scores,home),awayScore=teamScore(match.scores,away);
 let winner=null;
 if(status.canDeclareWinner){
  if(homeScore===null||awayScore===null)fail('Verified final requires both scores');
  if(homeScore!==awayScore)winner=homeScore>awayScore?home:away;
  else if(typeof match.verifiedWinner==='string'&&[home,away].includes(match.verifiedWinner))winner=match.verifiedWinner;
  else fail('Tied verified final requires an explicit verified winner');
 }
 return {...status,home,away,homeScore,awayScore,winner,snapshotId:match.snapshotId||null};
}

function sameSnapshot(summary,detail){
 if(!summary||!detail||!summary.snapshotId||!detail.snapshotId)return false;
 return summary.snapshotId===detail.snapshotId;
}

function freshnessView(meta,now){
 if(!Number.isFinite(now))fail('Verified clock required');
 const maxAgeMs=Number(meta&&meta.freshnessMaxAgeMs);
 if(!Number.isFinite(maxAgeMs)||maxAgeMs<=0)fail('Positive freshness limit required');
 const lastSuccessAt=meta&&meta.lastSuccessAt;
 const success=Date.parse(lastSuccessAt);
 const base={lastAttemptAt:meta&&meta.lastAttemptAt||null,lastSuccessAt:lastSuccessAt||null,
  publishedAt:meta&&meta.publishedAt||null,freshnessMaxAgeMs:maxAgeMs};
 if(!Number.isFinite(success))return {...base,status:'missing',stale:true};
 if(now<success)return {...base,status:'error',stale:true,reason:'Future success timestamp'};
 const ageMs=now-success;
 return {...base,status:ageMs>maxAgeMs?'stale':'fresh',stale:ageMs>maxAgeMs,ageMs};
}

module.exports={STATES,describe,teamScore,matchView,sameSnapshot,freshnessView};
