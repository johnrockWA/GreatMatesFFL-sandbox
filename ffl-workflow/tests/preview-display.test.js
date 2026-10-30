const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Exercise the actual UI render functions against an in-memory DOM facade. This
// checks rendered content and role transitions; it does not certify browser layout.
function preview(){
 const nodes=new Map();
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:false,value:'',style:{},dataset:{},setAttribute(){},addEventListener(){},replaceChildren(){this.innerHTML='';},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);},addEventListener(){}};
 const ctx=vm.createContext({document,localStorage:{getItem(){return null;},setItem(){}},console});
 const root=path.join(__dirname,'..');
 vm.runInContext('const FIXTURE='+fs.readFileSync(path.join(root,'fixtures/demo-20261007.json'),'utf8'),ctx);
 for(const file of ['draft-engine.js','katy.js','admin-ui.js','preview-ui.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
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
 const unknown=p.run("state.players.find(p=>p.careerGames>50&&Object.values(p.history).some(h=>!h.verified))");assert.ok(unknown);
});
