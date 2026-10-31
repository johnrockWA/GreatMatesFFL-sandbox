const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
test('preview builds consistently from an unrelated working directory',()=>{
 const builder=path.join(__dirname,'../build-preview.py'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ffl-build-'));
 try{
  const one=path.join(dir,'one.html'),two=path.join(dir,'two.html');
  cp.execFileSync('python3',[builder,'--output',one],{cwd:dir});cp.execFileSync('python3',[builder,'--output',two],{cwd:os.tmpdir()});
  assert.deepEqual(fs.readFileSync(one),fs.readFileSync(two));
  const html=fs.readFileSync(one,'utf8');assert.match(html,/FFL HQ/);assert.match(html,/Katy · Executive Administrator/);assert.doesNotMatch(html,/__ENGINE__|__KATY__|__FIXTURE__/);
  let scripts=0;for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){new vm.Script(m[1]);scripts++;}assert.equal(scripts,6);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
