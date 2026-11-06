const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../api/ScoreRead.gs');

function fixture(){
 const snapshot={snapshotId:'snap-1',status:'awaiting-verification',updatedAt:'2026-11-06T00:00:00Z',correctionPending:true,collectionPaused:true,
  lastAttemptAt:'2026-11-06T00:01:00Z',lastSuccessAt:'2026-11-06T00:00:00Z',warnings:['Verification pending'],
  matches:[{id:'m1',round:'R1',home:'A',away:'B',scores:{A:0,B:80},scoreState:'awaiting-verification',privateAudit:{actor:'hidden'}}],
  privateCorrections:[{team:'private'}]};
 const head={version:4,snapshotId:'snap-1',hash:'verified-hash'};
 return {snapshot,head,services:{loadHead:()=>({...head}),loadSnapshot:()=>snapshot,hash:()=>head.hash}};
}

test('returns one checksummed public projection and preserves zero',()=>{
 const x=fixture(),out=R.read({email:'coach@example.invalid',role:'coach',team:'A'},x.services);
 assert.equal(out.snapshotId,'snap-1');assert.equal(out.matches[0].scores.A,0);
 assert.equal(out.correctionPending,true);assert.equal(out.collectionPaused,true);
 assert.equal(out.matches[0].privateAudit,undefined);assert.equal(out.privateCorrections,undefined);
});

test('rejects unauthorized identities, corrupt snapshots and moving heads',()=>{
 let x=fixture();assert.throws(()=>R.read({email:'',role:'coach',team:'A'},x.services),/identity/);
 x=fixture();x.services.hash=()=> 'wrong';assert.throws(()=>R.read({email:'a@b.invalid',role:'committee'},x.services),/checksum/);
 x=fixture();let reads=0;x.services.loadHead=()=>reads++?{...x.head,version:5}:x.head;
 assert.throws(()=>R.read({email:'a@b.invalid',role:'commissioner'},x.services),/changed during read/);
});
