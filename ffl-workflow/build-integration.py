import argparse,hashlib,json,re,pathlib
r=pathlib.Path(__file__).resolve().parent.parent
a=argparse.ArgumentParser();a.add_argument('--package-dir',required=True,type=pathlib.Path);p=a.parse_args().package_dir
if json.loads((p/'manifest.json').read_text()).get('syntheticIntegration'):
 raise SystemExit('Rebuild the clean Development package before adding integration.')
host=(p/'OwnerDraftLogin.gs').read_text();
html=json.loads(re.search(r'createHtmlOutput\((".*")\)\.setTitle',host).group(1))
html=re.sub(r'(const SHARED_CONFIG=.*?"instanceId": )"[^"]*"',r'\1"__INTEGRATION_INSTANCE__"',html)
html=html.replace('fflOwnerSharedDraftRequest(payload)','fflIntegrationRequest(payload)').replace('ffl_shared_draft_session_v1','ffl_integration_session_v1').replace('Shared draft room','Synthetic integration rehearsal').replace('Development draft room','Synthetic integration rehearsal')
html=html.replace('<main>', '<main><p class="panel">ISOLATED SYNTHETIC REHEARSAL — Alpha, Beta and Committee accounts only. No official records or real email. Sign in with alpha@example.invalid, beta@example.invalid or committee@example.invalid and synthetic-only.</p>')
page='function fflIntegrationPage_(){fflIntegrationAssert_();return HtmlService.createHtmlOutput('+json.dumps(html)+'.replace(/__INTEGRATION_INSTANCE__/g,fflIntegrationInstance_())).setTitle("FFL synthetic integration rehearsal");}\n'
scorer=(r/'competition/scoring.js').read_text().replace('module.exports={POSITIONS,identity,score,resolve,ladder};','return {POSITIONS,identity,score,resolve,ladder};')
scorer='var FFLScoring=(function(){\n'+scorer+'\n})();\n'
lab=scorer+(r/'ffl-workflow/development-workflow.js').read_text()+'\n'+(r/'ffl-workflow/api/DevelopmentRehearsal.gs').read_text()+'\n'+page
(p/'IntegrationRehearsal.gs').write_text(lab)
host=host.replace('function fflOwnerSharedPage_(){fflOwnerSharedAssert_();','function fflOwnerSharedPage_(){fflOwnerSharedAssert_();if(PropertiesService.getScriptProperties().getProperty("FFL_INTEGRATION_BROWSER")==="true")return fflIntegrationPage_();')
host+='\nfunction fflOpenIntegrationBrowser(){fflIntegrationAssert_();if(!fflIntegrationInstance_())throw Error("Initialize first");PropertiesService.getScriptProperties().setProperty("FFL_INTEGRATION_BROWSER","true");}\nfunction fflCloseIntegrationBrowser(){fflIntegrationAssert_();PropertiesService.getScriptProperties().deleteProperty("FFL_INTEGRATION_BROWSER");}\n'
(p/'OwnerDraftLogin.gs').write_text(host)

m=json.loads((p/"manifest.json").read_text());m["syntheticIntegration"]=True
for name in ["IntegrationRehearsal.gs","OwnerDraftLogin.gs"]:m["files"][name]=hashlib.sha256((p/name).read_bytes()).hexdigest()
for name in ["ffl-workflow/development-workflow.js","ffl-workflow/api/DevelopmentRehearsal.gs","competition/scoring.js"]:m["sourceHashes"][name]=hashlib.sha256((r/name).read_bytes()).hexdigest()
(p/"manifest.json").write_text(json.dumps(m,indent=2)+"\n")
