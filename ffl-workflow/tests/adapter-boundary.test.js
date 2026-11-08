const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture,start}=require('./helpers.cjs');
function adapter(props={}){
 const c={PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null})}};vm.createContext(c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../draft-engine.js'),'utf8'),c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../notifications.js'),'utf8'),c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../api/DraftWorkflow.gs'),'utf8'),c);return c;
}
test('missing explicit identity mappings fail closed',()=>{
 const c=adapter();assert.throws(()=>c.draftWorkflowActor_({valid:true,email:'test@example.invalid',team:'Alpha'}),/Verified team mapping/);
 assert.throws(()=>c.draftWorkflowActor_({valid:false,email:'test@example.invalid',team:'Alpha'}),/Authenticated/);
});
test('legacy client role cannot grant committee powers',()=>{
 const c=adapter({FFL_TEAM_IDS:JSON.stringify({Alpha:'a'})});
 assert.equal(c.draftWorkflowActor_({valid:true,email:'coach@example.invalid',team:'Alpha',role:'admin'}).role,'coach');
});
test('adapter read returns a private projection and releases its lock',()=>{
 const c=adapter({FFL_TEAM_IDS:JSON.stringify({Alpha:'a'})});let released=false;
 c.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){released=true;}})};
 c.draftWorkflowRead_=()=>fixture();c.Date=class extends Date {static now(){return start;}};
 const v=c.getDraftWorkflow_({valid:true,email:'coach@example.invalid',team:'Alpha'});
 assert.equal(v.choices.b,undefined);assert.equal(v.audit,undefined);assert.equal(released,true);
});
test('finalisation is blocked before storage even for a mapped Commissioner',()=>{
 const c=adapter({FFL_TEAM_IDS:JSON.stringify({Alpha:'a'}),FFL_COMMISSIONER_EMAIL:'owner@example.invalid'});let read=false,released=false;
 c.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){released=true;}})};
 c.draftWorkflowRead_=()=>{read=true;throw Error('Storage must not be read');};
 assert.throws(()=>c.postDraftWorkflow_({valid:true,email:'owner@example.invalid',team:'Alpha'},{type:'finalize'}),/Finalization is disabled/);
 assert.equal(read,false);assert.equal(released,true);
});
test('adapter writes consult the write gate before opening storage',()=>{
 const c=adapter();let opened=false;c.sandboxAssertWritesEnabled_=()=>{throw Error('Writes disabled');};c.draftWorkflowSheet_=()=>{opened=true;};
 assert.throws(()=>c.draftWorkflowWrite_(fixture()),/Writes disabled/);assert.equal(opened,false);
});
