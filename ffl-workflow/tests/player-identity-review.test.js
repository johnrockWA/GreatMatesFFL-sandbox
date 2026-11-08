'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{reconcile}=require('../../competition/player-identity-review');
const profile='https://afltables.com/afl/stats/players/W/Will_Hayes1.html';
function input(){return {players:[{id:'stable-17',name:'Will Hayes',club:'Different post-trade club',statsSource:profile}],existingRegistry:[],observations:[{matchId:'m1',club:'Historical club',jumper:39,profile,sourceName:'Will Hayes',officialPlayerId:'CD_I1032922',officialName:'William Hayes'}],aliases:[{profile,sourceName:'Will Hayes',officialPlayerId:'CD_I1032922',officialName:'William Hayes'}]};}
test('profile-specific aliases retain established canonical IDs/names and ignore current club',()=>{
 const x=input(),before=JSON.stringify(x),r=reconcile(x);assert.equal(JSON.stringify(x),before);
 assert.equal(r.registry[0].id,'stable-17');assert.equal(r.registry[0].name,'Will Hayes');assert.equal(r.canPublish,false);assert.deepEqual(r.additions,['stable-17']);
});
test('unknown profiles, namesakes and unapproved name variants fail closed',()=>{
 for(const change of [x=>x.observations[0].profile=profile.replace('Hayes1','Hayes'),x=>x.aliases=[],x=>x.aliases[0].officialPlayerId='CD_I999',x=>x.observations[0].sourceName='Will Green']){
  const x=input();change(x);assert.throws(()=>reconcile(x));
 }
});
test('official IDs cannot change across matches or be reused for a second canonical player',()=>{
 const x=input();x.observations.push({...x.observations[0],matchId:'m2',officialPlayerId:'CD_I999'});assert.throws(()=>reconcile(x),/conflict/);
 const y=input(),other=profile.replace('Hayes1','Hayes');y.players.push({id:'other',name:'Will Hayes',statsSource:other});y.observations.push({...y.observations[0],profile:other,matchId:'m2'});assert.throws(()=>reconcile(y),/conflict/);
});
test('duplicate profiles, canonical IDs and match appearances fail closed',()=>{
 for(const change of [x=>x.players.push({...x.players[0],id:'other'}),x=>x.players.push({...x.players[0],statsSource:profile.replace('Hayes1','Green')}),x=>x.observations.push({...x.observations[0]})]){const x=input();change(x);assert.throws(()=>reconcile(x));}
});
test('existing IDs and names survive extension; conflicts cannot be silently replaced',()=>{
 const x=input();x.existingRegistry=[{id:'stable-17',name:'Will Hayes',profile,officialPlayerId:'CD_I1032922',officialNames:['William Hayes']}];
 x.aliases=[];assert.deepEqual(reconcile(x).additions,[]);
 for(const key of ['id','name','officialPlayerId']){const y=input();y.existingRegistry=structuredClone(x.existingRegistry);y.existingRegistry[0][key]='wrong';assert.throws(()=>reconcile(y));}
});

test('recorded source names support legacy canonical spellings without renaming them',()=>{
 const x=input();x.players[0].name='William Hayes';x.players[0].sourceNames=['Will Hayes'];
 assert.equal(reconcile(x).registry[0].name,'William Hayes');
 x.players[0].sourceNames=['Will Green'];assert.throws(()=>reconcile(x),/mismatched/);
});
