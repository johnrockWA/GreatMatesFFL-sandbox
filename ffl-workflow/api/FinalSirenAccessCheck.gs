// Read-only, one request per public current route; no retries or writes.
function fflFinalSirenCurrentRouteCheck(){
 sandboxAssertProject_();
 const urls=['https://www.finalsiren.com/matches/2026/round-1','https://www.finalsiren.com/matches/2026/round-1/carlton-v-richmond'];
 const reports=urls.map(function(url){
  const started=Date.now(),r=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false}),html=r.getContentText(),headers=r.getAllHeaders();
  return {url:url,status:r.getResponseCode(),elapsedMs:Date.now()-started,bytes:html.length,contentType:headers['Content-Type']||headers['content-type'],location:headers.Location||headers.location||null,title:(/<title[^>]*>([^<]*)<\/title>/i.exec(html)||[])[1]||null,hasPlayerTables:/<table/i.test(html)&&/players\//i.test(html),matchLinks:(html.match(/href=\"\/matches\/2026\/round-1\//g)||[]).length};
 });
 Logger.log(JSON.stringify({check:'FinalSiren-current-public-routes',writes:false,checkedAt:new Date().toISOString(),reports:reports}));
}
