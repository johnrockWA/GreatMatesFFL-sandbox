/** Prepared isolated login. Never writes Users_Teams or enables legacy login. */
function draftWorkflowAuth_(){
 const cache=CacheService.getScriptCache();
 return createDraftAuth({
  assertLogin:function(){
   sandboxAssertProject_();
   const p=PropertiesService.getScriptProperties();
   if(!draftWorkflowProjectMatches_()||p.getProperty('FFL_DRAFT_ROUTES_ENABLED')!=='true'||p.getProperty('FFL_DRAFT_LOGIN_ENABLED')!=='true'||p.getProperty('FFL_SANDBOX_WRITES_ENABLED')==='true')throw Error('Isolated draft login is disabled.');
  },
  accounts:function(){
   const sheet=sandboxOpenById_(DRAFT_WORKFLOW_SANDBOX_ID_).getSheetByName('Users_Teams');
   if(!sheet)throw Error('Coach records unavailable.');
   return sheet.getDataRange().getValues().slice(1).map(r=>({email:String(r[5]||''),password:String(r[6]||'').trim(),team:String(r[1]||'').trim()}));
  },
  actor:draftWorkflowActor_,now:Date.now,randomToken:function(){return Utilities.getUuid();},
  hash:function(value){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value));},
  get:function(key){return cache.get(key);},put:function(key,value,ttl){cache.put(key,value,ttl);},remove:function(key){cache.remove(key);},
  withLock:function(fn){const lock=LockService.getScriptLock();lock.waitLock(10000);try{return fn();}finally{lock.releaseLock();}}
 });
}
