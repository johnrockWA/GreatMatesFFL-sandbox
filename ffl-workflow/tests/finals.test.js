const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../../competition/finals');

test('evaluates the verified Final Five graph and every advancement path',()=>{
 const scores={EF:{D:70,E:60},QF:{B:80,C:75},SF1:{C:85,D:82},SF2:{A:90,B:88},PF:{C:92,B:89},GF:{A:100,C:98}};
 const out=F.evaluate({seeds:['A','B','C','D','E'],matches:F.finalFive(),scores});
 assert.equal(out.champion,'A');assert.equal(out.matches.length,6);
 assert.deepEqual(out.audit.map(x=>[x.match,x.winner]),[['EF','D'],['QF','B'],['SF1','C'],['SF2','A'],['PF','C'],['GF','A']]);
 assert.deepEqual(out.matches.map(x=>x.score&&Object.keys(x.score)),[['D','E'],['B','C'],['C','D'],['A','B'],['C','B'],['A','C']]);
});

test('a tied final fails closed until a verified policy is supplied',()=>{
 const matches=[{id:'GF',a:F.seed(1),b:F.seed(2)}],scores={GF:{A:80,B:80}};
 assert.throws(()=>F.evaluate({seeds:['A','B'],matches,scores}),/verified tie policy/);
 assert.equal(F.evaluate({seeds:['A','B'],matches,scores,tiePolicy:{rule:'higher-seed'}}).champion,'A');
});

test('countback requires match-specific verified values and refuses a second tie',()=>{
 const matches=[{id:'GF',a:F.seed(1),b:F.seed(2)}],scores={GF:{A:80,B:80}};
 assert.throws(()=>F.evaluate({seeds:['A','B'],matches,scores,tiePolicy:{rule:'countback'}}),/countback values/);
 assert.equal(F.evaluate({seeds:['A','B'],matches,scores,tiePolicy:{rule:'countback',values:{GF:{A:9,B:12}}}}).champion,'B');
 assert.throws(()=>F.evaluate({seeds:['A','B'],matches,scores,tiePolicy:{rule:'countback',values:{GF:{A:9,B:9}}}}),/remains tied/);
});

test('incumbent tied-final rule uses match-specific ACPF then higher seed',()=>{
 const matches=[{id:'GF',a:F.seed(1),b:F.seed(2)}],scores={GF:{A:80,B:80}};
 assert.throws(()=>F.evaluate({seeds:['A','B'],matches,scores,tiePolicy:{rule:'acpf-then-seed'}}),/ACPF values/);
 assert.equal(F.evaluate({seeds:['A','B'],matches,scores,tiePolicy:{rule:'acpf-then-seed',values:{GF:{A:91.2,B:94.6}}}}).champion,'B');
 assert.equal(F.evaluate({seeds:['A','B'],matches,scores,tiePolicy:{rule:'acpf-then-seed',values:{GF:{A:93,B:93}}}}).champion,'A');
});

test('generic evaluator still supports an explicit bye',()=>{
 const matches=[{id:'B1',a:F.seed(1),b:F.bye()},{id:'GF',a:F.ref('B1'),b:F.seed(2)}];
 const out=F.evaluate({seeds:['A','B'],matches,scores:{GF:{A:90,B:80}}});
 assert.equal(out.champion,'A');assert.equal(out.matches[0].bye,true);
});

test('rejects incomplete scores, invalid references and duplicate seeded teams',()=>{
 assert.throws(()=>F.evaluate({seeds:['A','A'],matches:[{id:'GF',a:F.seed(1),b:F.seed(2)}],scores:{}}),/Duplicate/);
 assert.throws(()=>F.evaluate({seeds:['A','B'],matches:[{id:'GF',a:F.ref('later'),b:F.seed(2)}],scores:{}}),/earlier completed/);
 assert.throws(()=>F.evaluate({seeds:['A','B'],matches:[{id:'GF',a:F.seed(1),b:F.seed(2)}],scores:{}}),/score missing/);
});
