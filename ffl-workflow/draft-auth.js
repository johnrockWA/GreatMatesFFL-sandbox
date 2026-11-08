/* Isolated draft sessions. Credential records are read-only; cache I/O is host-owned. */
'use strict';
function createDraftAuth(host){
 const ttl=21600,limit=5,delay=600;
 function login(payload){return host.withLock(()=>{
  host.assertLogin();
  const email=typeof payload.email==='string'?payload.email.trim().toLowerCase():'',password=payload.password;
  if(!email||email.length>320||typeof password!=='string'||!password||password.length>256)throw Error('Email and password required.');
  const key='draft-login:'+host.hash(email),now=host.now(),attempt=JSON.parse(host.get(key)||'null');
  if(attempt&&attempt.until>now&&attempt.count>=limit)throw Error('Too many sign-in attempts. Try again in ten minutes.');
  const next={count:attempt&&attempt.until>now?attempt.count+1:1,until:attempt&&attempt.until>now?attempt.until:now+delay*1000};
  host.put(key,JSON.stringify(next),delay);
  const matches=host.accounts().filter(a=>typeof a.email==='string'&&a.email.trim().toLowerCase()===email&&a.password===password.trim());
  let auth;
  if(matches.length===1){auth={valid:true,email,team:matches[0].team};try{host.actor(auth);}catch{auth=null;}}
  if(!auth)throw Error('Unable to sign in to this draft. Check your details and assigned access.');
  const token=host.randomToken();if(typeof token!=='string'||token.length<32)throw Error('Session creation failed.');
  host.put('draft-session:'+host.hash(token),JSON.stringify({...auth,expiresAt:now+ttl*1000}),ttl);
  host.remove(key);
  return {token,expiresAt:new Date(now+ttl*1000).toISOString()};
 });}
 function validate(token){
  if(typeof token!=='string'||token.length<32||token.length>128)return {valid:false};
  const raw=host.get('draft-session:'+host.hash(token));if(!raw)return {valid:false};
  let auth;try{auth=JSON.parse(raw);}catch{return {valid:false};}
  if(auth.valid!==true||!Number.isFinite(auth.expiresAt)||auth.expiresAt<=host.now())return {valid:false};
  try{host.actor(auth);}catch{return {valid:false};}
  return {valid:true,email:auth.email,team:auth.team};
 }
 return {login,validate};
}
if(typeof module!=='undefined')module.exports={createDraftAuth};
