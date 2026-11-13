/* Isolated integration state. No official-sheet adapter, network or mail transport. */
var FFLDevelopment=(function(){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const E=typeof FFLDraft!=='undefined'?FFLDraft:require('./draft-engine');
const S=typeof FFLScoring!=='undefined'?FFLScoring:require('../competition/scoring');
function create(draft,lockoutAt){
 if(!Number.isFinite(Date.parse(lockoutAt)))throw Error('Round lockout required.');
 return {scope:'FFL_SYNTHETIC_INTEGRATION_V1',revision:0,draft:copy(draft),squads:null,squadVersion:0,proposal:null,round:{id:'synthetic-round-1',lockoutAt,nominations:{},published:null},audit:[]};
}
function assert(s){if(s?.scope!=='FFL_SYNTHETIC_INTEGRATION_V1')throw Error('Synthetic integration state required.');}
function apply(input,c,actor,now,hash){
 assert(input);if(c.revision!==input.revision)throw Error('The workspace changed. Refresh and review.');
 if(!Number.isFinite(now)||!actor?.id||!input.draft.teams.some(t=>t.id===actor.team))throw Error('Verified actor and server clock required.');
 const s=copy(input),committee=actor.role==='commissioner'||actor.role==='president';
 if(['stageSquads','publishSquads','stageScores','publishScores','restore'].includes(c.type)&&!committee)throw Error('Committee approval required.');
 if(c.type==='draft'){
  if(s.squads)throw Error('Draft is closed after squad publication.');
  const command={...c.command,revision:s.draft.revision};
  if(command.type==='finalize')throw Error('Use the reviewed squad publication step.');
  s.draft=E.apply(s.draft,command,actor,now);s.proposal=null;
 }else if(c.type==='stageSquads'){
  if(s.squads)throw Error('Squads already published in this rehearsal.');
  if(E.phase(s.draft,now)!=='validation'||s.draft.paused)throw Error('Complete and resume the draft before review.');
  const squads=E.finalSquads(s.draft);s.proposal={kind:'squads',draftRevision:s.draft.revision,squads,hash:hash(JSON.stringify(squads))};
 }else if(c.type==='publishSquads'){
  const p=s.proposal;if(!p||p.kind!=='squads'||p.hash!==c.approvedHash||p.draftRevision!==s.draft.revision)throw Error('Review the current squad proposal.');
  if(s.squads)throw Error('Squads already published.');
  s.squads=copy(p.squads);s.squadVersion++;s.proposal=null;
 }else if(c.type==='nominate'){
  if(!s.squads)throw Error('Approved squads required.');
  if(now>=Date.parse(s.round.lockoutAt))throw Error('Weekly selections are locked.');
  if(c.squadVersion!==s.squadVersion)throw Error('Squads changed. Review selections.');
  const n=c.nomination,ids=[...(n?.starters||[]),...(n?.reserves||[])];
  if(n?.starters?.length!==7||n?.reserves?.length!==7||new Set(ids).size!==14||ids.some(id=>!s.squads[actor.team].includes(id)))throw Error('Select fourteen distinct players from your approved squad.');
  s.round.nominations[actor.team]={starters:[...n.starters],reserves:[...n.reserves],squadVersion:s.squadVersion,at:new Date(now).toISOString()};
 }else if(c.type==='stageScores'){
  if(now<Date.parse(s.round.lockoutAt))throw Error('Round must be locked.');
  // Trusted collector evidence is injected by the server adapter, never a coach payload.
  const e=c.evidence;if(!e||e.complete!==true||e.verified!==true||typeof e.sourceVersion!=='string'||!e.sourceVersion)throw Error('Complete verified score evidence required.');
  const players=new Map(s.draft.players.map(p=>[p.id,p])),stats=new Map();
  for(const [id,v] of Object.entries(e.stats||{})){const p=players.get(id);if(!p)throw Error('Unknown score identity.');S.score('All Rounder',v);stats.set(S.identity(p.name,p.club),v);}
  const scores={},positions={};
  for(const t of s.draft.teams){
   const n=s.round.nominations[t.id];if(!n||n.squadVersion!==s.squadVersion)throw Error('Current weekly submissions required for every team.');
   const row=id=>{const p=players.get(id);return {name:p.name,club:p.club};};
   const result=S.resolve({starters:n.starters.map(row),reserves:n.reserves.map(row)},stats,new Map(e.clubOrder||[]),{complete:true});scores[t.id]=result.total;positions[t.id]=result.positions;
  }
  const fixtures=s.draft.teams.reduce((out,t,i,a)=>{if(i%2===0){if(!a[i+1])throw Error('Even number of teams required.');out.push({round:s.round.id,home:t.id,away:a[i+1].id});}return out;},[]);
  const ladder=S.ladder(fixtures,new Map(Object.entries(scores).map(([id,n])=>[s.round.id+'|'+id,n])));
  const proposal={kind:'scores',sourceVersion:e.sourceVersion,scores,positions,ladder,prior:s.round.published?.hash||null};proposal.hash=hash(JSON.stringify(proposal));s.proposal=proposal;
 }else if(c.type==='publishScores'){
  const p=s.proposal;if(!p||p.kind!=='scores'||p.hash!==c.approvedHash)throw Error('Review the current score proposal.');
  if(p.prior&&(!c.reason||!c.reason.trim()))throw Error('Correction reason required.');
  s.round.published=copy(p);s.round.published.publishedAt=new Date(now).toISOString();s.proposal=null;
 }else if(c.type==='restore'){
  // Host obtains a checksum-verified backup; no public route accepts this command.
  assert(c.backup);if(c.backupHash!==hash(JSON.stringify(c.backup))||!c.reason?.trim())throw Error('Verified backup and restore reason required.');
  if(c.backup.draft.config.season!==s.draft.config.season)throw Error('Wrong backup season.');
  for(const key of ['draft','squads','squadVersion','proposal','round'])s[key]=copy(c.backup[key]);
 }else throw Error('Unknown integration command.');
 s.revision++;s.audit.push({revision:s.revision,type:c.type,actor:actor.id,at:new Date(now).toISOString(),reason:c.reason||null,approvedHash:c.approvedHash||null});return s;
}
function view(s,actor){assert(s);return {scope:s.scope,revision:s.revision,squadVersion:s.squadVersion,squad:copy(s.squads?.[actor.team]||[]),nomination:copy(s.round.nominations[actor.team]||null),round:s.round.id,lockoutAt:s.round.lockoutAt,published:copy(s.round.published),proposal:actor.role==='coach'?null:copy(s.proposal)};}
return {create,apply,view};
})();
if(typeof module!=='undefined')module.exports=FFLDevelopment;
