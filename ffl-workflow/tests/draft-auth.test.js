const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDraftAuth}=require('../draft-auth'),{createDraftService}=require('../draft-service');
function lab(){
 const cache=new Map(),rows=[{email:'coach@example.invalid',password:'test-only',team:'Alpha'}];let now=1000,enabled=true,assigned=true,locked=false;
 const host={assertLogin(){if(!enabled)throw Error('disabled');},withLock(fn){assert.equal(locked,false);locked=true;try{return fn();}finally{locked=false;}},hash:s=>crypto.createHash('sha256').update(s).digest('hex'),now:()=>now,get:k=>cache.get(k),put(k,v){cache.set(k,v);},remove:k=>cache.delete(k),accounts:()=>rows,actor(){if(!assigned)throw Error('unassigned');},randomToken:()=>crypto.randomUUID()};
 return {auth:createDraftAuth(host),host,cache,rows,clock:v=>now=v,enable:v=>enabled=v,assign:v=>assigned=v};
}
test('isolated login reads credentials without changing coach records and stores only hashed token keys',()=>{
 const h=lab(),before=JSON.stringify(h.rows),session=h.auth.login({email:' COACH@example.invalid ',password:'test-only'});
 assert.equal(JSON.stringify(h.rows),before);assert.deepEqual(h.auth.validate(session.token),{valid:true,email:'coach@example.invalid',team:'Alpha'});
 const serialized=JSON.stringify([...h.cache]);assert.ok(!serialized.includes(session.token));assert.ok(!serialized.includes('test-only'));
 h.clock(Date.parse(session.expiresAt));assert.equal(h.auth.validate(session.token).valid,false);
});
test('unknown accounts, duplicate credentials, unassigned coaches and disabled login fail closed',()=>{
 const h=lab();assert.throws(()=>h.auth.login({email:'other@example.invalid',password:'test-only'}),/Unable/);
 h.assign(false);assert.throws(()=>h.auth.login({email:'coach@example.invalid',password:'test-only'}),/Unable/);h.assign(true);
 h.rows.push({...h.rows[0]});assert.throws(()=>h.auth.login({email:'coach@example.invalid',password:'test-only'}),/Unable/);
 h.enable(false);assert.throws(()=>h.auth.login({email:'coach@example.invalid',password:'test-only'}),/disabled/);
});
test('attempt throttling is bounded and a removed access grant invalidates an existing session',()=>{
 const h=lab();for(let i=0;i<5;i++)assert.throws(()=>h.auth.login({email:'coach@example.invalid',password:'wrong'}),/Unable/);
 assert.throws(()=>h.auth.login({email:'coach@example.invalid',password:'test-only'}),/Too many/);h.clock(601001);
 const session=h.auth.login({email:'coach@example.invalid',password:'test-only'});h.assign(false);assert.equal(h.auth.validate(session.token).valid,false);
 assert.equal(h.auth.validate('bad').valid,false);
});
test('draft sign-in dispatch requires the exact instance and does not call competition writers',()=>{
 const h=lab();let writes=0;const service=createDraftService({assertEnvironment(){},instance:()=> 'reviewed-instance',login:h.auth.login,write(){writes++;}});
 assert.equal(service({action:'loginDraftWorkflow',instanceId:'wrong'}).ok,false);
 const result=service({action:'loginDraftWorkflow',instanceId:'reviewed-instance',email:'coach@example.invalid',password:'test-only'});
 assert.equal(result.ok,true);assert.ok(result.session.token);assert.equal(writes,0);
});
