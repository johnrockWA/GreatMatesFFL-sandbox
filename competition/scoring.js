/* Pure historical replay engine. Provisional rules recovered from 2026 workbook.
   No network, writes, coach recommendations or production integration. */
'use strict';
const identity=(name,club)=>name.trim().toLowerCase()+'|'+club.trim().toLowerCase();
const POSITIONS=['Forward 1','Forward 2','Ruck','Marker','Midfielder','Tackler','All Rounder'];
function score(position,stats){
 if(!POSITIONS.includes(position))throw Error('Unknown scoring position');
 for(const k of ['K','H','D','M','HO','T','G','B'])if(!Number.isFinite(stats[k])||stats[k]<0)throw Error('Verified non-negative statistics required: '+k);
 const s=stats;
 return position.startsWith('Forward')?6*s.G+2*s.B:position==='Ruck'?s.HO+3*s.G:position==='Marker'?s.K+3*s.M+3*s.G:position==='Midfielder'?Math.min(s.D,29)+2*Math.max(0,s.D-29)+3*s.G:position==='Tackler'?s.H+3*s.T+3*s.G:s.D+s.M+s.T+3*s.G;
}
function resolve(nomination,players,clubOrder,{complete=false}={}){
 if(!complete)throw Error('Complete, closed-round statistics are required for historical resolution');
 if(!Array.isArray(nomination.starters)||!Array.isArray(nomination.reserves)||nomination.starters.length!==7||nomination.reserves.length!==7)throw Error('Seven starters and seven reserves required');
 const row=p=>{if(!p||typeof p.name!=='string'||!p.name.trim()||!p.club)throw Error('Verified player identity and historical club required');return players.get(identity(p.name,p.club));};
 const starterRows=nomination.starters.map(row);nomination.reserves.forEach(row);
 const result=nomination.starters.map((p,i)=>starterRows[i]?{position:POSITIONS[i],player:p.name,club:p.club,outcome:'SELECTED',points:score(POSITIONS[i],starterRows[i])}:null);
 const missing=nomination.starters.map((p,i)=>({i,order:clubOrder.get(p.club)??0})).filter(x=>!starterRows[x.i]).sort((a,b)=>a.order-b.order||a.i-b.i);
 const used=new Set(result.filter(Boolean).map(p=>identity(p.player,p.club)));
 for(const {i} of missing){
  const candidates=i<2?[0,1]:[i];let found=null;
  for(const j of candidates){const p=nomination.reserves[j],key=identity(p.name,p.club),s=row(p);if(!s||used.has(key))continue;used.add(key);found={position:POSITIONS[i],player:p.name,club:p.club,outcome:i<2?'RESERVE'+(j+1):'RESERVE',points:score(POSITIONS[i],s)};break;}
  result[i]=found||{position:POSITIONS[i],player:null,club:null,outcome:'NONE',points:0};
 }
 return {positions:result,total:result.reduce((n,p)=>n+p.points,0)};
}
function ladder(fixtures,scores){
 const teams=new Map(),seen=new Set();const get=t=>{if(!teams.has(t))teams.set(t,{team:t,p:0,w:0,l:0,d:0,points:0,pf:0,pa:0});return teams.get(t);};
 for(const f of fixtures){if(f.home===f.away||!f.round)throw Error('Invalid fixture');for(const t of [f.home,f.away]){const k=f.round+'|'+t;if(seen.has(k))throw Error('Duplicate team/round fixture');seen.add(k);}
  const h=get(f.home),a=get(f.away),hs=scores.get(f.round+'|'+f.home),as=scores.get(f.round+'|'+f.away);
  if(!Number.isFinite(hs)||!Number.isFinite(as))throw Error('Completed scores required; zero is valid');
  h.p++;a.p++;h.pf+=hs;h.pa+=as;a.pf+=as;a.pa+=hs;
  if(hs===as){h.d++;a.d++;h.points+=2;a.points+=2;}else{const w=hs>as?h:a,l=hs>as?a:h;w.w++;w.points+=4;l.l++;}
 }
 // Incumbent ranks by competition points, then points FOR, then percentage.
 return [...teams.values()].map(t=>({...t,percentage:t.pa?t.pf/t.pa:1})).sort((a,b)=>b.points-a.points||b.pf-a.pf||b.percentage-a.percentage||a.team.localeCompare(b.team)).map((t,i)=>({...t,rank:i+1}));
}
module.exports={POSITIONS,identity,score,resolve,ladder};
