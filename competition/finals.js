/* Pure finals bracket evaluator.
   The league-specific bracket and tie policy must be supplied from verified rules.
   No network, writes, recommendations or production integration. */
'use strict';

const fail=message=>{throw Error(message);};
const ref=(match,outcome='winner')=>({match,outcome});
const seed=n=>({seed:n});
const bye=()=>({bye:true});

function validateSeeds(seeds){
 if(!Array.isArray(seeds)||seeds.length<2)fail('At least two seeded teams required');
 const teams=new Set();
 return seeds.map((team,i)=>{
  if(typeof team!=='string'||!team.trim())fail('Seeded team names required');
  if(teams.has(team))fail('Duplicate seeded team: '+team);
  teams.add(team);return {team,seed:i+1};
 });
}

function slotValue(slot,seeded,results,currentIndex){
 if(!slot||typeof slot!=='object')fail('Invalid finals slot');
 if(slot.bye===true)return null;
 if(Number.isInteger(slot.seed)&&slot.seed>=1&&slot.seed<=seeded.length)return seeded[slot.seed-1];
 if(typeof slot.match==='string'&&['winner','loser'].includes(slot.outcome)){
  const prior=results.get(slot.match);if(!prior)fail('Finals reference must point to an earlier completed match: '+slot.match);
  if(prior.index>=currentIndex)fail('Finals bracket contains a forward reference: '+slot.match);
  return prior[slot.outcome];
 }
 fail('Invalid finals slot');
}

function finiteScore(value,label){
 if(!Number.isFinite(value)||value<0)fail('Verified non-negative score required: '+label);
 return value;
}

function tieWinner(a,b,policy,match){
 if(!policy)fail('Tied final requires a verified tie policy: '+match.id);
 if(policy.rule==='higher-seed')return a.seed<b.seed?a:b;
 if(policy.rule==='countback'){
  const values=policy.values?.[match.id];
  if(!values||!Number.isFinite(values[a.team])||!Number.isFinite(values[b.team]))fail('Verified countback values required: '+match.id);
  if(values[a.team]===values[b.team])fail('Countback remains tied; a further verified rule is required: '+match.id);
  return values[a.team]>values[b.team]?a:b;
 }
 fail('Unsupported finals tie policy');
}

function evaluate({seeds:teamSeeds,matches,scores,tiePolicy=null}){
 const seeded=validateSeeds(teamSeeds);
 if(!Array.isArray(matches)||!matches.length)fail('Finals matches required');
 if(!scores||typeof scores!=='object')fail('Finals scores required');
 const ids=new Set(),results=new Map(),audit=[];
 for(const [index,match] of matches.entries()){
  if(!match||typeof match.id!=='string'||!match.id.trim()||ids.has(match.id))fail('Unique finals match IDs required');
  ids.add(match.id);
  const a=slotValue(match.a,seeded,results,index),b=slotValue(match.b,seeded,results,index);
  if(!a&&!b)fail('A finals match cannot contain two byes: '+match.id);
  if(!a||!b){
   const winner=a||b,entry={id:match.id,index,winner,loser:null,bye:true,score:null};results.set(match.id,entry);
   audit.push({match:match.id,winner:winner.team,decision:'bye'});continue;
  }
  if(a.team===b.team)fail('A team cannot play itself: '+match.id);
  const row=scores[match.id];if(!row)fail('Completed finals score missing: '+match.id);
  const as=finiteScore(row[a.team],match.id+' '+a.team),bs=finiteScore(row[b.team],match.id+' '+b.team);
  let winner,decision='score';
  if(as===bs){winner=tieWinner(a,b,tiePolicy,match);decision=tiePolicy.rule;}
  else winner=as>bs?a:b;
  const loser=winner.team===a.team?b:a,entry={id:match.id,index,winner,loser,bye:false,score:{[a.team]:as,[b.team]:bs}};
  results.set(match.id,entry);audit.push({match:match.id,winner:winner.team,loser:loser.team,decision,score:entry.score});
 }
 const last=results.get(matches.at(-1).id);
 return {champion:last.winner.team,matches:[...results.values()].map(({index,...r})=>r),audit};
}

module.exports={evaluate,seed,ref,bye};
