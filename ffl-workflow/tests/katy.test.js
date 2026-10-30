const test=require('node:test'),assert=require('node:assert/strict');
const K=require('../katy');
test('Katy is visible by name and conversational AI remains disabled',()=>{
 assert.equal(K.identity.name,'Katy');assert.equal(K.identity.aiEnabled,false);assert.ok(Object.isFrozen(K));
 assert.throws(()=>K.converse('Arm the draft'),/disabled/);
});
test('next-step explanations distinguish missing submissions, corrections and draft approval',()=>{
 assert.match(K.nextStep({phase:'review',missingCount:2}).text,/2 missing submissions/);
 assert.match(K.nextStep({phase:'review',invalidCount:1}).text,/selection issues/);
 assert.match(K.nextStep({phase:'paused',armed:false}).text,/arm the corrected draft/);
 assert.equal(K.nextStep({phase:'validation'}).approvalRequired,true);
});
test('Katy explains a verified rule result without modifying or executing it',()=>{
 const input=Object.freeze({allowed:false,reason:'Missing history',ruleId:'dynasty-cap',ruleVersion:'provisional-build03'});
 const result=K.explainDecision(input);assert.equal(result.canExecute,false);assert.equal(result.allowed,false);assert.equal(result.ruleId,input.ruleId);
 assert.ok(Object.isFrozen(result));assert.throws(()=>K.explainDecision({allowed:true}),/verified rule/);
});
