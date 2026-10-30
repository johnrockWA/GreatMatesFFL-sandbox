/* Shared pure draft rules. Clock and authenticated actor must be supplied by the server. */
var FFLDraft = (function () {
'use strict';
const RULE_VERSION='provisional-build03', SOFTWARE_VERSION='katy-foundation-c1.1';
const copy=x=>JSON.parse(JSON.stringify(x));
const fail=m=>{throw new Error(m);};
const unique=a=>new Set(a).size===a.length;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const committee=a=>a && ['commissioner','president'].includes(a.role);
function date(x){if(typeof x!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(x)||!Number.isFinite(Date.parse(x)))fail('Use a complete date/time with timezone.');return Date.parse(x);}
function schedule(c){if(!['preseason','midseason'].includes(c.kind)||!Number.isInteger(c.season))fail('Invalid season or draft type.');if(!(date(c.opensAt)<date(c.locksAt)&&date(c.locksAt)<=date(c.draftAt)))fail('Opening must precede locking; drafting cannot precede locking.');}
function create(c,teams,players,squads){schedule(c);if(!teams.length||!unique(teams.map(t=>t.id)))fail('Invalid teams.');if(!players.length||!unique(players.map(p=>p.id)))fail('Invalid player pool.');const ids=new Set(players.map(p=>p.id)),owned=[];for(const t of teams){const list=squads[t.id];if(!Array.isArray(list)||list.length!==20||!unique(list)||list.some(id=>!ids.has(id)))fail('Each starting squad must contain 20 distinct known players.');owned.push(...list);}if(!unique(owned))fail('A player belongs to multiple teams.');return {schema:1,revision:0,config:copy(c),teams:copy(teams),players:copy(players),officialSquads:copy(squads),baselineSquads:copy(squads),choices:Object.fromEntries(teams.map(t=>[t.id,{working:{normal:[],fookies:[],delists:[]},submitted:null,version:0,submittedVersion:null}])),queues:Object.fromEntries(teams.map(t=>[t.id,[]])),locked:null,prepared:false,armed:false,plan:[],picks:[],paused:false,finalizedAt:null,audit:[],notices:[],reminderKeys:[]};}
function phase(s,now){if(s.finalizedAt)return now>=date(s.finalizedAt)+(s.config.kind==='preseason'?7:3)*86400000?'hidden':'closed';if(now<date(s.config.opensAt))return 'scheduled';if(now<date(s.config.locksAt))return 'selection';if(!s.prepared)return 'review';if(s.paused)return 'paused';if(s.picks.length===s.plan.length)return 'validation';return !s.armed||now<date(s.config.draftAt)?'ready':'drafting';}
function player(s,id){return s.players.find(p=>p.id===id)||fail('Unknown player.');}
function team(s,id){return s.teams.find(t=>t.id===id)||fail('Unknown team.');}
function selection(s,id,v,incomplete=false){team(s,id);if(!v||!['normal','fookies','delists'].every(k=>Array.isArray(v[k])))fail('Invalid selections.');const all=[...v.normal,...v.fookies,...v.delists];if(!unique(all)||all.some(p=>!s.baselineSquads[id].includes(p)))fail('Select distinct players from this team’s starting squad.');if(s.config.kind==='preseason'){if(v.normal.length>2)fail('Choose up to two normal retains. You also have two separate fookie slots.');if(v.fookies.length>2)fail('Choose up to two fookie-slot retains. Additional eligible fookies can use any free normal slots.');if(v.delists.length)fail('Delists are only used in the midseason draft.');for(const pid of all){const p=player(s,pid);if(!Number.isInteger(p.careerGames)||p.careerGames<0)fail(p.name+': career games require verification.');if(v.fookies.includes(pid)&&p.careerGames>50)fail(p.name+' is not fookie eligible.');if(p.careerGames>50){const h=p.history?.[id];if(!h||h.verified!==true||!Number.isInteger(h.retains)||h.retains<0)fail(p.name+': retention history requires verification.');if(h.retains>=3)fail(p.name+' has reached three consecutive dynasty retentions.');}}}else if(v.normal.length||v.fookies.length||(!incomplete&&v.delists.length<2)||v.delists.length>4)fail('Choose two to four delists.');return copy(v);}
function status(s,id){const c=s.choices[id];return c.submitted!==null&&c.version===c.submittedVersion?'Submitted':'Not Submitted';}
function allocation(s,locked){const counts={};for(const t of s.teams){const v=selection(s,t.id,locked[t.id]);counts[t.id]=s.config.kind==='preseason'?20-v.normal.length-v.fookies.length:v.delists.length;}const plan=[];for(let r=1;r<=Math.max(...Object.values(counts));r++)for(const [i,t] of s.teams.entries())if(counts[t.id]>=r)plan.push({team:t.id,round:r,slot:i+1,label:r+'.'+String(i+1).padStart(2,'0')});return plan;}
function available(s,pid,pickIndex=s.picks.length){const p=player(s,pid);if(s.picks.some(x=>x.player===pid))return {ok:false,reason:'Drafted',pick:s.picks.find(x=>x.player===pid)};if(!s.prepared)return {ok:false,reason:'Draft has not opened'};for(const t of s.teams){const c=s.locked[t.id];const kept=s.config.kind==='preseason'?[...c.normal,...c.fookies]:s.baselineSquads[t.id].filter(id=>!c.delists.includes(id));if(kept.includes(pid))return {ok:false,reason:'Retained',team:t.id};}const turn=s.plan[pickIndex];if(!turn)return {ok:false,reason:'Draft complete'};if(s.config.kind==='preseason'&&turn.round===1&&s.baselineSquads[turn.team].includes(p.id))return {ok:false,reason:'Your discarded player: available after round one'};return {ok:true};}
function finalSquads(s){const out={};for(const t of s.teams){const c=s.locked[t.id];const base=s.config.kind==='preseason'?[...c.normal,...c.fookies]:s.baselineSquads[t.id].filter(id=>!c.delists.includes(id));out[t.id]=[...base,...s.picks.filter(p=>p.team===t.id).map(p=>p.player)];if(out[t.id].length!==20||!unique(out[t.id]))fail('Final squad invalid for '+t.name);}if(!unique(Object.values(out).flat()))fail('Player appears in multiple final squads.');return out;}
// Record only the fields an accepted action can change, rather than copying private state.
function evidence(s,a,target){
 if(['save','submit','override'].includes(a.type))return copy(s.choices[target]);
 if(a.type==='queue')return {players:copy(s.queues[target])};
 if(a.type==='schedule')return {config:copy(s.config)};
 if(a.type==='trade')return {squads:copy({[a.from]:s.baselineSquads[a.from],[a.to]:s.baselineSquads[a.to]})};
 if(a.type==='prepare')return {prepared:s.prepared,armed:s.armed,locked:copy(s.locked),plan:copy(s.plan)};
 if(a.type==='pick')return {pickIndex:a.expectedPick,pick:copy(s.picks[a.expectedPick]||null)};
 if(a.type==='finalize')return {officialSquads:copy(s.officialSquads),retentionResults:copy(s.retentionResults||[]),finalizedAt:s.finalizedAt};
 return {prepared:s.prepared,armed:s.armed,paused:s.paused};
}
function apply(input,a,actor,now){
 if(!actor||!actor.id)fail('Authentication required.');if(!Number.isFinite(now))fail('Server time required.');
 if(!['coach','commissioner','president'].includes(actor.role))fail('Verified draft role required.');
 if(!a||typeof a!=='object'||Array.isArray(a))fail('Invalid action.');
 if(a.reason!==undefined&&(typeof a.reason!=='string'||a.reason.length>1000))fail('Use a reason of at most 1000 characters.');
 if(a.requestId!==undefined&&(typeof a.requestId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(a.requestId)))fail('Invalid request identifier.');
 if(a.revision!==input.revision)fail('The draft changed. Refresh and try again.');
 const s=copy(input),ph=phase(s,now);let target=a.team||actor.team;
 const admin=['schedule','override','prepare','arm','pause','resume','finalize','trade'];
 if(admin.includes(a.type)&&!committee(actor))fail('Commissioner or president access required.');
 if(['save','submit','queue'].includes(a.type)&&target!==actor.team)fail('You can only edit your own team.');
 if(['save','submit','queue'].includes(a.type))team(s,target);
 const reason=()=>{if(typeof a.reason!=='string'||!a.reason.trim())fail('A reason is required.');};
 if(a.type==='schedule'){if(s.prepared||s.picks.length||s.finalizedAt)fail('Schedule is locked after preparation.');reason();if(!a.dates||Object.keys(a.dates).some(k=>!['opensAt','locksAt','draftAt'].includes(k)))fail('Only schedule dates may change.');const c={...s.config,...a.dates};schedule(c);s.config=c;}
 else if(a.type==='save'){if(ph!=='selection')fail('The selection window is closed.');s.choices[target].working=selection(s,target,a.value,true);s.choices[target].version++;}
 else if(a.type==='submit'){if(ph!=='selection')fail('The selection window is closed.');const c=s.choices[target];c.submitted=selection(s,target,c.working);c.submittedVersion=c.version;s.notices.push({id:'receipt-'+(s.revision+1),team:target,text:'Selections submitted',at:new Date(now).toISOString(),emailStatus:'suppressed'});}
 else if(a.type==='queue'){if(['scheduled','hidden','closed','validation'].includes(ph))fail('Queue editing is closed.');if(!Array.isArray(a.players)||!unique(a.players)||a.players.length>s.players.length)fail('Invalid queue.');a.players.forEach(id=>player(s,id));s.queues[target]=copy(a.players);}
 else if(a.type==='override'){if(!['review','ready','paused','validation'].includes(ph))fail('Close selections or pause the draft before adjusting them.');if(s.picks.length&&ph!=='paused')fail('Pause the draft before correcting selections.');reason();team(s,target);const v=selection(s,target,a.value);s.choices[target]={working:v,submitted:copy(v),version:s.choices[target].version+1,submittedVersion:s.choices[target].version+1};if(s.prepared){s.armed=false;const locked=copy(s.locked);locked[target]=v;const plan=allocation(s,locked);if(s.picks.some((p,i)=>!plan[i]||p.team!==plan[i].team||p.round!==plan[i].round))fail('This correction changes completed pick order. Resolve completed picks before applying it.');s.locked=locked;s.plan=plan;const past=s.picks;s.picks=[];for(const p of past){if(!available(s,p.player,s.picks.length).ok)fail('Correction conflicts with a completed pick.');s.picks.push(p);}}}
 else if(a.type==='trade'){if(ph!=='review'||s.prepared)fail('Trades are reviewed after the deadline and before draft preparation.');reason();team(s,a.from);team(s,a.to);if(a.from===a.to||!s.baselineSquads[a.from].includes(a.player)||!s.baselineSquads[a.to].includes(a.exchange))fail('Choose one owned player from each trading team.');s.baselineSquads[a.from]=s.baselineSquads[a.from].map(x=>x===a.player?a.exchange:x);s.baselineSquads[a.to]=s.baselineSquads[a.to].map(x=>x===a.exchange?a.player:x);}
 else if(a.type==='prepare'){if(ph!=='review')fail('Wait for the selection deadline.');const locked={};for(const t of s.teams){if(s.choices[t.id].submitted===null)fail(t.name+' has no submitted selections. Committee resolution is required.');locked[t.id]=selection(s,t.id,s.choices[t.id].submitted);}s.locked=locked;s.plan=allocation(s,locked);s.prepared=true;s.armed=false;}
 else if(a.type==='arm'){if(!s.prepared||!['ready','paused'].includes(ph))fail('Approve selections before arming the draft.');s.armed=true;}
 else if(a.type==='pick'){if(ph!=='drafting')fail('Drafting is not open.');const turn=s.plan[s.picks.length];if(a.expectedPick!==s.picks.length)fail('The current pick has changed.');if(actor.team!==turn.team&&!committee(actor))fail('It is not your team’s turn.');if(actor.team!==turn.team)reason();const ok=available(s,a.player);if(!ok.ok)fail(ok.reason);s.picks.push({...turn,player:a.player,at:new Date(now).toISOString()});}
 else if(a.type==='pause'){if(!['drafting','validation','ready'].includes(ph))fail('There is no active draft to pause.');reason();s.paused=true;}
 else if(a.type==='resume'){if(!s.paused)fail('Draft is not paused.');if(!s.armed)fail('Selections changed. Arm the corrected draft before resuming.');s.paused=false;}
 else if(a.type==='finalize'){if(ph!=='validation'||s.paused)fail('Complete all picks and resume before validation.');s.officialSquads=finalSquads(s);s.finalizedAt=new Date(now).toISOString();s.retentionResults=s.config.kind==='preseason'?s.teams.flatMap(t=>[...s.locked[t.id].normal,...s.locked[t.id].fookies].map(id=>{const p=player(s,id),h=p.history?.[t.id];return {season:s.config.season,team:t.id,player:id,slot:s.locked[t.id].fookies.includes(id)?'fookie':'normal',fookieEligible:p.careerGames<=50,dynastyYears:p.careerGames<=50?(h?.retains||0):(h?.retains||0)+1};})):[];}
 else fail('Unknown action.');
 // A pick's team is derived from the validated turn, not from the request's team label.
 const eventTeam=a.type==='pick'?s.picks[s.picks.length-1].team:
   ['save','submit','queue','override'].includes(a.type)?target:null;
 s.revision++;
 s.audit.push({schema:1,eventId:'draft-event-'+s.revision,revision:s.revision,
   type:a.type,actor:actor.id,role:actor.role,team:eventTeam,
   reason:a.reason||'',requestId:a.requestId||null,at:new Date(now).toISOString(),
   ruleVersion:RULE_VERSION,softwareVersion:SOFTWARE_VERSION,
   before:evidence(input,a,target),after:evidence(s,a,target)});
 return s;
}
function reminders(input,now){const s=copy(input);if(phase(s,now)!=='selection')return s;for(const t of s.teams){const events=[['open',date(s.config.opensAt)],['48h',Math.max(date(s.config.opensAt),date(s.config.locksAt)-48*3600000)],['6h',Math.max(date(s.config.opensAt),date(s.config.locksAt)-6*3600000)]];const due=events.filter(e=>now>=e[1]&&!s.reminderKeys.includes(t.id+':'+e[0]));if(!due.length)continue;due.forEach(e=>s.reminderKeys.push(t.id+':'+e[0]));const event=due[due.length-1];if(event[0]!=='open'&&status(s,t.id)==='Submitted')continue;s.notices.push({id:t.id+':'+event[0],team:t.id,text:event[0]==='open'?'Selection window is open':'Selections need submission before the deadline',at:new Date(now).toISOString(),emailStatus:'suppressed'});}if(!same(s.notices,input.notices)||!same(s.reminderKeys,input.reminderKeys))s.revision++;return s;}
function view(s,actor,now){
 if(!actor||!actor.id)fail('Authentication required.');
 if(!['coach','commissioner','president'].includes(actor.role))fail('Verified draft role required.');
 if(!Number.isFinite(now))fail('Server time required.');
 if(!committee(actor))team(s,actor.team);
 const ph=phase(s,now),own=Object.prototype.hasOwnProperty.call(s.choices,actor.team);
 const selected=v=>v===null?null:{normal:copy(v.normal),fookies:copy(v.fookies),delists:copy(v.delists)};
 const choices=Object.fromEntries(s.teams.filter(t=>committee(actor)||t.id===actor.team).map(t=>{
   const c=s.choices[t.id];return [t.id,{working:selected(c.working),submitted:selected(c.submitted),version:c.version,submittedVersion:c.submittedVersion}];
 }));
 const turn=p=>({team:p.team,round:p.round,slot:p.slot,label:p.label});
 // Explicit public/role projections. Future state fields are private by default.
 const v={viewSchema:1,schema:s.schema,revision:s.revision,
   ruleVersion:RULE_VERSION,softwareVersion:SOFTWARE_VERSION,
   config:{kind:s.config.kind,season:s.config.season,opensAt:s.config.opensAt,locksAt:s.config.locksAt,draftAt:s.config.draftAt},
   teams:s.teams.map(t=>({id:t.id,name:t.name,short:t.short||t.name})),
   players:s.players.map(p=>({id:p.id,name:p.name,club:p.club||'',careerGames:p.careerGames,
     historyReview:!!p.historyReview,history:Object.fromEntries(Object.entries(p.history||{}).map(([id,h])=>[id,{verified:h.verified===true,retains:h.retains,recordedNormalYears:h.recordedNormalYears||[]}]))})),
   officialSquads:s.officialSquads,baselineSquads:s.baselineSquads,
   prepared:s.prepared,armed:s.armed,paused:s.paused,finalizedAt:s.finalizedAt,
   phase:ph,visible:!['scheduled','hidden'].includes(ph),
   submissionProgress:s.teams.map(t=>({team:t.id,submitted:s.choices[t.id].submitted!==null})),
   // Committee approval is the only point at which locked choices become public.
   locked:s.prepared?Object.fromEntries(s.teams.map(t=>[t.id,selected(s.locked[t.id])])):null,
   plan:s.prepared?s.plan.map(turn):[],picks:s.prepared?s.picks.map(p=>({...turn(p),player:p.player,at:p.at})):[],
   choices,
   queues:own?{[actor.team]:s.queues[actor.team]||[]}:{},
   notices:own?s.notices.filter(n=>n.team===actor.team).map(n=>({id:n.id,team:n.team,text:n.text,at:n.at,emailStatus:n.emailStatus})):[],
   retentionResults:s.finalizedAt?s.retentionResults||[]:[]};
 if(committee(actor))v.audit=s.audit.filter(e=>e.type!=='queue'||e.actor===actor.id);
 return copy(v);
}
return {create,apply,phase,status,selection,available,finalSquads,reminders,view,date,
 ruleVersion:RULE_VERSION,softwareVersion:SOFTWARE_VERSION};
})();
if(typeof module!=='undefined')module.exports=FFLDraft;
