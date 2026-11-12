/* The shared screen renders only server projections. Demo state is never loaded. */
'use strict';
const el=id=>document.getElementById(id),escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let client=null,ui=null,edits=null,editVersion=null,confirmJob=null,teamTarget=null,sharedEndpoint=null,renderedContentKey=null;
const DRAFT_SESSION_KEY='ffl_shared_draft_session_v1';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const format=x=>new Date(x).toLocaleString('en-AU',{timeZone:'Australia/Perth',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
function playerName(v,id){return v.players.find(p=>p.id===id)?.name||id;}
function teamName(v,id){return v.teams.find(t=>t.id===id)?.name||id;}
function selectionText(v,choice){return choice?[...choice.normal,...choice.fookies,...choice.delists].map(id=>playerName(v,id)).join(', ')||'No retains selected':'No submission yet';}
function ownDiscardWarning(v,id){const turn=v.plan[v.picks.length];return v.config.kind==='preseason'&&v.prepared&&['drafting','ready','paused'].includes(v.phase)&&turn?.round===1&&v.baselineSquads[v.managingTeam].includes(id)&&!v.picks.some(p=>p.player===id)&&FFLDraft.available(v,id).reason!=='Retained'?'You delisted this player — available Round 2.':'';}
function controlsDisabled(){return !ui||ui.busy||ui.stale||!!ui.pending;}
function promptConfirmation(title,text,job){el('confirmtitle').textContent=title;el('confirmtext').textContent=text;confirmJob=job;el('confirm').showModal();}
function renderShared(snapshot){
 ui=snapshot;const v=ui.view,blocked=controlsDisabled();
 el('connection').textContent=ui.message;el('refresh').disabled=ui.busy||!!ui.refreshing;el('retry').hidden=!ui.pending;el('retry').disabled=ui.busy;
 el('login').hidden=!ui.authRequired;el('signout').hidden=ui.authRequired||!v;
 el('content').hidden=!v||ui.authRequired;if(!v||ui.authRequired){renderedContentKey=null;return;}
 el('checked').textContent='Checked '+format(v.serverNow)+' AWST · shared revision '+v.revision+(ui.stale?' · Refresh required':'');
 // A clock-only poll must not replace focused selects or buttons under a click.
 // Phase, permissions, choices and revisions remain part of the render key.
 const {serverNow,...contentView}=v;
 const contentKey=JSON.stringify({view:contentView,blocked,busy:ui.busy,pending:ui.pending,receipt:ui.receipt,edits,editVersion,search:el('search').value});
 if(contentKey===renderedContentKey)return;
 renderedContentKey=contentKey;
 const tid=v.managingTeam,c=v.choices[tid],working=edits||c.working,dirty=!!edits&&!same(edits,c.working),conflict=edits&&editVersion!==c.version;
 el('discard').hidden=!edits;el('discard').disabled=ui.busy||!!ui.pending;
 const phase=v.phase,submitted=c.submitted!==null&&c.version===c.submittedVersion;
 el('team').innerHTML=v.managedTeams.map(id=>'<option value="'+escapeHtml(id)+'"'+(id===tid?' selected':'')+'>'+escapeHtml(teamName(v,id))+'</option>').join('');
 el('team').disabled=ui.busy||!!ui.pending||dirty||!!conflict;
 el('phase').textContent=phase==='selection'?'Selections open':phase==='drafting'?'Draft is live':phase==='review'?'Committee review':phase==='paused'?'Draft paused':phase==='ready'?'Waiting for draft opening':phase==='validation'?'Picks complete · awaiting review':phase==='scheduled'?'Before the selection window':phase;
 el('next').textContent=phase==='selection'?(dirty?'You have unsaved changes. Save them, then submit your selections.':submitted?'Submitted. You can revise and resubmit until '+format(v.config.locksAt)+' AWST.':'Save your choices, then submit by '+format(v.config.locksAt)+' AWST.'):'Selection changes are closed. '+(phase==='drafting'?'Confirm your pick when your team is on the clock.':'Check the shared draft status before continuing.');
 el('squadtitle').textContent=teamName(v,tid)+' · '+(v.config.kind==='preseason'?'Retains':'Delists');
 el('selectionstatus').textContent=conflict?'Your saved choices changed in another session. Refresh has kept your unsaved edits; review them against the saved choices before continuing.':dirty?'Unsaved changes on this screen':submitted?'Submitted':c.submitted?'Saved changes not submitted':'Not submitted';
 el('squad').innerHTML=v.baselineSquads[tid].map(id=>{
  const p=v.players.find(p=>p.id===id),status=FFLDraft.retentionStatus(v,tid,id),choice=working.normal.includes(id)?'normal':working.fookies.includes(id)?'fookies':working.delists.includes(id)?'delists':'release';
  const choices=v.config.kind==='preseason'?[['release','Release'],['normal','Normal retain'],['fookies','Fookie slot']]:[['release','Keep'],['delists','Delist']];
  return '<tr><td><strong>'+escapeHtml(p.name)+'</strong><small>'+escapeHtml(p.club)+' · '+escapeHtml(status.label)+'</small></td><td>'+escapeHtml(p.careerGames??'Unverified')+'</td><td><select aria-label="Choice for '+escapeHtml(p.name)+'" data-choice="'+escapeHtml(id)+'" '+(blocked||phase!=='selection'?'disabled':'')+'>'+choices.map(([key,label])=>'<option value="'+key+'"'+(choice===key?' selected':'')+(key==='normal'&&!status.allowed||key==='fookies'&&(!status.allowed||p.careerGames>50)?' disabled':'')+'>'+label+'</option>').join('')+'</select></td></tr>';
 }).join('');
 el('save').disabled=blocked||!dirty||!!conflict||phase!=='selection';el('save').textContent=ui.pending?.command.type==='save'?'Awaiting save confirmation':'Save choices';
 el('submit').disabled=blocked||dirty||!!conflict||submitted||phase!=='selection';el('submit').textContent=submitted?'Selections submitted':'Submit selections';
 el('submission').textContent='Last submitted: '+selectionText(v,c.submitted)+'. '+(ui.receipt?'Latest action receipt: '+ui.receipt.requestId+' · revision '+ui.receipt.revision+'. ':'')+(dirty?'Unsaved edits are not part of that submission.':c.submitted&&c.version!==c.submittedVersion?'Saved working changes still need submitting.':'');
 el('official').innerHTML=v.officialSquads[tid].map(id=>'<p>'+escapeHtml(playerName(v,id))+'</p>').join('');
 el('board').innerHTML=v.teams.map(t=>{const own=v.choices[t.id],choice=v.locked?.[t.id]||own?.submitted,progress=v.submissionProgress.find(p=>p.team===t.id);return '<p><strong>'+escapeHtml(t.name)+'</strong> · '+(progress.submitted?'Submitted':'Not submitted')+'<small>'+(choice?escapeHtml(selectionText(v,choice)):'Choices private until approval')+'</small></p>';}).join('');
 const queue=v.queues[tid]||[];
 el('queue').innerHTML=queue.map((id,i)=>{const taken=v.picks.find(p=>p.player===id);return '<div class="queue-item '+(taken?'taken':'')+'"><div><strong>'+escapeHtml(playerName(v,id))+'</strong><small>'+(taken?escapeHtml(teamName(v,taken.team)+' · Pick '+taken.label):escapeHtml(ownDiscardWarning(v,id)||'Queued'))+'</small></div><div class="toolbar"><button data-move="'+i+'" data-direction="-1" aria-label="Move '+escapeHtml(playerName(v,id))+' up" '+(blocked||i===0?'disabled':'')+'>↑</button><button data-move="'+i+'" data-direction="1" aria-label="Move '+escapeHtml(playerName(v,id))+' down" '+(blocked||i===queue.length-1?'disabled':'')+'>↓</button><button data-remove="'+escapeHtml(id)+'" aria-label="Remove '+escapeHtml(playerName(v,id))+'" '+(blocked?'disabled':'')+'>×</button></div></div>';}).join('')||'<p class="muted">Queue players from the pool below.</p>';
 const turn=v.plan[v.picks.length];el('turn').textContent=turn?teamName(v,turn.team)+' · Pick '+turn.label:'Draft not prepared';
 const q=el('search').value.toLowerCase();
 el('pool').innerHTML=v.players.filter(p=>(p.name+' '+p.club).toLowerCase().includes(q)).map(p=>{const availability=v.prepared?FFLDraft.available(v,p.id):{ok:false,reason:'Selections open before draft approval'},pick=v.picks.find(x=>x.player===p.id),stats=p.stats2026?.regularSeason;return '<tr class="'+(pick||availability.reason==='Retained'?'taken':'')+'"><td><strong>'+escapeHtml(p.name)+'</strong><small>'+escapeHtml(p.club)+(pick?' · '+escapeHtml(teamName(v,pick.team)+' · Pick '+pick.label):!availability.ok?' · '+escapeHtml(availability.reason):'')+'</small>'+(stats?'<details><summary>'+stats.games+' regular-season games</summary><small>'+escapeHtml(Object.entries(stats.fflAverages).map(([k,n])=>k+' '+(n==null?'—':Number(n).toFixed(1))).join(' · '))+'</small></details>':'')+'</td><td>'+escapeHtml(p.careerGames??'Unverified')+'</td><td><button data-queue="'+escapeHtml(p.id)+'" '+(blocked||['scheduled','validation','closed','hidden'].includes(phase)?'disabled':'')+'>'+(queue.includes(p.id)?'Queued':'Queue')+'</button></td><td><button data-pick="'+escapeHtml(p.id)+'" '+(!blocked&&phase==='drafting'&&turn?.team===tid&&availability.ok?'':'disabled')+'>Draft</button></td></tr>';}).join('');
 const caps=v.committeeCapabilities||[];el('hq').hidden=!caps.length;
 el('hqsummary').textContent=v.submissionProgress.filter(p=>p.submitted).length+' / '+v.teams.length+' submitted · '+v.picks.length+' picks recorded. Competition health has not been checked by this screen.';
 el('hqcontrols').innerHTML=[['prepare','Approve selections',phase==='review'&&v.submissionProgress.every(p=>p.submitted)],['arm','Arm draft',v.prepared&&!v.armed&&['ready','paused'].includes(phase)],['pause','Pause draft',['ready','drafting','validation'].includes(phase)],['resume','Resume draft',phase==='paused'&&v.armed]].filter(([type])=>caps.includes(type)).map(([type,label,enabled])=>'<button data-committee="'+type+'" '+(blocked||!enabled?'disabled':'')+'>'+label+'</button>').join('');
}
async function perform(type,data={}){
 try{el('feedback').textContent='';await client.dispatch(type,data);if(type==='save'){edits=null;editVersion=null;renderShared(client.snapshot());}}
 catch(error){el('feedback').textContent=error.message;}
}
function pickConfirmation(player){
 const v=ui.view,revision=v.revision,team=v.managingTeam,expectedPick=v.picks.length,turn=v.plan[expectedPick];
 if(controlsDisabled()||v.phase!=='drafting'||turn?.team!==team)return;
 promptConfirmation('Confirm your pick',playerName(v,player)+' for '+teamName(v,team)+' · Pick '+turn.label+'.',()=>{
  const current=client.snapshot();
  if(current.stale||current.pending||current.busy||current.view.revision!==revision||current.view.managingTeam!==team){el('feedback').textContent='The draft changed. Review the current turn before picking.';return;}
  perform('pick',{player,expectedPick});
 });
}
el('refresh').onclick=async()=>{try{await client.refresh();}catch(error){el('feedback').textContent=error.message;}};
el('retry').onclick=async()=>{try{const pendingType=client.snapshot().pending?.command.type;await client.retry();if(pendingType==='save'){edits=null;editVersion=null;renderShared(client.snapshot());}}catch(error){el('feedback').textContent=error.message;}};
el('discard').onclick=()=>promptConfirmation('Use the saved choices?','This discards only the unsaved changes on this screen.',()=>{edits=null;editVersion=null;renderShared(client.snapshot());});
el('save').onclick=()=>perform('save',{value:edits});
el('submit').onclick=()=>{if(edits&&!same(edits,ui.view.choices[ui.view.managingTeam].working))return;const revision=ui.view.revision;promptConfirmation('Submit your selections?',selectionText(ui.view,ui.view.choices[ui.view.managingTeam].working),()=>{if(controlsDisabled()||ui.view.revision!==revision){el('feedback').textContent='Your choices changed. Review them before submitting.';return;}perform('submit');});};
el('search').oninput=()=>{if(ui)renderShared(ui);};
window.addEventListener('beforeunload',event=>{if(ui?.pending||(edits&&ui?.view&&!same(edits,ui.view.choices[ui.view.managingTeam].working))){event.preventDefault();event.returnValue='';}});
el('team').onchange=()=>{const target=el('team').value;if(controlsDisabled())return;const url=new URL(location.href);url.searchParams.set('team',target);location.assign(url.toString());};
el('cancel').onclick=()=>{confirmJob=null;el('confirm').close();};el('confirmbutton').onclick=()=>{const job=confirmJob;confirmJob=null;el('confirm').close();job?.();};el('confirm').addEventListener('cancel',()=>{confirmJob=null;});
document.addEventListener('change',event=>{const id=event.target.dataset.choice;if(!id||controlsDisabled()||ui.view.phase!=='selection')return;const v=ui.view;if(!edits){edits=JSON.parse(JSON.stringify(v.choices[v.managingTeam].working));editVersion=v.choices[v.managingTeam].version;}for(const key of ['normal','fookies','delists'])edits[key]=edits[key].filter(p=>p!==id);if(event.target.value!=='release')edits[event.target.value].push(id);renderShared(ui);});
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b||b.disabled||controlsDisabled())return;
 const v=ui.view,queue=[...(v.queues[v.managingTeam]||[])];
 if(b.dataset.pick){pickConfirmation(b.dataset.pick);return;}
 if(b.dataset.queue){if(!queue.includes(b.dataset.queue))perform('queue',{players:[...queue,b.dataset.queue]});return;}
 if(b.dataset.remove){perform('queue',{players:queue.filter(id=>id!==b.dataset.remove)});return;}
 if(b.dataset.move!==undefined){const i=Number(b.dataset.move),j=i+Number(b.dataset.direction);if(j<0||j>=queue.length)return;[queue[i],queue[j]]=[queue[j],queue[i]];perform('queue',{players:queue});return;}
 if(b.dataset.committee){const type=b.dataset.committee,revision=v.revision;promptConfirmation(b.textContent+'?',type==='prepare'?'Lock the last submitted choices for every team. Official squads stay unchanged.':type==='arm'?'Allow the draft to open at its scheduled time.':'Change the shared Development draft status.',()=>{if(controlsDisabled()||ui.view.revision!==revision){el('feedback').textContent='The draft changed. Review before confirming.';return;}perform(type,type==='pause'?{reason:'Committee paused draft for review'}:{});});}
});
async function sharedTransport(payload){const response=await fetch(sharedEndpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),cache:'no-store',redirect:'follow'});if(!response.ok)throw Error('The shared draft is unavailable.');return response.json();}
el('login').onsubmit=async event=>{
 event.preventDefault();el('signin').disabled=true;el('feedback').textContent='Signing in…';
 try{
  if(!sharedEndpoint)throw Error('The shared Development connection has not been installed yet.');
  const result=await sharedTransport({action:'loginDraftWorkflow',instanceId:SHARED_CONFIG.instanceId,email:el('email').value,password:el('password').value});
  if(!result?.ok||typeof result.session?.token!=='string'||result.session.token.length<32)throw Error(result?.message||'Sign-in could not be confirmed.');
  sessionStorage.setItem(DRAFT_SESSION_KEY,result.session.token);el('feedback').textContent='';await client.refresh();
 }catch(error){el('feedback').textContent=error.message;}finally{el('password').value='';el('signin').disabled=false;}
};
el('signout').onclick=()=>{sessionStorage.removeItem(DRAFT_SESSION_KEY);location.reload();};
async function connectShared(){
 try{
  if(!SHARED_CONFIG.endpoint||!SHARED_CONFIG.instanceId)throw Error('The shared Development connection has not been installed yet. Your saved demo choices have not been submitted here.');
  const endpoint=new URL(SHARED_CONFIG.endpoint);
  if(endpoint.origin!=='https://script.google.com'||endpoint.search||endpoint.hash||!/^\/(?:a\/macros\/rockpad\.com\.au|macros)\/s\/[^/]+\/(?:exec|dev)$/.test(endpoint.pathname))throw Error('Invalid Development endpoint.');
  sharedEndpoint=endpoint.toString();
  teamTarget=new URL(location.href).searchParams.get('team')||undefined;
  client=createSharedDraftClient({instanceId:SHARED_CONFIG.instanceId,managingTeam:teamTarget,storage:sessionStorage,token:()=>sessionStorage.getItem(DRAFT_SESSION_KEY),requestId:()=>crypto.randomUUID(),changed:renderShared,
   send:sharedTransport
  });
  await client.refresh();
  setInterval(()=>{const s=client.snapshot();if(!s.busy&&!s.refreshing&&!s.pending&&document.visibilityState==='visible')client.refresh(undefined,{background:true}).catch(()=>{});},5000);
 }catch(error){el('connection').textContent=error.message;if(!client)el('refresh').disabled=true;}
}
connectShared();
