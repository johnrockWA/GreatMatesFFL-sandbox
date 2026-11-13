/** Prepared server integration, not deployed and no triggers installed.
 * The host must supply trusted draft/weekly-round context, persistent ledger,
 * verified team/email mapping and a mail transport that honours sandbox suppression.
 * No client payload may supply recipients, clock, submission status or the ledger.
 */
function notificationServices_(){
 throw new Error('Notification storage, round-reader and mail integration are not installed.');
}
function runFFLNotificationTick_(){
 sandboxAssertProject_();
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty('FFL_NOTIFICATION_EMAILS_ENABLED')!=='true')return {mode:'suppressed'};
 sandboxAssertWritesEnabled_();
 const lock=LockService.getScriptLock();lock.waitLock(10000);
 try{
  const services=notificationServices_(); // Fail closed until reviewed host services exist.
  const context=services.readContext(),ledger=services.readLedger();
  const updated=FFLNotifications.dispatch(ledger,context,services);
  services.save(updated);return {mode:'processed'};
 }finally{lock.releaseLock();}
}
