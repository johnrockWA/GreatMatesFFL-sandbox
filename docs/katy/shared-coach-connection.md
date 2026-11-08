# Shared coach connection

8 November 2026. Prepared source on `feature/shared-draft-coach-connection`,
building on the durable storage work in draft PR #14.

## Behavior

`shared-draft.html` is a separate coach screen. It accepts server-projected state
only and has no demo fixture, client role selector or fallback to local choices.
Its connection and instance are deliberately empty until the reviewed Development
installation. The existing coach preview and competition remain in place.

The screen uses the existing sandbox login token from the same browser origin.
The server validates it again on every request, then resolves the explicit
identity registry. A coach can open only a team assigned in that registry.
Committee roles need separate `review` and `proxyPick` grants in addition to
individual action grants. A committee title alone does not reveal private choices.

Choices distinguish unsaved edits, saved work and the last explicit submission.
Another session changing saved choices keeps local edits visible and blocks
submission until they are reviewed. A warning protects unsaved work when leaving.
Private queues can be reordered and removed; taken players retain their pick/team
label. Pick confirmation captures the checked revision, managing team and turn.
Changes or connection failures invalidate that confirmation.

Requests persist an identifier before sending. Timeouts, lost replies and failed
browser receipt cleanup keep that identifier recoverable. Only a matching server
receipt counts as saved. Definite rejection clears the pending request; ambiguous
storage failures retain it. Replays recover the original receipt without applying
the action again. Responses from an older revision or a changed principal fail.

## Prepared server installation

Load the engine, notifications, storage, access, service, workflow adapter and route
hook together. `DraftRoutes.gs` documents the explicit POST-dispatch hook; it is
not installed in the incumbent `doPost` by this commit. There is no GET writer.

The host must supply a reviewed initialized `DraftWorkflow_State` store and these
server properties: `FFL_DRAFT_IDENTITIES`, `FFL_DRAFT_INSTANCE`,
`FFL_DRAFT_PROJECT_ID`, `FFL_DRAFT_ROUTES_ENABLED` and `FFL_DRAFT_WRITES_ENABLED`.
Both enable flags default to disabled. The script identity must match the server
configuration and the sandbox project assertion. Draft writes are refused while
`FFL_SANDBOX_WRITES_ENABLED` is true. This separates isolated draft transactions
from enabling operational competition writes. Final squad publication remains
blocked independently.

Supply the exact reviewed endpoint and instance to the static build at installation.
The screen accepts only Apps Script deployment paths; query parameters cannot
override the endpoint or redirect login credentials. Tokens remain in the existing
login storage and are not written to request-recovery records or source.

## Verification and remaining work

190 source tests pass. Both generated HTML builds match their builders, and all
inline shared scripts parse. The tests exercise two source clients, serialized
pick contention, privacy, access denial, deadline rejection, retries, timeouts,
receipt cleanup, unsaved edits, stale confirmations and escaped rendered names.
The host in those tests is synthetic; it does not prove simultaneous Google locks.

A separate cloud-browser check used synthetic projected teams/players, without a
server connection. Desktop rendering, player search and the pick-confirmation
dialog were inspected. That check does not certify mobile layout, coach login,
Google POST/CORS behavior or a shared-coach trial.

The user's connected browser was unavailable in this run, so no Google source,
properties, identity grants, deployment, access settings or data were changed.
Next: reconnect to the Development editor, verify current source and backups,
install the isolated routes and mappings within the agreed sandbox scope, then
test real login, two independent sessions, truly simultaneous picks, reconnects
and clock boundaries. Complete the small coach mock before any official release.

Rollback for the prepared source is a normal revert; existing deployments and
official squad/history records are unaffected by this source change.
