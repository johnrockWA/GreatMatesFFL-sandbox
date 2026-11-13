# Development integration 13 November 2026

John approved three packages: consolidate the candidate, prove separate coach
sessions/mobile recovery, and connect/rehearse the competition workflow in
isolation. Production cutover, official-record changes and real coach emails
remain outside this approval.

## Candidate ancestry

Base: tested recovery PR 20 plus the locally recorded connected evidence.
The cumulative branch contains the work from PRs 2–15 and 17–20, including the
PR 13 consolidation. PR 5's chat interface was superseded by background Katy.
PR 16 portraits are intentionally deferred, not silently discarded. Existing
PRs remain historical review records until the consolidated candidate is accepted.
This candidate targets develop directly; it is not a production merge.

## Checks and packaging

CI now covers every pull-request target and pushes to integration, feature, fix
and test branches. Manual dispatch is available. It has read-only repository
permissions and no deployment or mail credentials.

Build the private owner installation using:

```
python3 ffl-workflow/build-development.py --owner-host PRIVATE_HOST.gs --instance REVIEWED_INSTANCE --output private-candidates/integration
```

The builder retains the supplied owner/environment guards and replaces the
embedded page from current source. It emits the shared server bundle and hashes.
Private outputs must never enter the public repository. Installation must compare
exact file bytes and record the manifest; generating files alone is not evidence
of installation.

Server sign-out revokes the supplied cached session. UI sign-out waits for an
acknowledgement and protects unresolved pending requests. This does not migrate
legacy credential storage or establish a production identity provider.

## Verified evidence

- 215 source tests and generated-preview checks pass.
- Draft PR 21 consolidates the candidate; its initial CI run passed. It remains
  unmerged and is not a production deployment.
- Separate Alpha and Beta synthetic browser sessions each saved/submitted a
  fookie retain. A concurrent stale save was rejected without losing edits;
  refresh and explicit resave succeeded. Committee approved and armed the draft.
- Alpha selected player 22 (revision 9); Beta selected player 02 (revision 10).
  These were actual browser actions against the isolated server store.
- The synthetic clock was advanced once too far while selecting the editor
  runner. The completion helper schedules a future synthetic round only if the
  previous synthetic deadline passed and no nominations or publication exist.
  No actual competition dates are involved.

## Isolated integration installation

After building the clean private package, run:

```
python3 ffl-workflow/build-integration.py --package-dir private-candidates/integration
```

This adds a guarded synthetic server/page and updates manifest hashes. Re-running
requires rebuilding the clean package; the builder rejects duplicate injection.
Fixture accounts work only behind the existing owner/editor access assertion.
The durable store, squads, nominations, scoring publication and captured outbox
are separate from official records. Synthetic score evidence does not verify
any AFL live-data collector. Notifications use capture storage, never real mail.

## Remaining release gates

Mobile acceptance is not established: the requested viewport returned a body
width of 1045px, so it cannot be counted as a phone test. Separate ordinary
non-editor coach access and legacy credential migration are still unproved.
Lost-pick reply and expired-session recovery with two simultaneous browser
identities remain unproved; earlier queue recovery and source tests are narrower
supporting evidence. Midseason still needs a connected/browser rehearsal.
Real-data collection, mail delivery and production publication remain separate
release work. Do not describe this synthetic integration as production-ready.

## Connected completion result

The Google Development runner completed at 18:12 AWST on 13 November:
38 total picks (first two through distinct browser sessions, remaining 36 by
server rehearsal); squads [20,20]; two weekly submissions; two-team ladder;
publication replay verified; two captured notification records; zero emails;
score correction and checksum-verified restore passed. Final synthetic revision
58. Protected data fingerprint and original owner-rehearsal hash unchanged.
The copied-back installed server and both pages matched the generated package.

Browser sign-out initially revoked credentials but left a blank Google iframe
because it reloaded the embedded page. The client now clears private state and
shows the sign-in form without navigating; an in-flight old read cannot restore
that state. The source regression test also verifies a different coach can sign
in after the acknowledged sign-out.

The corrected sign-out was retested in the actual Google iframe: the coach
workspace disappeared and the sign-in form displayed without a blank reload.
The synthetic browser entry switch was then disabled.
