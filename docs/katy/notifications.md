# Coach notifications — approved policy, 31 October 2026

## Draft

When an accepted, committed pick changes the turn, the next coach receives an
in-app alert naming their FFL team and pick. No immediate draft email, WhatsApp,
SMS or push is included. The UI links to the draft room without recommending a
player. The adapter exposes the alert only to the authenticated actor's team.

One email becomes due only when the current turn has waited **over one hour**
since the last recorded selection. Precisely 60 minutes is not enough. For the
first turn, timing begins at the later of scheduled opening and committee arming.
A failed pick does not advance the turn or reset this clock. Paused, closed and
completed drafts have no active turn alerts. Resuming a pause re-evaluates the
same turn; a previously sent email is not repeated.

## Weekly team selection

One email becomes due three hours before each verified round lockout, only for
teams explicitly marked not submitted. Unknown status does not trigger mail.
A delayed scheduler may catch up within the three-hour window, but never after
lockout. Submitted teams and cancelled rounds are skipped. Deadline changes
invalidate old queued reminders and use the new deadline.

These weekly reminders are separate from preseason retain/delist-window reminders
in the existing draft engine. No real weekly round records are connected yet.

## Delivery reliability and privacy

Notification IDs identify the turn/team or round/deadline/team. Repeated ticks
reconcile a durable ledger instead of enqueueing duplicates. Before delivery,
re-read authoritative state and cancel obsolete turns/submitted teams. Recipients
come from trusted coach mappings, never request payloads. Messages contain no
private retains or queues, player recommendations or links granting access.

A server lock must protect the read/claim/write/send transition. Commit an
`attempting` claim before calling the provider. If provider acceptance or the final
ledger write is ambiguous, do not automatically retry: preserve `attempting` or
`uncertain` for manual review. This favours avoiding duplicate email over guaranteed
delivery; it is not an exactly-once email guarantee. Provider acceptance is not
proof that a coach read the message.

## Implemented boundary

`notifications.js` implements policy and outbox transitions with injected trusted
services. The preview shows current-team in-app alerts and email timing status;
its debug clock can advance past an hour. No mail or background scheduler runs.

The prepared Apps Script tick is disabled by default, obeys the project/write
checks, and fails closed until durable storage, authoritative weekly-round reads,
coach mappings and a sandbox-aware mail transport are installed. Enabling a flag
alone cannot send mail. No trigger has been installed or Google deployment changed.

Before live/shared delivery: complete the source/trigger/mail-suppression audit,
implement those host services, validate tester identities and privacy, test two
sessions and worker restarts, confirm real lockouts/timezone, and obtain the
separate Google installation/email-enable decision. The source-only PR does not
claim active end-to-end email delivery.
