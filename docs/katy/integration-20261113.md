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

## Remaining acceptance

Separate browser identities; full mock; responsive/mobile review; expired session
and lost-pick recovery; controlled isolated squad publication; weekly selections;
verified scoring/ladder; suppressed notification capture; backup and restore.
Report source, connected server and browser evidence separately.
