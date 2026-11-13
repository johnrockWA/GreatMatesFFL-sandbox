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
  // Scripted personality samples only. These never consume free text or inspect league data.
  const persona = Object.freeze({
    tone:'Playful, cheeky, lightly flirty and unflappable',
    rulings:'Factual, evidence-based and impartial',
    principle:'Everyone gets her attention; nobody gets special treatment.'
  });
  const banterLines = Object.freeze({
    welcome:"Hello, coach. Here to make a selection, or explain last week's?",
    charm:"Careful, coach. Keep talking like that and I'll suspect you need an extension.",
    tease:"I've seen your bench selections. I'll survive your opinion."
  });
  function banter(topic) {
    if(!Object.prototype.hasOwnProperty.call(banterLines,topic))throw Error('Choose a scripted banter sample. General conversation is disabled.');
    return Object.freeze({name:identity.name,text:banterLines[topic],mode:'scripted-persona-preview',canExecute:false});
  }
  // Bounded free-text interface: curated answers only, with no model or actions.
  function converse(message, context={}) {
    const q=typeof message==='string'?message.trim():'';
    const reply=(text,topic,source='Katy conversation policy')=>Object.freeze({name:identity.name,text,topic,source,canExecute:false,mode:'guided-conversation'});
    if(!q)return reply('Give me a question, coach. Rules, deadlines or draft status?', 'empty');
    if(q.length>600)return reply('Keep it under 600 characters, coach. One question at a time.', 'limit');
    const t=q.toLowerCase().replace(/[’]/g,"'");
    // Questions must fit a supported topic in full. No generative fallback exists.
    if(/\b(who|which|should|recommend|best|better|rank|compare|optimis[ez]|shortlist|advice|captain|trade|line.?up|start|bench|worth|value|sleeper|underrated|suggest|strategy|help me pick)\b/.test(t)&&!/^whose turn\??$/.test(t))
      return reply("Nice try, coach. Player picks, trades and team selections are your homework. I can explain the rules and eligibility, but I won't recommend or rank players.", 'no-coaching');
    if(/^(hi|hello|hey)( katy)?[!.?]*$/.test(t))return reply("Hello, coach. You've got my attention. Rules question, or are you just visiting?",'welcome');
    if(/^(banter|give me some banter|tease me)[!.?]*$/.test(t))return reply('Your confidence has arrived. I trust the paperwork is following shortly.','banter');
    if(/^(flirt|charm|you look (great|lovely)|you are (lovely|beautiful))[!.?]*$/.test(t))return reply("Careful, coach. A little charm gets a smile. It doesn't get an extension.",'charm');
    if(/^(whose turn|draft status|is it my turn|what is happening|what happens next|what's next)[?.!]*$/.test(t))
      return reply(context.turnText||context.nextText||'Open the draft room for the current status.','status','Current demo workflow');
    if(/^(deadline|deadlines|when (is|are) (the )?(deadline|lockout|draft)|when do (selections|retains) (close|lock))[?.!]*$/.test(t))
      return reply(context.deadlineText||'No verified schedule is connected. Check the competition schedule.','deadlines','Current demo schedule · Perth time');
    if(/^(notifications?|reminders?|how (do|will) (i|coaches) (get notified|know it is (my|their) turn))[?.!]*$/.test(t))
      return reply('Draft turns get an in-app alert. A draft email becomes due only after more than one hour without a selection. Team-selection email reminders are due three hours before lockout for coaches still to submit. In this preview, email sending is off.','notifications','Agreed notification policy · preview sending disabled');
    if(/^(retains?|retention rules|how many (players can i retain|retains)|fookies?|fookie rules|dynasty( rules| player)?)[?.!]*$/.test(t))
      return reply('Up to two normal retains plus two separate fookie retains. Fookie eligibility is 50 career games or fewer. Three qualifying consecutive dynasty retentions means the player must enter the next draft. Unknown games, history or active-list status need verification. Player-specific eligibility is shown in your squad.','retention','Current sandbox rules engine · retentionStatus / selection');
    if(/^(can i draft (a player i delisted|my own delisted player)|own delist(ed)?( player)?|round (1|one) delist rule)[?.!]*$/.test(t))
      return reply('In the preseason draft, you cannot draft a player you delisted in Round 1. From Round 2, you may draft him if he is still available and has confirmed active-list status.','own-discard','Current sandbox rules engine · available');
    if(/^(career games|finals|player stats|stats source|where (do|does) (the )?(career games|stats) come from)[?.!]*$/.test(t))
      return reply('The current demo snapshot uses AFL Tables match statistics and official AFL trade/list changes. Career games include AFL finals. Regular-season averages and averages including AFL finals are labelled separately. Zero-game player list coverage is incomplete. This is a dated demo snapshot, not a live feed.','data','Player snapshot · 30 October 2026');
    if(/^(submit|save|arm|pause|resume|approve|draft|change|delete|send|override)\b/.test(t))
      return reply('Use the authorised controls in the app. This conversation cannot submit, draft, approve, change records or send messages.','no-actions');
    return reply("I'm unruffled, coach—but this first chat only recognises a few topics. Try ‘retention rules’, ‘whose turn’, ‘deadlines’, ‘notifications’ or ‘banter’. For an unresolved ruling, ask the committee. General AI conversation isn't connected yet.",'unsupported');
  }
  return Object.freeze({identity,persona,banter,nextStep,explainDecision,converse});
})();
if(typeof module!=='undefined')module.exports=FFLKaty;
