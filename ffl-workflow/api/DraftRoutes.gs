/** Prepared hook for doPost, before the legacy dispatcher:
 * if (['readDraftWorkflow','writeDraftWorkflow'].includes(payload.action))
 *   return respond(draftWorkflowRequest_(payload));
 * No GET action, login path, deployment or access setting is changed by this file.
 */
function draftWorkflowRequest_(payload){
  return createDraftService({
    assertEnvironment:function(){
      sandboxAssertProject_();
      if(!draftWorkflowProjectMatches_()||PropertiesService.getScriptProperties().getProperty('FFL_DRAFT_ROUTES_ENABLED')!=='true')throw Error('Shared draft routes are disabled.');
    },
    validateToken:validateToken,
    actor:draftWorkflowActor_,
    principalKey:function(actor){return draftWorkflowPrincipalKey_(actor);},
    instance:function(){return PropertiesService.getScriptProperties().getProperty('FFL_DRAFT_INSTANCE');},
    authorize:authorizeDraftAction,
    assertWrites:draftWorkflowAssertWrites_,
    read:getDraftWorkflow_,write:postDraftWorkflow_
  })(payload);
}
