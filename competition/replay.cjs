const fs=require('fs'),path=require('path');const E=require('./scoring');
const inputDir=process.argv[2];if(!inputDir||!path.isAbsolute(inputDir))throw Error('Usage: node competition/replay.cjs /absolute/private-evidence-directory');
const data=JSON.parse(fs.readFileSync(inputDir+'/source.json')),all=JSON.parse(fs.readFileSync(inputDir+'/allstats.json')),lookup=JSON.parse(fs.readFileSync(inputDir+'/lookups.json')),mapping=JSON.parse(fs.readFileSync(inputDir+'/mapping.json'));
const clubs=new Map(lookup.playerclubs.values.slice(1).filter(r=>r[0]&&r[1]).map(r=>[r[0],r[1]]));
const mapped=new Map(mapping.scoremapping.values.slice(1).filter(r=>r[0]).map(r=>[r[0],r[1]]));
const historicalClubs=new Map();for(const tab of Object.values(all))for(const r of tab.values.slice(1)){if(!r[0]||!r[1])continue;const key=r[0].toLowerCase();if(!historicalClubs.has(key))historicalClubs.set(key,new Set());historicalClubs.get(key).add(r[1]);}
const latest=new Map(),cleanName=s=>s.replace(/\s*\([^)]*\)$/, '').trim();
const stamp=s=>{const m=s.match(/^(\d+)\/(\d+)\/(\d+) (\d+):(\d+)(?::(\d+))?$/);if(!m)throw Error('Unknown Perth date format');return Date.UTC(+m[3],+m[2]-1,+m[1],+m[4]-8,+m[5],+(m[6]||0));};
const locks=new Map(mapping.allmapping.values.slice(1).filter(r=>r[5]).map(r=>[r[5],stamp(r[6])]));
data.nomrows.values.slice(1).forEach((r,i)=>{const at=stamp(data.nomtimes.values[i+1][0]),key=r[1]+'|'+r[0];if(r.length>=16&&at<locks.get(r[1])&&(!latest.has(key)||latest.get(key).at<at))latest.set(key,{at,names:r.slice(2,16).map(cleanName)});});
const rawNomReplay=[],result=[],inputs=[],errors=[];let slots=0;
for(const r of data.seasonrows.values.slice(1)){
 const [game,round,team]=r;if(!team)continue;
 const tab=mapped.get(round),raw=all[tab]?.values;if(!raw){errors.push({round,team,error:'Missing stats tab'});continue;}
 const players=new Map(),clubOrder=new Map();for(const [i,row] of raw.slice(1).entries()){if(!row[0]||!row[1])continue;const item=Object.fromEntries(raw[0].map((h,j)=>[h,row[j]]));const key=E.identity(row[0],row[1]);if(players.has(key))throw Error('Duplicate stat identity '+key);players.set(key,item);if(!clubOrder.has(row[1]))clubOrder.set(row[1],i+1);}
 const nameAt=i=>{const name=r[i];if(!name)throw Error('Missing nomination at '+i);return {name,club:clubs.get(name)||(historicalClubs.get(name.toLowerCase())?.size===1?[...historicalClubs.get(name.toLowerCase())][0]:null)};};
 try{
 const nomination={starters:Array.from({length:7},(_,i)=>nameAt(13+2*i)),reserves:Array.from({length:7},(_,i)=>nameAt(29+2*i))};
 const simulated=E.resolve(nomination,players,clubOrder,{complete:true});
 const original=latest.get(round+'|'+team);if(original){try{const ids=original.names.map(name=>({name,club:clubs.get(name)||(historicalClubs.get(name.toLowerCase())?.size===1?[...historicalClubs.get(name.toLowerCase())][0]:null)}));const n={starters:ids.slice(0,7),reserves:ids.slice(7)};const a=E.resolve(n,players,clubOrder,{complete:true});rawNomReplay.push({round,team,total:a.total,incumbent:+r[10],difference:a.total-Number(r[10]),sameNomination:original.names.every((n,i)=>n.toLowerCase()===[...nomination.starters,...nomination.reserves][i].name.toLowerCase())});}catch(e){rawNomReplay.push({round,team,error:e.message});}}
 const expected=r.slice(3,10).map((s,i)=>{const m=s.match(/^(.*) - (-?\d+(?:\.\d+)?)$/);return {position:E.POSITIONS[i],player:m?.[1]==='No eligible player'?null:m?.[1]||null,points:m?+m[2]:(r[44+i]==='NONE'?0:null),outcome:r[44+i]};});
 const differences=expected.flatMap((e,i)=>{slots++;const a=simulated.positions[i];return e.player?.toLowerCase()!==a.player?.toLowerCase()||e.points!==a.points||e.outcome!==a.outcome?[{position:e.position,expected:e,actual:a}]:[];});
 result.push({round,team,game,expectedTotal:+r[10],actualTotal:simulated.total,difference:simulated.total-Number(r[10]),differences});inputs.push({round,team,nomination});
 }catch(e){errors.push({round,team,error:e.message});}
}
const scores=new Map(result.map(r=>[r.round+'|'+r.team,r.actualTotal]));const fixtures=data.fixturesall.values.slice(1).filter(r=>/^Rd\d+$/.test(r[1]||'')&&r[3]&&r[5]).map(r=>({game:r[0],round:r[1],home:r[3],away:r[5]}));
console.log(JSON.stringify({count:result.length,errors}));const simLadder=errors.length?[]:E.ladder(fixtures,scores),oldLadder=data.ladder.values.slice(2,12).map(r=>({team:r[0],p:+r[1],w:+r[2],l:+r[3],d:+r[4],points:+r[5],pf:+r[6],pa:+r[7],rank:+r[10]}));
const ladderDiff=oldLadder.flatMap(e=>{const a=simLadder.find(a=>a.team===e.team);return Object.keys(e).filter(k=>e[k]!==a?.[k]).map(k=>({team:e.team,field:k,expected:e[k],actual:a?.[k]}));});
const report={rawNomReplay,asOf:'2026-11-03',basis:'Read-only 2026 sandbox workbook snapshots, NOT independently validated incumbent/live scraper',teams:result.length,slots,exactTeams:result.filter(r=>!r.differences.length&&r.difference===0).length,totalMatches:result.filter(r=>!r.difference).length,errors,differences:result.filter(r=>r.differences.length||r.difference),results:result,ladder:simLadder,ladderDiff,fixtures:fixtures.length};
fs.writeFileSync(inputDir+'/report.json',JSON.stringify(report,null,2));fs.writeFileSync(inputDir+'/nominations.json',JSON.stringify(inputs,null,2));console.log(JSON.stringify({...report,results:undefined,ladder:undefined,rawNomReplay:undefined},null,2));
