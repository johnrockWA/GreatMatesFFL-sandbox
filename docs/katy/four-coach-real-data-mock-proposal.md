# Four-coach Mock Testing Draft — access and data proposal

Status: prepared for implementation, not deployed or ready for coach invitations.
Updated 13 November 2026. Supersedes the two-coach/synthetic-player pilot proposal.

## Required outcome

Four real coaches use copies of their current actual squads, choose mock delists,
and draft real available AFL players with up-to-date, sourced statistics. Every
change stays in the mock. Actual squad ownership, dynasty history, nominations,
results and league draft records must remain unchanged, including at completion.

## Participants

| Coach | Team shown to coach | Existing team ID | Current roster label |
| --- | --- | --- | --- |
| Mark Brown | Brown Hounds | 2 | Brown Hounds |
| Rod Jones | Stones Green Ginger Winos | 9 | Stones Green Ginger Winos |
| Jerome Hardie | Jokers | 5 | Jerome's Jokers |
| John Rock | Rockstars | 7 | Rockstars |

The live Users_Teams rows confirm Mark Brown, Rodney Jones, Jerome Hardie and John
Rock against these teams. Stored IDs use zero-padded strings in that table; map
02/09/05/07 explicitly to canonical 2/9/5/7. Do not grant access by display name or
row position. Each has an existing email record; verify the intended sign-in
identity privately during setup. No email address or credential belongs in this
public proposal. John previously corrected Brown's mapping: Brown Hounds, not
Boucher's Broachmen.

## Mock format and coach journey

Use a delist-and-replacement rehearsal first: the existing midseason rule allows
each coach to submit 2–4 delists, giving 8–16 picks across four coaches. This is a
mock using current squads; it does not assert that the real league is presently at
Round 9. A later full preseason rehearsal can reuse the isolated infrastructure.

1. Sign in and see `MOCK TESTING DRAFT — actual squads are unchanged`, team name,
   squad snapshot time, stats coverage and last verification time.
2. View all 20 actual squad players in the mock copy; choose 2–4 delists, save and
   explicitly submit. Show the consequences before submission, including the
   verified league rule on re-drafting a delisted player.
3. Review the real pool, search/sort role averages and maintain a private queue.
   Distinguish available, held by a team, mock delisted, mock drafted and inactive
   AFL players. Show the selecting team and pick number for taken players.
4. Once all four submit, John reviews the delists and proposed order, then opens
   the mock. Use the verified applicable reverse-ladder relative order for these
   four teams; show the exact sequence before arming. Do not treat this participant
   table's row order as draft order. No date/order is scheduled by this proposal.
5. Confirm picks; recover missing replies and expired sessions using the existing
   central receipt mechanism. Completion produces a clearly labelled mock squad
   comparison. It never offers a publish-to-actual button or writes a dynasty entry.

John drafts as Rockstars with the same turn/ownership limits as every coach.
Separate, explicit mock-only committee controls cover review, opening and pausing;
other-team proxy picking is disabled for the pilot.

## Real squad and player-pool rules

Before the mock opens, read the actual source through a read-only import process,
validate it, and write a value-only versioned snapshot to a separate mock store.
Import no formulas, scripts, triggers, credentials or writable source connections.
Keep the actual source identifiers private and unavailable to coach requests.

Import all ten teams' ownership to determine availability, but grant only four
teams participation. The other six squads remain held/reserved: their players do
not become free agents just because those coaches are not testing. The selection
pool contains eligible genuinely unowned players plus the four participants'
submitted mock delists. Participants' kept players remain unavailable. All real
players remain searchable with factual availability labels.

Validate 20 players per team, 200 unique ownership assignments, stable player IDs,
club/name aliases, duplicate names, active-list status and count reconciliation.
A missing identity must stop that import or exclude the unresolved player with a
clear reason; never silently drop a player from a coach's starting squad.
Retired/delisted/re-list-pending AFL players remain visible in starting squads but
are not draftable without verified active status. Zero-game AFL-listed players
need roster evidence and an explicit no-senior-stats label, not invented averages.

