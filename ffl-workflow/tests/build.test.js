const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
test('preview builds consistently from an unrelated working directory',()=>{
 const builder=path.join(__dirname,'../build-preview.py'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ffl-build-'));
 try{
  const one=path.join(dir,'one.html'),two=path.join(dir,'two.html');
  cp.execFileSync('python3',[builder,'--output',one],{cwd:dir});cp.execFileSync('python3',[builder,'--output',two],{cwd:os.tmpdir()});
  assert.deepEqual(fs.readFileSync(one),fs.readFileSync(two));
  const html=fs.readFileSync(one,'utf8');assert.match(html,/FFL HQ/);assert.match(html,/Administration by Katy/);assert.doesNotMatch(html,/Ask Katy|katychatform|MEET YOUR EXECUTIVE/);assert.doesNotMatch(html,/__ENGINE__|__KATY__|__FIXTURE__/);
  let scripts=0;for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){new vm.Script(m[1]);scripts++;}assert.equal(scripts,6);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('private Development package is reproducible, preserves guards and contains current source',()=>{
 const builder=path.join(__dirname,'../build-development.py'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ffl-dev-'));
 const host=path.join(dir,'host.gs');fs.writeFileSync(host,"function fflOwnerSharedAssert_(){ if(FFL_SANDBOX_WRITES_ENABLED)throw Error('disabled'); }\nfunction request(){fflOwnerSharedAssert_();}\nfunction fflOwnerSharedPage_(){fflOwnerSharedAssert_();return 'old';}");
 try{
  const out=path.join(dir,'out');cp.execFileSync('python3',[builder,'--owner-host',host,'--instance','synthetic','--output',out]);
  const first=fs.readFileSync(path.join(out,'manifest.json'),'utf8');cp.execFileSync('python3',[builder,'--owner-host',host,'--instance','synthetic','--output',out]);assert.equal(fs.readFileSync(path.join(out,'manifest.json'),'utf8'),first);
  const page=fs.readFileSync(path.join(out,'OwnerDraftLogin.gs'),'utf8'),bundle=fs.readFileSync(path.join(out,'SharedDraftWorkflow.gs'),'utf8');new vm.Script(page);new vm.Script(bundle);
  const html=JSON.parse(page.match(/createHtmlOutput\((".*")\)\.setTitle/)[1]);for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
  assert.match(html,/logoutDraftWorkflow/);assert.match(html,/fflOwnerSharedDraftRequest/);assert.match(bundle,/function createDraftAuth/);assert.ok(!page.includes('john@'));
  const integration=path.join(__dirname,'../build-integration.py');
  cp.execFileSync('python3',[integration,'--package-dir',out]);
  const lab=fs.readFileSync(path.join(out,'IntegrationRehearsal.gs'),'utf8');new vm.Script(lab);
  const labHtml=JSON.parse(lab.match(/createHtmlOutput\((".*")\.replace/)[1]);
  assert.match(labHtml,/"instanceId": "__INTEGRATION_INSTANCE__"/);
  for(const m of labHtml.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
  assert.equal(manifest.files['IntegrationRehearsal.gs'],require('node:crypto').createHash('sha256').update(lab).digest('hex'));
  assert.throws(()=>cp.execFileSync('python3',[integration,'--package-dir',out],{stdio:'pipe'}),/Rebuild the clean/);

 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
