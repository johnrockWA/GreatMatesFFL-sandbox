const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const S=require('../../competition/score-status');
const source=fs.readFileSync(require('node:path').join(__dirname,'../api/ScorePreview.gs'),'utf8');
function setup(damage){
 const payload={source:'OfficialAFL',verifier:'AFLTables',round:'Rd01',season:2026,canPublish:false,matches:[{completed:true}],teams:[{team:'A',total:0},{team:'B',total:12}],assessments:[],privateNominations:['hidden']};
 const json=JSON.stringify(payload),hash=crypto.createHash('sha256').update(json).digest('hex'),head=JSON.stringify({row:2,hash,revision:1});
 let reads=0,opened=0;
 const values={A1:'FFL_SHADOW_ONLY_V1',B2:head,B3:JSON.stringify({hash,status:'awaiting-verification',lastAttemptAt:'2026-11-06T00:00:00Z'})};
 if(damage==='failed')values.B3=JSON.stringify({hash,status:'error',lastAttemptAt:'2026-11-06T01:00:00Z'});
 if(damage==='identity')values.A1='WRONG';
 const control={getRange:a=>({getValue:()=>{if(a==='B2'&&++reads>1&&damage==='race')return 'changed';return values[a];}})};
 const snapshots={getLastRow:()=>2,getRange:(row,col)=>({getValues:()=>[col===1?[hash,damage==='chunks'?0:1,'2026-11-05T12:00:00Z']:[damage==='corrupt'?json+'x':json]]})};
 const context={FFLScoreStatus:S,sandboxAssertProject_:()=>{},PropertiesService:{getScriptProperties:()=>({getProperty:()=>damage==='unconfigured'?null:'test-store'})},
  SpreadsheetApp:{openById:()=>{opened++;return {getName:()=> 'SANDBOX - AFL Pipeline Lab - 2027 Development',getSheetByName:name=>name==='Control'?control:snapshots};}},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,text)=>[...crypto.createHash('sha256').update(text).digest()]}};
 vm.createContext(context);vm.runInContext(source,context);return {context,opened:()=>opened};
}
test('score preview rejects missing/coach/client identities before reading storage',()=>{
 const h=setup();for(const auth of [null,{valid:false,role:'admin'},{valid:true,role:'coach'},{role:'admin'}])assert.throws(()=>h.context.getScorePreview_(auth),/Admin access/);
 assert.equal(h.opened(),0);assert.throws(()=>setup('unconfigured').context.getScorePreview_({valid:true,role:'admin'}),/not configured/);
});
test('score preview returns only paired score/status projection and preserves zero',()=>{
 const p=setup().context.getScorePreview_({valid:true,role:'admin'});assert.equal(p.scores.A,0);assert.equal(p.scoreState.snapshotId,p.scoreSnapshotId);
 assert.equal(p.scoreState.collectedAt,'2026-11-06T00:00:00Z');assert.equal(p.preview,true);assert.equal(p.canPublish,false);assert.equal(p.privateNominations,undefined);
 assert.equal(p.scoreState.finalised,false);assert.equal(p.scoreState.collectorActive,false);
});
test('failed collector attempts cannot refresh the last-good statistics timestamp',()=>{
 assert.equal(setup('failed').context.getScorePreview_({valid:true,role:'admin'}).scoreState.collectedAt,'2026-11-05T12:00:00Z');
});
test('identity, corruption, malformed chunks and changing head fail closed without writes',()=>{
 for(const damage of ['identity','corrupt','chunks','race'])assert.throws(()=>setup(damage).context.getScorePreview_({valid:true,role:'admin'}));
 assert.doesNotMatch(source,/\.setValue|\.setValues|newTrigger|fetch\(/);
});
