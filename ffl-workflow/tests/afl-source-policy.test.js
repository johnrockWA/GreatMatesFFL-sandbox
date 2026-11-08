const test=require('node:test'),assert=require('node:assert/strict');
const {POLICY,assessCompletedMatch}=require('../../competition/afl-source-policy');
const copy=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const expected={id:'m1',season:2026,home:'A',away:'B',playedAt:'2026-03-12T11:30:00Z',
  playerCounts:{A:1,B:1},venue:'Ground',rowDate:'Mar 12 2026 (Thu 7:30pm)'};
 const row=club=>['Player '+club,club,10,10,20,1,0,2,0,0,1,0,6,0,club==='A'?'B':'A','Ground',expected.rowDate];
 const match={...expected,completed:true,rows:[row('A'),row('B')]};
 return {expected,primary:{source:'OfficialAFL',match:copy(match)},verifier:{source:'AFLTables',match:copy(match)},previousPublished:copy(match)};
}
test('AFL is explicitly primary, existing names retained and live is off',()=>{
 assert.equal(POLICY.primary,'OfficialAFL');assert.equal(POLICY.verifier,'AFLTables');
 assert.equal(POLICY.liveEnabled,false);assert.equal(POLICY.preserveCanonicalNames,true);
 assert.equal(POLICY.regularRefreshMinutes,5);assert.equal(POLICY.finalsRefreshMinutes,1);
});
test('agreement produces only a candidate from AFL, never a publication',()=>{
 const x=fixture();x.primary.match.rows[0][13]=null;x.primary.match.unavailableStatistics=['rating'];
 const result=assessCompletedMatch(x.expected,x);
 assert.equal(result.status,'final-candidate');assert.equal(result.canPublish,false);
 assert.equal(result.match.rows[0][13],null); // verifier must not replace primary's data
});
test('AFL Tables outage holds finalisation while retaining the previous object',()=>{
 const x=fixture(),before=JSON.stringify(x.previousPublished);delete x.verifier;
 assert.equal(assessCompletedMatch(x.expected,x).status,'awaiting-verification');
 assert.equal(JSON.stringify(x.previousPublished),before);
});
test('missing AFL cannot silently fall back to a verifier or AFL Tables',()=>{
 const x=fixture();delete x.primary;assert.equal(assessCompletedMatch(x.expected,x).status,'held');
 x.primary={source:'AFLTables',match:x.verifier.match};assert.equal(assessCompletedMatch(x.expected,x).status,'held');
});
test('a copied archive cannot masquerade as an independent verifier',()=>{
 const x=fixture();x.verifier.source='StoredArchive';
 assert.equal(assessCompletedMatch(x.expected,x).status,'awaiting-verification');
});
test('a scoring difference greater than one holds finalisation; no original input mutates',()=>{
 const x=fixture();x.verifier.match.rows[0][10]=3;const before=JSON.stringify(x);
 assert.equal(assessCompletedMatch(x.expected,x).status,'held');assert.equal(JSON.stringify(x),before);
});
test('live/incomplete rows never pass the completed-match finalisation gate',()=>{
 const x=fixture();x.primary.match.completed=false;
 assert.equal(assessCompletedMatch(x.expected,x).status,'held');
});
test('incomplete or wrong-identity verifier cannot certify a finished game',()=>{
 for(const damage of ['partial','wrong-match']){
  const x=fixture();if(damage==='partial')x.verifier.match.rows.pop();else x.verifier.match.id='another-match';
  assert.equal(assessCompletedMatch(x.expected,x).status,'awaiting-verification');
 }
});
test('matching providers still propose a historical change for approval',()=>{
 const x=fixture();for(const source of [x.primary,x.verifier])source.match.rows[0][10]=2;
 const result=assessCompletedMatch(x.expected,x);assert.equal(result.status,'correction-proposed');
 assert.equal(result.approvalRequired,true);assert.equal(result.canPublish,false);
 assert.equal(result.before.rows[0][10],1);assert.equal(result.after.rows[0][10],2);
});
test('ordering and non-scoring differences do not cause false scoring disputes',()=>{
 const x=fixture();x.verifier.match.rows.reverse();x.verifier.match.rows[0][8]=2;
 assert.equal(assessCompletedMatch(x.expected,x).status,'final-candidate');
});

function adjust(row,column,delta){
 row[column]+=delta;
 if(column===2||column===3)row[4]+=delta;
 if(column===4)row[2]+=delta;
 if(column===10)row[12]+=6*delta;
 if(column===11)row[12]+=delta;
}
test('each scoring statistic permits signed differences of one and uses official values',()=>{
 for(const column of [2,3,4,5,6,7,10,11])for(const delta of [-1,1]){
  const x=fixture();delete x.previousPublished;
  // Keep all counts above zero so either signed boundary remains valid.
  for(const source of [x.primary,x.verifier]){const row=source.match.rows[0];row[5]=3;row[6]=3;row[10]=3;row[11]=3;row[12]=21;}
  adjust(x.verifier.match.rows[0],column,delta);const before=JSON.stringify(x);
  const result=assessCompletedMatch(x.expected,x);
  assert.equal(result.status,'final-candidate','column '+column+' delta '+delta);
  assert.deepEqual(result.match,x.primary.match);assert.equal(result.canPublish,false);
  assert.equal(result.comparison.maxStatisticDifference,1);assert.ok(result.comparison.differences.length);
  assert.ok(result.comparison.differences.every(d=>!d.requiresVerification));assert.equal(JSON.stringify(x),before);
 }
});
test('each scoring statistic requires verification at signed differences of two',()=>{
 for(const column of [2,3,4,5,6,7,10,11])for(const delta of [-2,2]){
  const x=fixture();delete x.previousPublished;
  for(const source of [x.primary,x.verifier]){const row=source.match.rows[0];row[5]=3;row[6]=3;row[10]=3;row[11]=3;row[12]=21;}
  adjust(x.verifier.match.rows[0],column,delta);
  const result=assessCompletedMatch(x.expected,x);assert.equal(result.status,'held');
  assert.equal(result.verificationRequired,true);assert.ok(result.comparison.differences.some(d=>d.requiresVerification));assert.equal(result.canPublish,false);
 }
});
test('tolerance applies per player and stat, with no netting or accumulation',()=>{
 const x=fixture();delete x.previousPublished;x.verifier.match.rows[0][7]--;x.verifier.match.rows[1][7]++;
 const result=assessCompletedMatch(x.expected,x);assert.equal(result.status,'final-candidate');
 assert.deepEqual(result.comparison.differences.map(d=>d.difference),[1,-1]);
 x.verifier.match.rows[0][7]--;x.verifier.match.rows[1][7]++;
 assert.equal(assessCompletedMatch(x.expected,x).status,'held');
});
test('small verifier differences do not bypass identity or historical correction controls',()=>{
 const x=fixture();x.verifier.match.rows[0][0]='Someone Else';
 assert.equal(assessCompletedMatch(x.expected,x).status,'held');
 const y=fixture();y.primary.match.rows[0][7]++;
 const result=assessCompletedMatch(y.expected,y);assert.equal(result.status,'correction-proposed');assert.equal(result.approvalRequired,true);
 assert.equal(result.after.rows[0][7],3);assert.equal(result.comparison.differences[0].difference,1);
});
