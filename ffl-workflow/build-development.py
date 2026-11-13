"""Reproducible private owner-host packaging. Does not deploy or change access.
The reviewed private host remains an explicit input; never commit its output.
"""
import argparse, hashlib, importlib.util, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('shared',ROOT/'build-shared.py'); shared=importlib.util.module_from_spec(spec);spec.loader.exec_module(shared)
FILES=['draft-engine.js','notifications.js','draft-store.js','draft-access.js','draft-auth.js','draft-service.js','api/DraftWorkflow.gs','api/DraftAuth.gs','api/DraftRoutes.gs']
def package(host, instance, out):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',instance):raise ValueError('Invalid instance')
    marker='function fflOwnerSharedPage_()'
    if host.count(marker)!=1:raise ValueError('Expected one reviewed owner page')
    prefix=host[:host.index(marker)]
    if 'fflOwnerSharedAssert_();' not in prefix or "FFL_SANDBOX_WRITES_ENABLED" not in prefix:raise ValueError('Reviewed owner guards required')
    prefix=prefix.replace("['loginDraftWorkflow','readDraftWorkflow','writeDraftWorkflow']", "['loginDraftWorkflow','logoutDraftWorkflow','readDraftWorkflow','writeDraftWorkflow']")
    prefix=prefix.replace(" }else{\n  const auth=draftWorkflowAuth_().validate(payload.token);", " }else if(payload.action!=='logoutDraftWorkflow'){\n  const auth=draftWorkflowAuth_().validate(payload.token);")
    html=shared.build()
    html=html.replace('const SHARED_CONFIG='+json.dumps({'endpoint':'','instanceId':''})+';', 'const SHARED_CONFIG='+json.dumps({'endpoint':'','instanceId':instance,'transport':'apps-script'})+';')
    transport="async function sharedTransport(payload){"
    start=html.index(transport); end=html.index("\nel('login').onsubmit",start)
    html=html[:start]+"async function sharedTransport(payload){return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e.message||'Connection failed.'))).fflOwnerSharedDraftRequest(payload));}"+html[end:]
    start=html.index('  if(!SHARED_CONFIG.endpoint||!SHARED_CONFIG.instanceId)');end=html.index('  teamTarget=',start)
    html=html[:start]+"  if(!SHARED_CONFIG.instanceId||typeof google==='undefined'||!google.script?.run)throw Error('Open the owner-only Google Development page.');\n  sharedEndpoint='apps-script';\n"+html[end:]
    html=html.replace('<h1>Shared draft room</h1>','<h1>Development draft room</h1>')
    outputs={'SharedDraftWorkflow.gs':'\n\n'.join((ROOT/f).read_text() for f in FILES)+'\n',
      'OwnerDraftLogin.gs':prefix+marker+'{fflOwnerSharedAssert_();return HtmlService.createHtmlOutput('+json.dumps(html)+').setTitle("FFL owner-only shared draft");}\n'}
    out.mkdir(parents=True,exist_ok=True)
    for name,content in outputs.items():(out/name).write_text(content)
    manifest={'schema':1,'scope':'owner-only Development; no deployment or access changes','sourceHashes':{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in FILES+['shared-ui.js','shared-client.js','shared-shell.html','build-shared.py']},'files':{n:hashlib.sha256(c.encode()).hexdigest() for n,c in outputs.items()}}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--owner-host',required=True,type=Path);p.add_argument('--instance',required=True);p.add_argument('--output',required=True,type=Path);a=p.parse_args()
    package(a.owner_host.read_text(),a.instance,a.output);print('Development package built. No deployment performed.')
