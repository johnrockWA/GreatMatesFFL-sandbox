const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function host(){
 const props=new Map(),cache=new Map(),ctx={PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},Logger:{log(){}},Date,JSON};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../api/DevelopmentRehearsal.gs'),'utf8'),ctx);
 let saved=0,replayed=false;ctx.fflIntegrationAssert_=()=>{};ctx.fflIntegrationInstance_=()=> 'test';ctx.fflIntegrationHash_=x=>x;
 ctx.fflIntegrationAuth_=()=>({validate:()=>({valid:true}),logout:()=>({signedOut:true})});ctx.fflIntegrationActor_=()=>({id:'alpha',team:'a'});ctx.fflIntegrationProjection_=s=>({...s});
 ctx.fflIntegrationStore_=()=>({dispatch(){saved++;return {state:{revision:10},receipt:{revision:10,requestId:'pick-1',replayed}};}});
 return {ctx,props,cache,get saved(){return saved;},replay(){replayed=true;},request(type='pick'){return ctx.fflIntegrationRequest({instanceId:'test',action:'writeDraftWorkflow',token:'test',principalKey:'alpha',command:{type,requestId:'pick-1'}});}};
}
test('synthetic lost-reply hook runs only after a non-replayed pick and cannot hide its recovery',()=>{
 const h=host();h.props.set('FFL_ACCEPTANCE_LOST_REPLY','armed');
 assert.equal(h.request('queue').ok,true);assert.equal(h.props.get('FFL_ACCEPTANCE_LOST_REPLY'),'armed');
 const lost=h.request();assert.equal(lost.code,'UNCONFIRMED');assert.equal(h.saved,2);assert.equal(JSON.parse(h.props.get('FFL_ACCEPTANCE_LOST_REPLY')).revision,10);
 h.replay();h.props.set('FFL_ACCEPTANCE_LOST_REPLY','armed');assert.equal(h.request().view.receipt.replayed,true);assert.equal(h.props.get('FFL_ACCEPTANCE_LOST_REPLY'),'armed');
});
test('synthetic expiry refuses another instance and expires only Alpha cache record',()=>{
 const h=host();h.props.set('FFL_ACCEPTANCE_SESSION_alpha@example.invalid','previous:draft-session:alpha');assert.throws(()=>h.ctx.fflExpireAcceptanceAlpha(),/Sign in Alpha/);
 h.props.set('FFL_ACCEPTANCE_SESSION_alpha@example.invalid','test:draft-session:alpha');h.cache.set('test:draft-session:alpha',JSON.stringify({valid:true,expiresAt:99999}));h.cache.set('test:draft-session:beta','untouched');h.ctx.fflExpireAcceptanceAlpha();assert.equal(JSON.parse(h.cache.get('test:draft-session:alpha')).expiresAt,0);assert.equal(h.cache.get('test:draft-session:beta'),'untouched');
});
