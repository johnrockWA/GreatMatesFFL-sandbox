/* Prepared read-only score adapter for the 2027 successor.
   It is not exposed as a route and contains no write, trigger or mail operation. */
var FFLScoreRead=(function(){
 'use strict';
 function fail(message){throw new Error(message);}
 function copy(value){return JSON.parse(JSON.stringify(value));}
 function actorOk(actor){
  if(!actor||typeof actor.email!=='string'||!actor.email.trim())return false;
  if(!['coach','committee','commissioner'].includes(actor.role))return false;
  return actor.role!=='coach'||(typeof actor.team==='string'&&!!actor.team.trim());
 }
 function headKey(head){return head&&[head.version,head.snapshotId,head.hash].join('|');}
 function publicMatch(match){
  return {id:match.id,round:match.round,home:match.home,away:match.away,
   scores:copy(match.scores||{}),scoreState:match.scoreState,updatedAt:match.updatedAt||null,
   verifiedWinner:[match.home,match.away].includes(match.verifiedWinner)?match.verifiedWinner:null};
 }
 function read(actor,services){
  if(!actorOk(actor))fail('Authenticated competition identity required');
  if(!services||!['loadHead','loadSnapshot','hash'].every(k=>typeof services[k]==='function'))fail('Score read services required');
  const before=services.loadHead();if(!headKey(before))fail('Published score head unavailable');
  const snapshot=services.loadSnapshot(before.version);
  const after=services.loadHead();if(headKey(before)!==headKey(after))fail('Score head changed during read');
  if(!snapshot||snapshot.snapshotId!==before.snapshotId)fail('Score snapshot does not match published head');
  if(services.hash(snapshot)!==before.hash)fail('Score snapshot checksum failed');
  if(!Array.isArray(snapshot.matches))fail('Score matches missing');
  return {schema:1,snapshotId:snapshot.snapshotId,status:snapshot.status,
   updatedAt:snapshot.updatedAt||null,lastAttemptAt:snapshot.lastAttemptAt||null,
   lastSuccessAt:snapshot.lastSuccessAt||null,publishedAt:snapshot.publishedAt||null,
   freshnessMaxAgeMs:Number.isFinite(snapshot.freshnessMaxAgeMs)&&snapshot.freshnessMaxAgeMs>0?snapshot.freshnessMaxAgeMs:null,
   correctionPending:snapshot.correctionPending===true,
   collectionPaused:snapshot.collectionPaused===true,warnings:copy(snapshot.warnings||[]),
   matches:snapshot.matches.map(publicMatch)};
 }
 return {read:read};
})();
if(typeof module!=='undefined')module.exports=FFLScoreRead;
