# Shared coach connection

8 November 2026. Prepared source on `feature/shared-draft-coach-connection`,
building on the durable storage work in draft PR #14.

## Behavior

`shared-draft.html` is a separate coach screen. It accepts server-projected state
only and has no demo fixture, client role selector or fallback to local choices.
Its connection and instance are deliberately empty until the reviewed Development
installation. The existing coach preview and competition remain in place.

The screen uses a separate draft sign-in and a per-tab session token. The server
reads the existing credential records without changing them and checks the explicit
identity registry. Session tokens expire after six hours, are indexed only by their
hash in the server cache, and are rechecked against current grants on every request.
The login path throttles repeated failures and never enables legacy login writes. A coach can open only a team assigned in that registry.
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

Load the engine, notifications, storage, access, authentication, service, workflow adapter and route
hook together. `DraftRoutes.gs` documents the explicit POST-dispatch hook; it is
not installed in the incumbent `doPost` by this commit. There is no GET writer.

The host must supply a reviewed initialized `DraftWorkflow_State` store and these
server properties: `FFL_DRAFT_IDENTITIES`, `FFL_DRAFT_INSTANCE`,
`FFL_DRAFT_PROJECT_ID`, `FFL_DRAFT_ROUTES_ENABLED`, `FFL_DRAFT_LOGIN_ENABLED`
and `FFL_DRAFT_WRITES_ENABLED`. All enable flags default to disabled. The script identity must match the server
configuration and the sandbox project assertion. Draft writes are refused while
`FFL_SANDBOX_WRITES_ENABLED` is true. This separates isolated draft transactions
from enabling operational competition writes. Final squad publication remains
blocked independently.

Supply the exact reviewed endpoint and instance to the static build at installation.
The screen accepts only Apps Script deployment paths; query parameters cannot
override the endpoint or redirect login credentials. Only the separate draft token is stored in per-tab session storage. Passwords are
cleared after sign-in attempts and never enter recovery records, logs or source.

## Verification and remaining work

### 12 November 2026 Development follow-up

The owner-only Development rehearsal now uses separate draft login, synthetic
players and two signed-in browser sessions. Background refresh no longer blocks
queue controls or replaces newer write responses. This is an isolated rehearsal;
operational competition writes and final publication remain disabled.

The first simultaneous queue reorder exposed a server defect: both requests
reported success at the same revision with different receipts. The adapter now
opens and validates the sheet only after acquiring the script lock, preventing
pre-lock sheet reads from priming stale cached data. The installed Development
adapter was retested: one request saved at revision 15 and the other was rejected
as stale. The original queue order was restored, and both tabs showed revision 16
with queue controls available.

204 source tests pass, including lock-before-sheet-open and lock-release-on-error
coverage. Generated builds match. The connected result proves this queue conflict
case only: simultaneous draft picks, reconnects, clock boundaries and a multi-coach
mock remain outstanding. The rehearsal is still in its retains stage.

### 12 November, 19:31–19:33 AWST: connected pick rehearsal

An owner-only synthetic preparation step preserved submitted retains, closed the
synthetic selection window, supplied the test opponent's empty retains and armed
the draft through audited engine actions. It opened pick 1.01 at revision 20.
The before/after protected-data fingerprint matched and coach grants stayed
unchanged. The temporary helper and diagnostic entry-point change were then
removed; the original owner host was read back byte-for-byte (normalized line
endings) and verified saved. `rehearsal/PrepareOwnerPicks.gs` records the private
helper for reproducibility; it is not part of the generated app or installed host.

Two authenticated tabs confirmed Test Player 25 for Rockstars at pick 1.01 using
concurrent browser clicks. Both clicks completed. One received a saved receipt at
revision 21; the other was rejected. The board advanced to the synthetic opponent
at pick 1.02, with Test Player 25 marked as picked by Rockstars. Refreshing the
rejected tab and fully reloading the successful tab both recovered revision 21,
the picked-player label and disabled draft buttons for the non-active team.

This is an actual connected competing-pick and ordinary reload check, using two
sessions of the same coach. It is not a multi-coach trial or a lost-response test.
The rejection currently says "Picking for another team has not been granted"
because turn authorization runs before the stale-revision check. Improve that
message, and clear the old rejection notice after successful refresh. No duplicate
pick was observed. The rehearsal remains at revision 21, awaiting the synthetic
opponent; official publication remains disabled.

205 source tests pass, including synthetic setup, repeat-run safety and rejection
of unexpected player data. Remaining connected checks include different coach
identities, lost-response recovery, clock boundaries and a complete small mock.

### 13 November: prepared recovery improvements (not installed)

The adapter now rejects an outdated pick with a refresh/current-turn explanation
before checking turn-specific proxy authority. A current-revision attempt to pick
for another team remains denied. Successful manual refresh clears old feedback
only when the view is current and no request is pending; successful retry also
clears old feedback. Unsaved selection edits remain intact.

207 source tests pass and generated builds match. A new integration test uses the
actual workflow adapter, durable store, service and client with in-memory I/O: the
first coach's pick commits but its reply is lost, a second authenticated synthetic
identity makes the next pick, and a recreated first client recovers the original
receipt at the newer revision. Exactly two picks and two pick audit entries remain.
It also checks opponent privacy, stale-turn wording and current-turn denial.
This is not a connected Google failure-injection or multi-coach trial.

The connected Development tab now requires fresh sandbox sign-in. These changes
are prepared locally, not yet publicly published or installed. Approval package:
publish the six changed source/build/test/report files as a draft PR and install
the two code changes in owner-only Development; run a controlled connected
lost-reply/retry rehearsal; then prepare and run two synthetic coach identities
in an isolated rehearsal, checking turns and private queues. No production merge,
official publication or real-coach invitations are included.

### Earlier source and installation baseline (8 November)

196 source tests pass. Both generated HTML builds match their builders, and all
inline shared scripts parse. The tests exercise two source clients, serialized
pick contention, privacy, access denial, deadline rejection, retries, timeouts,
receipt cleanup, unsaved edits, stale confirmations and escaped rendered names.
The host in those tests is synthetic; it does not prove simultaneous Google locks.

A separate cloud-browser check used synthetic projected teams/players, without a
server connection. Desktop rendering, player search and the pick-confirmation
dialog were inspected. That check does not certify mobile layout, coach login,
Google POST/CORS behavior or a shared-coach trial.

A fresh connected-browser read on 8 November confirmed the four original editor
files still match the prior capture. SharedDraftLab.gs remains isolated in its own
closure. Both active deployments are version 4, execute as John and allow only
John; the manifest agrees. Script properties show sandbox mode and no draft route,
login, identity, instance or write-enable configuration. No Google source,
properties, identity grants, deployments, access settings or data were changed.
The existing login requires the broad operational write switch, which conflicts
with isolated draft transactions; the separate login source closes that gap
without changing Users_Teams, squads or dynasty history.
Next: install the reviewed isolated routes and mappings in Development, then
test real login, two independent sessions, truly simultaneous picks, reconnects
and clock boundaries. Complete the small coach mock before any official release.

Rollback for the prepared source is a normal revert; existing deployments and
official squad/history records are unaffected by this source change.
