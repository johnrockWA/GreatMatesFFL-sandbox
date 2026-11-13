const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../..','index.html'),'utf8');

test('all inline app scripts still parse',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
 assert.ok(scripts.length);for(const source of scripts)new vm.Script(source);
});

test('app labels score states, preserves missing values and gates winners',()=>{
 assert.match(html,/Finished — awaiting verification/);
 assert.match(html,/Correction awaiting approval/);
 assert.match(html,/Object\.prototype\.hasOwnProperty\.call\(scores/);
 assert.match(html,/state === 'verified-final'/);
 assert.match(html,/!bracketSnapshot \|\| !details\.snapshotId \|\| details\.snapshotId !== bracketSnapshot/);
 assert.match(html,/const s1 = m\.team1Score != null \? m\.team1Score : '–'/);
 assert.doesNotMatch(html,/m\.team1Score != null \? m\.team1Score : 0/);
 assert.match(html,/Last attempt/);assert.match(html,/Last success/);assert.match(html,/Published/);
 assert.match(html,/checkedAt-lastSuccess>maxAgeMs/);
 assert.doesNotMatch(html,/p\.get\('gfstate'\)/);
 assert.doesNotMatch(html,/gfDeclaredPremier\(\)/);
});