Freeze the starting ownership and eligibility snapshot once selections open.
Source changes afterwards require a reviewed new mock instance, not a silent
rewrite of submitted choices or completed picks. Resetting the mock only resets
its own data and retains its audit trail.

## Up-to-date real statistics

Refresh and reconcile the latest completed AFL match data, career games, current
club and list status before the mock. Keep the latest completed-season label and
coverage through match/date explicit; do not call historical season statistics a
live feed. Recheck source freshness within 24 hours before the scheduled mock,
with a new refresh if the mock is delayed or a source correction is detected.
A fresh retrieval timestamp alone does not establish complete/current coverage.

Show season games, career games, relevant base-stat averages, six FFL role averages
and recent-form averages with their sample size. Calculate FFL points per match
using the established scoring rules, then average those scores. Do not apply the
nonlinear scoring formula to season-average inputs. Label regular season versus
including-finals consistently. Recent form means the player's latest completed
senior appearances; show how many are available rather than padding missing games.

Each dataset needs source references, season/coverage, collection and verification
timestamps, a checksum, and reconciliation results. Missing values stay missing;
genuine zero remains zero. Display current AFL club separately from the club at
the time historical statistics were recorded. Cross-source differences must be
resolved or visibly held; do not silently use the existing all-stat tolerance as
an approved rule. The real-data mock cannot be certified ready until the selected
pool and its displayed statistics meet this requirement.

## Isolation and access design

Use a separate minimal mock application and dedicated mock datastore, not a wider
release of the existing legacy project. The runtime receives only the approved
mock snapshot and mock storage configuration. It must have no actual-competition
write adapter, no official publication route and no credential permitting edits
to actual competition files. Read-only import access and mock runtime write
access are separate responsibilities; a UI banner alone is not isolation.

The server allowlist maps each verified pilot identity to exactly one team. Give
coaches application access only, never project-editor or spreadsheet-edit access.
Do not copy legacy passwords into the new store. Select and verify the identity
mechanism as part of the implementation package, then present its exact audience,
permissions and version before expanding access. That access change is not yet
performed or claimed approved by this proposal. Invitations are also not sent.

Before opening and after finishing, compare protected source values/checksums.
If the actual competition changed independently during the mock, investigate and
attribute the difference; never restore real data automatically to force a match.
Test that crafted requests, resets, completion and wrong-instance requests cannot
reach an official writer. Archive/export results only as mock evidence.

## Source assessment performed 13 November

Read-only inspection of the actual FFL_WebApp_Data workbook found:

- Squads A1:F211: 200 roster rows, ten squads of 20. All four participants have 20.
- The 80 participant names exactly match the October fixture's squad membership.
  This verifies membership comparison only, not freshness of that fixture's stats.
- Users_Teams A1:F12 confirms the four mappings and populated email records. No
  password column was requested.
- PlayerStats A1:AI1345: 668 named player rows; no populated values in any of the
  twelve FFL season/recent-form average columns. The five sampled base-stat rows
  have numerical data, but coverage/currentness has not yet been independently
  certified for the whole table.
- The existing 30 October sourced fixture contains 670 profiles and calculated
  role averages, but explicitly excludes some zero-appearance listed players and
  later draftees. It is useful evidence, not today's certified complete pool.

Thus the squad source is identified; a verified stats refresh, pool reconciliation,
new isolated host and actual four-user access test are still implementation work.
No source cells, access permissions or deployments were changed in this pass.

## Readiness checklist and rollback

Before asking coaches to test: verify the four identities; current 80-player squad
copy plus other-team reservations; complete available-player pool and displayed
stats; reviewed delist/re-draft policy and order; all four ordinary non-editor
logins; physical-phone use; same-pick contention; lost reply plus expiry/reload;
no official writer; protected source comparisons; and mock-only restore/reset.

If any check fails, keep or return the mock to paused, revoke only pilot access,
and preserve the mock receipts/logs. Actual squads remain outside rollback scope.

Next implementation deliverables: (1) read-only real-data snapshot and reconciliation
report; (2) four-coach mock host with stats display and isolation checks; (3) exact
versioned deployment/access proposal and a short coach test script. Schedule the
session with John after those gates pass.
