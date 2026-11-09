/* Deterministic visual state only. No chat, player ranking or write authority. */
var FFLKatyAvatar = (function () {
  'use strict';
  const THREE_HOURS=3*60*60*1000;
  const states=Object.freeze({
    administrator:Object.freeze({asset:'administrator',label:'Competition administration'}),
    deadline:Object.freeze({asset:'deadline',label:'Selection deadline'}),
    submitted:Object.freeze({asset:'submitted',label:'Submission recorded'}),
    draftTurn:Object.freeze({asset:'draft-turn',label:'Your draft turn'})
  });
  function select({phase,managingTeam,turnTeam,submitted=false,serverNow,locksAt}){
    if(phase==='selection'&&submitted)return states.submitted;
    if(phase==='selection'){
      const remaining=Date.parse(locksAt)-Date.parse(serverNow);
      if(Number.isFinite(remaining)&&remaining>=0&&remaining<=THREE_HOURS)return states.deadline;
    }
    if(phase==='drafting'&&managingTeam&&turnTeam===managingTeam)return states.draftTurn;
    return states.administrator;
  }
  return Object.freeze({select,states});
})();
if(typeof module!=='undefined')module.exports=FFLKatyAvatar;
