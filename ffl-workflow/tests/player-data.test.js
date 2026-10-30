const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
test('2026 FFL averages score each match before averaging and keep finals separate',()=>{
 const script=path.resolve(__dirname,'../data-refresh');
 const result=cp.execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,sys.argv[1]);from reconcile_2026 import summary;fields=['kicks','handballs','disposals','marks','hitouts','tackles','goals','behinds','freeFor','freeAgainst'];a=dict.fromkeys(fields,0);b=dict(a);a['disposals']=20;b['disposals']=40;print(json.dumps(summary([a,b])))",script],{encoding:'utf8'});
 const x=JSON.parse(result);assert.equal(x.games,2);assert.equal(x.averages.disposals,30);assert.equal(x.fflAverages.midfielder,35.5);
});
const fs=require('node:fs'),zlib=require('node:zlib');
const F=require('../fixtures/demo-post-trade-20261030.json');
const SOURCE=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../data-refresh/player-evidence-20261030.json.gz'))));
test('dated snapshot has unique identities, verified squad coverage and valid clubs',()=>{
 const clubs=new Set(['Adelaide','Brisbane Lions','Carlton','Collingwood','Essendon','Fremantle','Geelong','Gold Coast','GWS Giants','Hawthorn','Melbourne','North Melbourne','Port Adelaide','Richmond','St Kilda','Sydney','West Coast','Western Bulldogs']);
 assert.equal(F.players.length,670);assert.equal(new Set(F.players.map(p=>p.id)).size,670);assert.equal(F.dataSnapshot.unresolvedPlayers.length,0);
 assert.equal(Object.values(F.squads).flat().length,200);assert.equal(new Set(Object.values(F.squads).flat()).size,200);
 for(const p of F.players){assert.ok(clubs.has(p.club),p.name+': '+p.club);assert.ok(Number.isInteger(p.careerGames)&&p.careerGames>=0);assert.equal(p.stats2026.regularSeason.games+p.stats2026.finals.games,p.stats2026.includingFinals.games);}
});
test('archived public evidence reconciles career counts and every season match count',()=>{
 assert.equal(SOURCE.players.length,670);assert.equal(SOURCE.errors.length,0);
 for(const p of SOURCE.players){assert.equal(p.careerGames,p.careerYears.reduce((n,y)=>n+y.games,0),p.name);assert.equal(p.seasonGames,p.games2026.length,p.name);for(const g of p.games2026)assert.equal(g.disposals,g.kicks+g.handballs,p.name);}
 const b=F.players.find(p=>p.id==='p195');assert.equal(b.history['10'].retains,3);assert.deepEqual(b.history['10'].qualifyingYears,[2024,2025,2026]);
 const j=F.players.find(p=>p.id==='p128');assert.equal(j.careerGames,25);assert.equal(j.stats2026.regularSeason.games,23);assert.equal(j.stats2026.finals.games,2);
 assert.equal(F.players.find(p=>p.name==='Ben King').club,'Hawthorn');assert.equal(F.players.find(p=>p.name==='Jake Stringer').listStatus,'delisted');
});
