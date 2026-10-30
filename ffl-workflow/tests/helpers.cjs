const E=require('../draft-engine');
const start=Date.parse('2027-02-01T00:00:00+08:00');
const admin={id:'commissioner-test',role:'commissioner',team:'a'};
const coach={id:'alpha-test',role:'coach',team:'a'};
const other={id:'beta-test',role:'coach',team:'b'};
function fixture(){
 const teams=[{id:'a',name:'Alpha'},{id:'b',name:'Beta'}];
 const players=Array.from({length:40},(_,i)=>({id:'p'+i,name:'Player '+i,careerGames:100,history:{a:{verified:true,retains:0},b:{verified:true,retains:0}}}));
 return E.create({kind:'preseason',season:2027,opensAt:new Date(start).toISOString(),locksAt:new Date(start+86400000).toISOString(),draftAt:new Date(start+172800000).toISOString()},teams,players,{a:players.slice(0,20).map(p=>p.id),b:players.slice(20).map(p=>p.id)});
}
function act(s,type,data={},actor=admin,now=start){return E.apply(s,{type,revision:s.revision,...data},actor,now);}
function prepared(){let s=fixture();for(const actor of [coach,other])s=act(s,'submit',{},actor);s=act(s,'prepare',{},admin,start+86400000);return act(s,'arm',{},admin,start+86400000);}
module.exports={E,start,admin,coach,other,fixture,act,prepared};
