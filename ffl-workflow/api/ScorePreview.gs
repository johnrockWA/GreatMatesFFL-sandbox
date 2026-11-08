/** Read-only Development adapter. No deployed route is installed by this file.
 * Load competition/score-status.js as FFLScoreStatus first.
 * Pass only the server result of validateToken to getScorePreview_.
 * FFL_SCORE_SHADOW_ID is a server property, never an HTTP argument.
 */
function getScorePreview_(auth) {
  if (!auth || auth.valid !== true || auth.role !== 'admin') throw Error('Admin access required.');
  sandboxAssertProject_();
  const id = PropertiesService.getScriptProperties().getProperty('FFL_SCORE_SHADOW_ID');
  if (!id) throw Error('Development score preview is not configured.');
  return scorePreviewRead_(id);
}
function scorePreviewRead_(id) {
  sandboxAssertProject_();
  const book=SpreadsheetApp.openById(id),control=book.getSheetByName('Control'),snapshots=book.getSheetByName('Snapshots');
  if(book.getName()!=='SANDBOX - AFL Pipeline Lab - 2027 Development'||!control||!snapshots||control.getRange('A1').getValue()!=='FFL_SHADOW_ONLY_V1') throw Error('Development score store identity mismatch.');
  const rawHead=control.getRange('B2').getValue(),head=JSON.parse(rawHead||'null');
  if(!head||!Number.isInteger(head.row)||head.row<2||head.row>snapshots.getLastRow()||!Number.isInteger(head.revision)||head.revision<1) throw Error('Invalid score snapshot head.');
  const record=snapshots.getRange(head.row,1,1,3).getValues()[0],count=record[1];
  if(!Number.isInteger(count)||count<1||count>20) throw Error('Invalid score snapshot chunks.');
  const json=snapshots.getRange(head.row,4,1,count).getValues()[0].join('');
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,json).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  if(hash!==head.hash||hash!==record[0]) throw Error('Score snapshot checksum mismatch.');
  const report=JSON.parse(control.getRange('B3').getValue()||'{}');
  // A failed attempt must not make old statistics look freshly collected.
  const collectedAt=report.hash===hash&&report.status!=='error'&&Number.isFinite(Date.parse(report.lastAttemptAt))?report.lastAttemptAt:record[2];
  const response=FFLScoreStatus.fromShadow(JSON.parse(json),{snapshotId:hash,collectedAt,collectorActive:false,refreshMinutes:5});
  if(control.getRange('B2').getValue()!==rawHead) throw Error('Score snapshot changed during read. Retry.');
  return response;
}
