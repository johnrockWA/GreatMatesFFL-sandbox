const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const W=require('../development-workflow'),N=require('../notifications');
const {E,start,admin,coach,other,prepared,act}=require('./helpers.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),T=start+172800000;
function lab(){let d=prepared();for(const p of d.players)p.club='SYNTHETIC';while(d.picks.length<d.plan.length){const team=d.plan[d.picks.length].team;d=act(d,'pick',{player:d.players.find(p=>E.available(d,p.id).ok).id,expectedPick:d.picks.length},{...coach,team},T);}let s=W.create(d,new Date(T+3600000).toISOString());return {get s(){return s;},run(type,data={},a=admin,now=T){s=W.apply(s,{type,revision:s.revision,...data},a,now,hash);return s;}};}
function publish(h){h.run('stageSquads');h.run('publishSquads',{approvedHash:h.s.proposal.hash});}
function nominate(h){for(const a of [coach,other])h.run('nominate',{squadVersion:h.s.squadVersion,nomination:{starters:h.s.squads[a.team].slice(0,7),reserves:h.s.squads[a.team].slice(7,14)}},a);}
function evidence(s){return {sourceVersion:'synthetic-1',complete:true,verified:true,clubOrder:[['SYNTHETIC',1]],stats:Object.fromEntries(s.draft.players.map((p,i)=>[p.id,{K:10,H:5,D:15,M:3,HO:2,T:4,G:i%3,B:1}]))};}
test('completed draft flows through reviewed squads weekly nominations verified scores and ladder',()=>{
 const h=lab();assert.equal(h.s.draft.picks.length,40);assert.throws(()=>h.run('stageSquads',{},coach),/Committee/);publish(h);assert.equal(new Set(Object.values(h.s.squads).flat()).size,40);
 nominate(h);assert.equal(W.view(h.s,coach).nomination.starters.length,7);assert.equal(W.view(h.s,coach).proposal,null);
 h.run('stageScores',{evidence:evidence(h.s)},admin,T+3600000);assert.equal(h.s.round.published,null);h.run('publishScores',{approvedHash:h.s.proposal.hash},admin,T+3600000);
 assert.equal(h.s.round.published.ladder.length,2);assert.equal(h.s.round.published.ladder.reduce((n,t)=>n+t.p,0),2);
 const backup=JSON.parse(JSON.stringify(h.s)),e=evidence(h.s);e.stats.p0.G+=2;h.run('stageScores',{evidence:e},admin,T+3600001);
 assert.throws(()=>h.run('publishScores',{approvedHash:h.s.proposal.hash},admin,T+3600001),/reason/);
 h.run('publishScores',{approvedHash:h.s.proposal.hash,reason:'Verified synthetic correction'},admin,T+3600001);assert.notEqual(h.s.round.published.hash,backup.round.published.hash);
 h.run('restore',{backup,backupHash:hash(JSON.stringify(backup)),reason:'Restore drill'},admin,T+3600002);assert.deepEqual(h.s.round,backup.round);assert.ok(h.s.revision>backup.revision);
});
test('stale approval wrong squad expired nominations and incomplete stats fail closed',()=>{
 const h=lab();h.run('stageSquads');assert.throws(()=>h.run('publishSquads',{approvedHash:'old'}),/Review/);h.run('publishSquads',{approvedHash:h.s.proposal.hash});
 assert.throws(()=>h.run('nominate',{squadVersion:0,nomination:{}},coach),/Squads changed/);
 assert.throws(()=>h.run('nominate',{squadVersion:1,nomination:{starters:h.s.squads.b.slice(0,7),reserves:h.s.squads.b.slice(7,14)}},coach),/your approved/);
 nominate(h);assert.throws(()=>h.run('nominate',{},coach,T+3600000),/locked/);assert.throws(()=>h.run('stageScores',{evidence:{complete:false}},admin,T+3600000),/verified/);
 assert.throws(()=>h.run('restore',{backup:h.s,backupHash:'tampered',reason:'test'}),/Verified backup/);
});
test('weekly submission status drives the suppressed notification outbox without duplicate delivery',()=>{
 const h=lab();publish(h);const context=()=>({now:T,rounds:[{id:h.s.round.id,lockoutAt:h.s.round.lockoutAt,teams:h.s.draft.teams.map(t=>({...t,submitted:!!h.s.round.nominations[t.id]}))}]});let saved=null,sent=[];
 const services={emailEnabled:true,readContext:context,resolveRecipient:t=>t+'@example.invalid',save:x=>saved=x,send:m=>{assert.equal(saved.records[m.notificationId].status,'attempting');sent.push(m);return {accepted:true,id:'captured-'+sent.length};}};
 let ledger=N.dispatch(null,context(),services);ledger=N.dispatch(ledger,context(),services);assert.equal(sent.length,2);nominate(h);assert.equal(N.roundEmails(context().rounds,T).length,0);
});
