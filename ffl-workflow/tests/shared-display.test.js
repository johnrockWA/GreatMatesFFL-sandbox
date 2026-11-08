const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {E,fixture,prepared,start,coach}=require('./helpers.cjs');
// Render the real shared UI with server-projected synthetic data. This is not
// browser layout, real authentication or a connected simultaneous-request test.
function screen(state=fixture(),now=start){
 const nodes=new Map(),events={},windowEvents={},sent=[];
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,dataset:{},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);},addEventListener:(name,fn)=>events[name]=fn};
 const ctx=vm.createContext({document,window:{addEventListener:(name,fn)=>windowEvents[name]=fn},SHARED_CONFIG:{endpoint:'',instanceId:''},console});
 for(const name of ['draft-engine.js','shared-ui.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),ctx,{filename:name});
 const v={...E.view(state,coach,now),serverNow:new Date(now).toISOString(),instanceId:'test',principalKey:'alpha',managingTeam:'a',managedTeams:['a'],committeeCapabilities:[]};
 ctx.snapshot={view:v,pending:null,receipt:null,busy:false,stale:false,message:'Checked'};
 ctx.fakeClient={snapshot:()=>ctx.snapshot,dispatch:async(type,data)=>{sent.push({type,data});}};
 vm.runInContext('client=fakeClient;renderShared(snapshot)',ctx);
 return {nodes,events,windowEvents,sent,ctx,run:code=>vm.runInContext(code,ctx)};
}
test('shared selections distinguish unsaved edits, submitted choices and another-session conflicts',()=>{
 let state=fixture();state=E.apply(state,{type:'submit',revision:0},coach,start);
 const p=screen(state);assert.equal(p.nodes.get('selectionstatus').textContent,'Submitted');
 p.events.change({target:{dataset:{choice:'p0'},value:'normal'}});
 assert.match(p.nodes.get('selectionstatus').textContent,/Unsaved/);assert.equal(p.nodes.get('submit').disabled,true);assert.equal(p.nodes.get('save').disabled,false);
 p.run('snapshot.view.choices.a.version++;renderShared(snapshot)');
 assert.match(p.nodes.get('selectionstatus').textContent,/another session/);assert.equal(p.nodes.get('save').disabled,true);assert.equal(p.nodes.get('submit').disabled,true);
 p.nodes.get('discard').onclick();p.nodes.get('confirmbutton').onclick();assert.equal(p.run('edits'),null);
 assert.equal(p.nodes.get('submit').disabled,false);assert.deepEqual(p.sent,[]);
});
test('pending confirmation prevents a second save and unsaved edits warn before leaving',()=>{
 const p=screen();p.events.change({target:{dataset:{choice:'p0'},value:'normal'}});
 let prevented=false;const event={preventDefault(){prevented=true;}};p.windowEvents.beforeunload(event);assert.equal(prevented,true);
 p.run("snapshot.pending={command:{type:'save'}};renderShared(snapshot)");
 assert.equal(p.nodes.get('retry').hidden,false);assert.equal(p.nodes.get('save').disabled,true);assert.equal(p.nodes.get('team').disabled,true);
});
test('shared pick confirmation loses authority after a refresh or a failed connection',()=>{
 const p=screen(prepared(),start+172800000);p.run("pickConfirmation('p20')");assert.equal(p.nodes.get('confirm').open,true);assert.equal(p.sent.length,0);
 p.run('snapshot.view.revision++;renderShared(snapshot)');p.nodes.get('confirmbutton').onclick();assert.equal(p.sent.length,0);assert.match(p.nodes.get('feedback').textContent,/draft changed/);
 p.run("pickConfirmation('p20');snapshot.stale=true;renderShared(snapshot)");p.nodes.get('confirmbutton').onclick();assert.equal(p.sent.length,0);
 p.run("snapshot.stale=false;renderShared(snapshot);pickConfirmation('p20')");p.nodes.get('confirmbutton').onclick();assert.equal(p.sent.length,1);assert.equal(p.sent[0].type,'pick');assert.equal(p.sent[0].data.expectedPick,0);
});
test('shared screen never renders opponent selections, labels taken queues and escapes names',()=>{
 const state=prepared();state.players[0].name='<img onerror=bad>';state.queues.a=['p20'];
 const picked=E.apply(state,{type:'pick',player:'p20',expectedPick:0,revision:state.revision},coach,start+172800000);
 const p=screen(picked,start+172800001);
 assert.match(p.nodes.get('queue').innerHTML,/taken/);assert.match(p.nodes.get('queue').innerHTML,/Alpha · Pick 1.01/);assert.doesNotMatch(p.nodes.get('squad').innerHTML,/<img/);assert.match(p.nodes.get('squad').innerHTML,/&lt;img/);
 assert.equal(p.nodes.get('hq').hidden,true);assert.equal(p.ctx.snapshot.view.choices.b,undefined);
});
test('an unconfigured shared build fails closed without a demo or a network call',()=>{
 const p=screen();assert.match(p.nodes.get('connection').textContent,/Checked/);
 p.run('client=null;connectShared()');assert.match(p.nodes.get('connection').textContent,/has not been installed/);assert.equal(p.nodes.get('refresh').disabled,true);assert.equal(p.sent.length,0);
 const html=fs.readFileSync(path.join(__dirname,'../../shared-draft.html'),'utf8');
 assert.doesNotMatch(html,/__ENGINE__|__CLIENT__|__CONFIG__|__SHARED_UI__|const FIXTURE/);
 for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
});
