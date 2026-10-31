const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Exercise the actual UI render functions against an in-memory DOM facade. This
// checks rendered content and role transitions; it does not certify browser layout.
function preview(){
 const nodes=new Map();
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:false,value:'',style:{},dataset:{},setAttribute(){},addEventListener(){},replaceChildren(){this.innerHTML='';},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);},addEventListener(){}};
 const ctx=vm.createContext({document,localStorage:{getItem(){return null;},setItem(){}},console});
 const root=path.join(__dirname,'..');
 vm.runInContext('const FIXTURE='+fs.readFileSync(path.join(root,'fixtures/demo-post-trade-20261030.json'),'utf8'),ctx);
 for(const file of ['draft-engine.js','notifications.js','katy.js','admin-ui.js','preview-ui.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
 return {nodes,run:code=>vm.runInContext(code,ctx)};
}
test('coach display hides opponent choices and removes committee markup on role change',()=>{
 const p=preview();p.nodes.get('sample').onclick();
 assert.equal((p.nodes.get('board').innerHTML.match(/Choices private until approval/g)||[]).length,9);
 const ownId=p.run('state.choices[selected].working.normal[0]');
 const opponentName=p.run('name(state.choices[state.teams[1].id].working.normal[0])');
 assert.ok(ownId);assert.ok(!p.nodes.get('board').innerHTML.includes(opponentName));
 assert.equal(p.nodes.get('admincontent').innerHTML,'');
 p.run("role='commissioner'; workspace='admin'; render()");
 assert.ok(p.nodes.get('board').innerHTML.includes(opponentName));assert.match(p.nodes.get('admincontent').innerHTML,/Draft approvals/);
 p.run("role='coach'; render()");assert.equal(p.nodes.get('admincontent').innerHTML,'');assert.equal(p.nodes.get('adminview').hidden,true);
 p.run("role='commissioner'; now=FFLDraft.date(state.config.locksAt); run('prepare'); role='coach'; render()");
 assert.ok(p.nodes.get('board').innerHTML.includes(opponentName));assert.doesNotMatch(p.nodes.get('board').innerHTML,/Choices private until approval/);
});
test('Katy greeting and factual approval guidance render without enabling general AI',()=>{
 const p=preview();assert.match(p.nodes.get('katybanter').textContent,/Hello, coach/);
 p.run("role='commissioner';workspace='admin';render()");assert.match(p.nodes.get('admincontent').innerHTML,/Conversational AI off/);assert.match(p.nodes.get('admincontent').innerHTML,/setup approval becomes available after the deadline/);
});
test('Rockstars can retain Dunkley and saved demos receive only the confirmed history correction',()=>{
 const p=preview();
 p.run("selected='7';role='coach';render()");
 const d=p.run("state.players.find(p=>p.id==='p133')");assert.equal(d.history['7'].verified,true);assert.equal(d.history['7'].retains,1);
 assert.doesNotThrow(()=>p.run("FFLDraft.selection(state,'7',{normal:['p133'],fookies:[],delists:[]})"));
 assert.match(p.nodes.get('squad').innerHTML,/Josh Dunkley/);
 // Reproduce old local storage, retaining existing choices and draft metadata.
 p.run("state.players.find(p=>p.id==='p133').history['7']={verified:false,retains:0,recordedNormalYears:[2026]};state.players.find(p=>p.id==='p133').historyReview=true");
 const before=p.run("JSON.stringify({choices:state.choices,picks:state.picks,audit:state.audit,revision:state.revision})");
 p.run('refreshDemoEvidence(state)');assert.equal(p.run("state.players.find(p=>p.id==='p133').history['7'].retains"),1);
 assert.equal(p.run("JSON.stringify({choices:state.choices,picks:state.picks,audit:state.audit,revision:state.revision})"),before);
 p.run("state.players.find(p=>p.id==='p133').history['7'].retains=3;refreshDemoEvidence(state)");
 assert.throws(()=>p.run("FFLDraft.selection(state,'7',{normal:['p133'],fookies:[],delists:[]})"),/three consecutive/);
 p.run("state.players.find(p=>p.id==='p1').history['1'].verified=false");assert.throws(()=>p.run("FFLDraft.selection(state,'1',{normal:['p1'],fookies:[],delists:[]})"),/history requires verification/);
});
test('Jagga shows coach-confirmed 25 games and stale saved zero is upgraded without changing fookie eligibility',()=>{
 const p=preview();assert.equal(p.run("state.players.find(p=>p.id==='p128').careerGames"),25);
 p.run("state.players.find(p=>p.id==='p128').careerGames=0;refreshDemoEvidence(state)");
 assert.equal(p.run("state.players.find(p=>p.id==='p128').careerGames"),25);
 assert.doesNotThrow(()=>p.run("FFLDraft.selection(state,'7',{normal:[],fookies:['p128'],delists:[]})"));
 p.run("state.players.find(p=>p.id==='p128').careerGames=26;refreshDemoEvidence(state)");assert.equal(p.run("state.players.find(p=>p.id==='p128').careerGames"),26);
});
test('dynasty limit is a distinct factual status rather than an unresolved-history warning',()=>{
 const p=preview();p.run("selected='10';render()");
 const status=p.run("FFLDraft.retentionStatus(state,'10','p195')");assert.equal(status.code,'dynasty-limit');assert.equal(status.allowed,false);assert.match(status.detail,/2027/);assert.match(status.detail,/2024, 2025, 2026/);
 assert.match(p.nodes.get('squad').innerHTML,/Dynasty Player · Cannot retain/);assert.match(p.nodes.get('squad').innerHTML,/Must enter draft/);
 assert.throws(()=>p.run("FFLDraft.selection(state,'10',{normal:['p195'],fookies:[],delists:[]})"),/Dynasty Player/);
});
test('first-round own discard warning is visible in pool and queue, then clears in round two',()=>{
 const p=preview();p.run("role='commissioner';for(const t of state.teams)run('submit',{},actor(t.id));now=FFLDraft.date(state.config.locksAt);run('prepare');run('arm');now=FFLDraft.date(state.config.draftAt);role='coach';run('queue',{players:['p1']});render()");
 assert.match(p.nodes.get('pool').innerHTML,/You delisted this player/);assert.match(p.nodes.get('pool').innerHTML,/Available Round 2/);assert.match(p.nodes.get('queue').innerHTML,/Round 2/);
 assert.throws(()=>p.run("run('pick',{player:'p1',expectedPick:0})"),/Round 2/);
 p.run("role='commissioner';for(let i=0;i<10;i++){const p=state.players.find(p=>p.id!=='p1'&&FFLDraft.available(state,p.id).ok);run('pick',{player:p.id,expectedPick:state.picks.length,reason:'Test proxy pick'});}role='coach';render()");
 assert.equal(p.run("ownDiscardWarning('p1')"),'');assert.equal(p.run("FFLDraft.available(state,'p1').ok"),true);
});
test('snapshot upgrade preserves choices but does not change an already-started draft',()=>{
 const p=preview();p.run("state.dataRevision='old';state.prepared=true;state.armed=true;const oldPlayerCount=state.players.length;refreshDemoEvidence(state)");
 assert.equal(p.run('state.dataRefreshPending'),true);assert.equal(p.run('state.armed'),true);assert.throws(()=>p.run("run('submit')"),/earlier player snapshot/);
});
test('in-app draft notification follows the validated turn and flags the delayed email in preview',()=>{
 const p=preview();p.run("role='commissioner';for(const t of state.teams)run('submit',{},actor(t.id));now=FFLDraft.date(state.config.locksAt);run('prepare');run('arm');now=FFLDraft.date(state.config.draftAt);role='coach';render()");
 assert.equal(p.nodes.get('turnalert').hidden,false);assert.match(p.nodes.get('turnalert').innerHTML,/your pick 1.01/);
 p.run("const availablePlayer=state.players.find(p=>FFLDraft.available(state,p.id).ok);run('pick',{player:availablePlayer.id,expectedPick:0});render()");assert.equal(p.nodes.get('turnalert').hidden,true);
 p.run("selected=state.plan[state.picks.length].team;now+=3600001;role='commissioner';workspace='admin';render()");assert.equal(p.nodes.get('turnalert').hidden,false);assert.match(p.nodes.get('notificationstatus').textContent,/Email|email/);assert.match(p.nodes.get('notificationstatus').textContent,/no email sent/);
});

test('chat reflects current public status, escapes text, and clears on identity changes',()=>{
 const p=preview();p.run("sendChat('deadlines')");assert.match(p.nodes.get('katychatlog').innerHTML,/AWST/);
 p.run("sendChat('<img src=x onerror=alert(1)>')");assert.doesNotMatch(p.nodes.get('katychatlog').innerHTML,/<img/);assert.match(p.nodes.get('katychatlog').innerHTML,/&lt;img/);
 p.run("selected='7';render()");assert.equal(p.nodes.get('katychatlog').innerHTML,'');
 p.run("sendChat('whose turn');role='commissioner';render()");assert.equal(p.nodes.get('katychatlog').innerHTML,'');
 p.run("sendChat('banter')");p.nodes.get('clearchat').onclick();assert.equal(p.nodes.get('katychatlog').innerHTML,'');
});
