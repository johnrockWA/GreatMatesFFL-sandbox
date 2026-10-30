/* Deterministic explanation boundary. No model, network, tools or write authority. */
var FFLKaty = (function () {
  'use strict';
  const identity = Object.freeze({name:'Katy',title:'Executive Administrator',aiEnabled:false});
  function nextStep({phase,missingCount=0,invalidCount=0,armed=false}) {
    const text = phase==='selection' ? 'Coaches are choosing their players. Review submission progress; setup approval becomes available after the deadline.'
      : phase==='review' ? missingCount ? `Resolve ${missingCount} missing submission${missingCount===1?'':'s'} before approving selections.`
        : invalidCount ? 'Resolve the selection issues before approving.' : 'All teams have submitted. Review the team list, then approve the draft setup.'
      : phase==='ready' ? armed ? 'The local draft is armed and will open at the example start time.' : 'Selections are approved. Arm the local draft when you are ready for it to open.'
      : phase==='paused' ? armed ? 'The draft is paused. Resolve the issue, then resume.' : 'A correction cleared draft readiness. Review it, arm the corrected draft, then resume.'
      : phase==='drafting' ? 'The local draft is running. The rules engine validates each pick; individual pick approval is not required.'
      : phase==='validation' ? 'All picks are complete. Review the squads before approving the local demo result.'
      : 'No draft approval is due at this stage.';
    return Object.freeze({name:identity.name,text,phase,approvalRequired:['review','ready','validation'].includes(phase),mode:'deterministic-local-preview'});
  }
  function explainDecision({allowed,reason,ruleId,ruleVersion}) {
    if(typeof allowed!=='boolean'||!reason||!ruleId||!ruleVersion)throw Error('A verified rule result and evidence are required.');
    return Object.freeze({allowed,reason,ruleId,ruleVersion,canExecute:false,mode:'deterministic-explanation'});
  }
  function converse() {throw Error('Conversational AI is disabled. Katy currently explains deterministic workflow results only.');}
  return Object.freeze({identity,nextStep,explainDecision,converse});
})();
if(typeof module!=='undefined')module.exports=FFLKaty;
