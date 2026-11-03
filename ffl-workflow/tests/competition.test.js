const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../../competition/scoring');
const stats=(changes={})=>({K:10,H:10,D:20,M:4,HO:5,T:3,G:1,B:2,...changes});
test('weekly positional scoring includes the 29 disposal threshold and zero games',()=>{
 const expected=[10,10,8,25,23,22,30];E.POSITIONS.forEach((p,i)=>assert.equal(E.score(p,stats()),expected[i]));
 assert.equal(E.score('Midfielder',stats({D:29})),32);assert.equal(E.score('Midfielder',stats({D:30})),34);
 assert.equal(E.score('Forward 1',stats({G:0,B:0})),0);assert.throws(()=>E.score('Ruck',{}),/statistics/);
});
test('reserve resolution uses absence chronology, pooled forwards and single-use reserves',()=>{
 const starters=E.POSITIONS.map((_,i)=>({name:'starter'+i,club:'club'+i})),reserves=E.POSITIONS.map((_,i)=>({name:'reserve'+i,club:'resclub'}));
 reserves[0]=reserves[2];const nom={starters,reserves},players=new Map();
 for(const p of [...starters.slice(3),...reserves])players.set(E.identity(p.name,p.club),stats());
 const order=new Map([['club0',20],['club1',30],['club2',10]]),result=E.resolve(nom,players,order,{complete:true});
 assert.equal(result.positions[2].player,'reserve2');assert.equal(result.positions[0].player,'reserve1');assert.equal(result.positions[1].outcome,'NONE');
 assert.throws(()=>E.resolve(nom,players,order),/Complete/);
 // A played zero is a real score, and must not trigger substitution.
 players.set(E.identity(starters[0].name,starters[0].club),stats({G:0,B:0}));assert.equal(E.resolve(nom,players,order,{complete:true}).positions[0].outcome,'SELECTED');
});
test('ladder retains zero scores and uses points for before percentage',()=>{
 const f=[{round:'1',home:'A',away:'B'},{round:'1',home:'C',away:'D'}],s=new Map([['1|A',0],['1|B',0],['1|C',100],['1|D',100]]);
 const l=E.ladder(f,s);assert.equal(l[0].team,'C');assert.equal(l.find(t=>t.team==='A').d,1);assert.equal(l.find(t=>t.team==='A').points,2);
 assert.throws(()=>E.ladder([...f,f[0]],s),/Duplicate/);assert.throws(()=>E.ladder(f,new Map()),/Completed/);
});
