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
test('successful refresh clears old feedback without discarding edits; failed or pending refresh does not',async()=>{
 const p=screen();p.events.change({target:{dataset:{choice:'p0'},value:'normal'}});
 p.run("el('feedback').textContent='Old rejection'");p.ctx.fakeClient.refresh=async()=>p.ctx.snapshot;
 await p.nodes.get('refresh').onclick();assert.equal(p.nodes.get('feedback').textContent,'');assert.ok(p.run('edits'));
 p.nodes.get('feedback').textContent='Unconfirmed request';p.ctx.snapshot.pending={command:{type:'save'}};
 await p.nodes.get('refresh').onclick();assert.equal(p.nodes.get('feedback').textContent,'Unconfirmed request');
 p.ctx.fakeClient.refresh=async()=>{throw Error('Still offline');};await p.nodes.get('refresh').onclick();assert.equal(p.nodes.get('feedback').textContent,'Still offline');
});
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
test('draft login sends credentials once, clears the password and saves only a draft session',async()=>{
 const p=screen(),saved=new Map(),requests=[];let refreshes=0;
 p.ctx.sessionStorage={setItem:(k,v)=>saved.set(k,v)};p.ctx.fakeClient.refresh=async()=>refreshes++;
 p.ctx.transport=async payload=>{requests.push(payload);return {ok:true,session:{token:'draft-token-with-more-than-32-characters'}};};
 p.run("sharedEndpoint='https://script.google.com/macros/s/example/dev';sharedTransport=transport");
 p.run("el('email').value='coach@example.invalid';el('password').value='test-only'");
 await p.nodes.get('login').onsubmit({preventDefault(){}});
 assert.equal(requests.length,1);assert.equal(requests[0].action,'loginDraftWorkflow');assert.equal(p.nodes.get('password').value,'');assert.equal(refreshes,1);
 assert.equal(saved.get('ffl_shared_draft_session_v1'),'draft-token-with-more-than-32-characters');assert.ok(!JSON.stringify([...saved]).includes('test-only'));
});
test('expired authentication hides the prior private view and offers draft sign-in',()=>{
 const p=screen();p.run('snapshot.authRequired=true;renderShared(snapshot)');
 assert.equal(p.nodes.get('content').hidden,true);assert.equal(p.nodes.get('login').hidden,false);assert.equal(p.nodes.get('signout').hidden,true);
});

test('clock-only background refresh preserves interactive DOM and local edits',()=>{
 const p=screen();p.events.change({target:{dataset:{choice:'p0'},value:'normal'}});
 let replacements=0;
 for(const id of ['squad','queue','pool','team']){
  const node=p.nodes.get(id);let html=node.innerHTML;
  Object.defineProperty(node,'innerHTML',{get:()=>html,set:value=>{replacements++;html=value;}});
 }
 p.run('snapshot.refreshing=true;renderShared(snapshot)');
 assert.equal(p.run('controlsDisabled()'),false);assert.equal(p.nodes.get('save').disabled,false);
 p.run('snapshot.refreshing=false;snapshot.view.serverNow=new Date(Date.parse(snapshot.view.serverNow)+5000).toISOString();renderShared(snapshot)');
 assert.equal(replacements,0);assert.match(p.nodes.get('selectionstatus').textContent,/Unsaved/);
 p.run('snapshot.view.revision++;snapshot.view.choices.a.version++;renderShared(snapshot)');
 assert.ok(replacements>0);assert.match(p.nodes.get('selectionstatus').textContent,/another session/);assert.equal(p.nodes.get('save').disabled,true);
});
test('phase changes at the same revision still update the controls',()=>{
 const p=screen();p.run("snapshot.view.phase='review';renderShared(snapshot)");
 assert.equal(p.nodes.get('phase').textContent,'Committee review');assert.match(p.nodes.get('squad').innerHTML,/disabled/);
});
test('sign-out waits for revocation and preserves pending recovery on failure',async()=>{
 const p=screen(),saved=new Map([['ffl_shared_draft_session_v1','token']]);let reloads=0,requests=0;
 p.ctx.sessionStorage={getItem:k=>saved.get(k),removeItem:k=>saved.delete(k)};p.ctx.location={reload(){reloads++;}};
 p.ctx.transport=async()=>{requests++;throw Error('Offline');};p.run('sharedTransport=transport');
 p.ctx.snapshot.pending={command:{type:'pick'}};await p.nodes.get('signout').onclick();assert.equal(requests,0);assert.match(p.nodes.get('feedback').textContent,/pending/);
 p.ctx.snapshot.pending=null;await p.nodes.get('signout').onclick();assert.equal(saved.size,1);assert.equal(reloads,0);
 p.ctx.transport=async()=>({ok:true,signedOut:true});p.run('sharedTransport=transport');await p.nodes.get('signout').onclick();assert.equal(saved.size,0);assert.equal(reloads,1);
});
