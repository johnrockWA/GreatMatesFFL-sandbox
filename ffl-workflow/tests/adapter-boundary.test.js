const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture,start}=require('./helpers.cjs');
const grant={email:'coach@example.invalid',teams:[{id:'a',name:'Alpha'}],role:'coach',capabilities:[]};
function adapter(grants=[]){
 const props={FFL_DRAFT_IDENTITIES:JSON.stringify(grants)},c={Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,s)=>s,base64EncodeWebSafe:s=>'key-'+s},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null})}};vm.createContext(c);
 for(const name of ['draft-engine.js','notifications.js','draft-store.js','draft-access.js','api/DraftWorkflow.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),c);
 return c;
}
test('missing explicit identity mappings fail closed',()=>{
 const c=adapter();assert.throws(()=>c.draftWorkflowActor_({valid:true,email:'coach@example.invalid',team:'Alpha'}),/verified coach mapping/);
 assert.throws(()=>c.draftWorkflowActor_({valid:false,email:'coach@example.invalid',team:'Alpha'}),/Authenticated/);
});
test('legacy client role cannot grant committee powers',()=>{
 assert.equal(adapter([grant]).draftWorkflowActor_({valid:true,email:'coach@example.invalid',team:'Alpha',role:'admin'}).role,'coach');
});
test('adapter read returns only the managing team private projection',()=>{
 const c=adapter([grant]);c.draftWorkflowStore_=()=>({read:()=>({data:{state:fixture()}})});c.Date=class extends Date {static now(){return start;}};
 const v=c.getDraftWorkflow_({valid:true,email:'coach@example.invalid',team:'Alpha'});
 assert.equal(v.choices.b,undefined);assert.equal(v.audit,undefined);assert.equal(v.managingTeam,'a');
});
test('finalisation is blocked before storage even for an explicitly granted Commissioner',()=>{
 const c=adapter([{...grant,role:'commissioner'}]);let read=false;c.draftWorkflowStore_=()=>{read=true;throw Error('Storage must not be read');};
 assert.throws(()=>c.postDraftWorkflow_({valid:true,email:'coach@example.invalid',team:'Alpha'},{type:'finalize'}),/Finalization is disabled/);assert.equal(read,false);
});
test('adapter writes consult the write gate before opening storage',()=>{
 const c=adapter([grant]);let opened=false;c.draftWorkflowAssertWrites_=()=>{throw Error('Writes disabled');};c.draftWorkflowStore_=()=>{opened=true;};
 assert.throws(()=>c.postDraftWorkflow_({valid:true,email:'coach@example.invalid',team:'Alpha'},{type:'submit'}),/Writes disabled/);assert.equal(opened,false);
});

test('isolated draft write gate refuses the wrong project, an absent grant, and operational writes',()=>{
 const c=adapter(),props={FFL_DRAFT_PROJECT_ID:'development-project',FFL_DRAFT_WRITES_ENABLED:'true',FFL_SANDBOX_WRITES_ENABLED:'false'};
 c.sandboxAssertProject_=()=>{};let project='development-project';c.ScriptApp={getScriptId:()=>project};c.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]})};
 assert.doesNotThrow(()=>c.draftWorkflowAssertWrites_());delete props.FFL_DRAFT_PROJECT_ID;assert.throws(()=>c.draftWorkflowAssertWrites_(),/disabled/);props.FFL_DRAFT_PROJECT_ID='development-project';project='different';assert.throws(()=>c.draftWorkflowAssertWrites_(),/disabled/);project='development-project';
 props.FFL_DRAFT_WRITES_ENABLED='false';assert.throws(()=>c.draftWorkflowAssertWrites_(),/disabled/);props.FFL_DRAFT_WRITES_ENABLED='true';props.FFL_SANDBOX_WRITES_ENABLED='true';assert.throws(()=>c.draftWorkflowAssertWrites_(),/disabled/);
});
test('a committee role does not itself disclose private selections or queues',()=>{
 const c=adapter([{...grant,role:'president',capabilities:['pause']}]);c.draftWorkflowStore_=()=>({read:()=>({data:{state:fixture()}})});
 let v=c.getDraftWorkflow_({valid:true,email:grant.email,team:'Alpha'});assert.equal(v.choices.b,undefined);assert.equal(v.audit,undefined);
 const reviewed=adapter([{...grant,role:'president',capabilities:['review']}]);reviewed.draftWorkflowStore_=c.draftWorkflowStore_;v=reviewed.getDraftWorkflow_({valid:true,email:grant.email,team:'Alpha'});assert.ok(v.choices.b);assert.equal(v.queues.b,undefined);
});
