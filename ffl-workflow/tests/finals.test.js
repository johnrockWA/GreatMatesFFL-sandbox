const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../../competition/finals');

const sixMatchBracket=[
 {id:'F1',a:F.seed(1),b:F.bye()},
 {id:'F2',a:F.seed(4),b:F.seed(5)},
 {id:'F3',a:F.seed(2),b:F.seed(3)},
 {id:'F4',a:F.ref('F1'),b:F.ref('F2')},
 {id:'F5',a:F.ref('F3'),b:F.ref('F4')},
 {id:'F6',a:F.ref('F5'),b:F.seed(1)}
];

test('evaluates a six-match supplied bracket without inventing its structure',()=>{
 const scores={F2:{D:70,E:60},F3:{B:80,C:75},F4:{A:90,D:85},F5:{B:95,A:92},F6:{B:100,A:98}};
 const out=F.evaluate({seeds:['A','B','C','D','E'],matches:sixMatchBracket,scores});
 assert.equal(out.champion,'B');assert.equal(out.matches.length,6);assert.equal(out.matches[0].bye,true);
 assert.deepEqual(out.audit.map(x=>x.winner),['A','D','B','A','B','B']);
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

test('rejects incomplete scores, invalid references and duplicate seeded teams',()=>{
 assert.throws(()=>F.evaluate({seeds:['A','A'],matches:[{id:'GF',a:F.seed(1),b:F.seed(2)}],scores:{}}),/Duplicate/);
 assert.throws(()=>F.evaluate({seeds:['A','B'],matches:[{id:'GF',a:F.ref('later'),b:F.seed(2)}],scores:{}}),/earlier completed/);
 assert.throws(()=>F.evaluate({seeds:['A','B'],matches:[{id:'GF',a:F.seed(1),b:F.seed(2)}],scores:{}}),/score missing/);
});
