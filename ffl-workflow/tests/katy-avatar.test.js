const test=require('node:test'),assert=require('node:assert/strict'),A=require('../katy-avatar');
const base={phase:'selection',managingTeam:'a',turnTeam:null,submitted:false,serverNow:'2027-02-01T06:00:00Z',locksAt:'2027-02-01T12:00:00Z'};
test('Katy looks switch only from administrative workflow state',()=>{
 assert.equal(A.select(base),A.states.administrator);
 assert.equal(A.select({...base,serverNow:'2027-02-01T10:00:00Z'}),A.states.deadline);
 assert.equal(A.select({...base,submitted:true}),A.states.submitted);
 assert.equal(A.select({...base,phase:'drafting',turnTeam:'a'}),A.states.draftTurn);
 assert.equal(A.select({...base,phase:'drafting',turnTeam:'b'}),A.states.administrator);
});
test('avatar state is immutable and contains no coaching output',()=>{
 for(const state of Object.values(A.states)){
  assert.ok(Object.isFrozen(state));assert.deepEqual(Object.keys(state).sort(),['asset','label']);
  assert.doesNotMatch(JSON.stringify(state),/recommend|rank|captain|trade|line.?up|best player/i);
 }
 assert.ok(Object.isFrozen(A));assert.ok(Object.isFrozen(A.states));
});
